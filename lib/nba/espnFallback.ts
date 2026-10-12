import { getPlayerGameLog, scoreboardFor } from '@/lib/espn/api'
import { fromEspnAbbr, toEspnAbbr } from '@/lib/espn/teams'
import { cached, fetchJsonSafe } from '@/lib/net/ttlCache'
import { NBA_TEAM_DIVISIONS, NBA_TEAM_IDS } from './divisions'
import type { NBABoxScore, NBABoxScoreTeam, NBAGame, NBAPlayerGameLogRow, NBAPlayerSeasonStats, NBAStandingsTeam, NBATeamGameLogRow, NBATeamStats } from './api'

/**
 * Third-tier NBA source (after stats.nba.com and balldontlie): ESPN's public JSON. balldontlie's free
 * key only covers teams/players/games — standings, season averages and box scores are paid-only there —
 * so ESPN is what keeps Leaders, Standings and game breakdowns alive when stats.nba.com is blocked.
 *
 * Game ids from this source are prefixed "espn-" so every downstream lookup (box score, matchup shell)
 * knows which provider they belong to.
 */

const WEB = 'https://site.web.api.espn.com/apis'
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba'

type Json = Record<string, any>

export const ESPN_ID_PREFIX = 'espn-'
export const isEspnGameId = (id: string) => id.startsWith(ESPN_ID_PREFIX)

/** ESPN names a season by its end year: 2025-26 → 2026. */
export function espnSeasonYear(season: string): number {
  return Number(season.slice(0, 4)) + 1
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const teamId = (abbr: string) => NBA_TEAM_IDS[abbr] ?? 0

function zip(names: string[] | undefined, values: unknown[] | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  ;(names ?? []).forEach((n, i) => {
    if (out[n] === undefined) out[n] = num(values?.[i])
  })
  return out
}

// ---------------------------------------------------------------------------
// Schedule / scores
// ---------------------------------------------------------------------------

export async function espnNbaGames(date: string): Promise<NBAGame[] | null> {
  const board = await scoreboardFor('nba', { date, ttl: 300 })
  if (!board) return null
  return board.games.map((g): NBAGame => {
    const status = g.state === 'post' ? 'Final' : g.state === 'in' ? 'Live' : 'Pregame'
    return {
      gameId: `${ESPN_ID_PREFIX}${g.id}`,
      gameDate: g.date,
      status,
      statusText: g.statusText,
      arena: g.venue ?? '',
      network: g.network,
      away: { abbr: g.away.abbr, teamId: teamId(g.away.abbr), score: g.state === 'pre' ? null : g.away.score },
      home: { abbr: g.home.abbr, teamId: teamId(g.home.abbr), score: g.state === 'pre' ? null : g.home.score },
    }
  })
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

export async function espnNbaStandings(season: string): Promise<NBAStandingsTeam[] | null> {
  const year = espnSeasonYear(season)
  return cached(`espn:nba:standings:${year}`, 3600, async () => {
    const res = await fetchJsonSafe<Json>(`${WEB}/v2/sports/basketball/nba/standings?season=${year}`, { timeoutMs: 12000, cache: 'no-store' }, 'espn-nba')
    if (!res) return null
    const out: NBAStandingsTeam[] = []
    for (const conf of (res.data.children as Json[] | undefined) ?? []) {
      const conference: 'East' | 'West' = /east/i.test(conf.name ?? '') ? 'East' : 'West'
      const entries: Json[] = conf.standings?.entries ?? []
      for (const e of entries) {
        const abbr = fromEspnAbbr('nba', String(e.team?.abbreviation ?? ''))
        const stat = (name: string) => (e.stats as Json[] | undefined)?.find((s) => s.name === name)
        const display = (name: string) => String(stat(name)?.displayValue ?? '')
        const wins = num(stat('wins')?.value)
        const losses = num(stat('losses')?.value)
        out.push({
          abbr,
          teamId: teamId(abbr),
          conference,
          division: NBA_TEAM_DIVISIONS[abbr] ?? '',
          wins,
          losses,
          winPct: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 1000) / 1000 : 0,
          home: display('Home') || '0-0',
          away: display('Road') || '0-0',
          last10: display('Last Ten Games') || '0-0',
          streak: display('streak') || '—',
          gamesBack: display('gamesBehind') || '-',
          confRecord: display('vs. Conf.'),
        })
      }
    }
    return out.length > 0 ? out : null
  })
}

// ---------------------------------------------------------------------------
// Player season averages
// ---------------------------------------------------------------------------

export async function espnNbaPlayerStats(season: string): Promise<NBAPlayerSeasonStats[] | null> {
  const year = espnSeasonYear(season)
  return cached(`espn:nba:players:${year}`, 3600, async () => {
    const out: NBAPlayerSeasonStats[] = []
    for (let page = 1; page <= 3; page++) {
      const res = await fetchJsonSafe<Json>(
        `${WEB}/common/v3/sports/basketball/nba/statistics/byathlete?limit=300&page=${page}&season=${year}&seasontype=2&sort=offensive.avgPoints:desc`,
        { timeoutMs: 15000, cache: 'no-store' },
        'espn-nba'
      )
      if (!res) return out.length > 0 ? out : null
      const cats: Json[] = res.data.categories ?? []
      for (const row of (res.data.athletes as Json[] | undefined) ?? []) {
        const a = row.athlete ?? {}
        const v: Record<string, number> = {}
        for (const c of (row.categories as Json[] | undefined) ?? []) {
          const meta = cats.find((m) => m.name === c.name)
          Object.assign(v, zip(meta?.names, c.values))
        }
        const abbr = fromEspnAbbr('nba', String(a.teamShortName ?? ''))
        out.push({
          // ESPN athlete ids are stored negated so they can never collide with stats.nba.com player ids.
          playerId: -num(a.id),
          name: String(a.displayName ?? ''),
          teamAbbr: abbr,
          teamId: teamId(abbr),
          position: String(a.position?.abbreviation ?? ''),
          gamesPlayed: v.gamesPlayed ?? 0,
          min: v.avgMinutes ?? 0,
          pts: v.avgPoints ?? 0,
          reb: v.avgRebounds ?? 0,
          oreb: 0,
          dreb: 0,
          ast: v.avgAssists ?? 0,
          stl: v.avgSteals ?? 0,
          blk: v.avgBlocks ?? 0,
          tov: v.avgTurnovers ?? 0,
          fgPct: (v.fieldGoalPct ?? 0) / 100,
          fg3m: v.avgThreePointFieldGoalsMade ?? 0,
          fg3Pct: (v.threePointFieldGoalPct ?? 0) / 100,
          ftPct: (v.freeThrowPct ?? 0) / 100,
          plusMinus: 0,
        })
      }
      if (page >= num(res.data.pagination?.pages)) break
    }
    return out.length > 0 ? out : null
  })
}

// ---------------------------------------------------------------------------
// Team stats
// ---------------------------------------------------------------------------

/** Possessions per game from box-score totals (the standard FGA + 0.44·FTA − OREB + TOV estimate). */
const possessions = (fga: number, fta: number, oreb: number, tov: number) => fga + 0.44 * fta - oreb + tov

export async function espnNbaTeamStats(season: string): Promise<NBATeamStats[] | null> {
  const year = espnSeasonYear(season)
  return cached(`espn:nba:teams:${year}`, 3600, async () => {
    const [res, standings] = await Promise.all([
      fetchJsonSafe<Json>(`${WEB}/common/v3/sports/basketball/nba/statistics/byteam?season=${year}&seasontype=2`, { timeoutMs: 15000, cache: 'no-store' }, 'espn-nba'),
      espnNbaStandings(season),
    ])
    if (!res) return null
    const cats: Json[] = res.data.categories ?? []
    const out: NBATeamStats[] = []
    for (const t of (res.data.teams as Json[] | undefined) ?? []) {
      const abbr = fromEspnAbbr('nba', String(t.team?.abbreviation ?? ''))
      // Each category appears twice: the team's own numbers first, then what its opponents did against it.
      const own: Record<string, number> = {}
      const opp: Record<string, number> = {}
      const seen = new Set<string>()
      ;(t.categories as Json[] | undefined)?.forEach((c, i) => {
        void i
        // The duplicate (opponent) block carries no names of its own; reuse the first block's.
        const names = (cats.find((m) => m.name === c.name && m.names)?.names as string[] | undefined) ?? (cats[i]?.names as string[] | undefined) ?? []
        const zipped = zip(names, c.values)
        if (c.name === 'differential') return
        const target = seen.has(c.name) ? opp : own
        seen.add(c.name)
        Object.assign(target, zipped)
      })
      const poss = possessions(own.avgFieldGoalsAttempted ?? 0, own.avgFreeThrowsAttempted ?? 0, own.avgOffensiveRebounds ?? 0, own.avgTurnovers ?? 0)
      const oppPoss = possessions(opp.avgFieldGoalsAttempted ?? 0, opp.avgFreeThrowsAttempted ?? 0, opp.avgOffensiveRebounds ?? 0, opp.avgTurnovers ?? 0)
      const rec = standings?.find((s) => s.abbr === abbr)
      out.push({
        teamId: teamId(abbr),
        abbr,
        gamesPlayed: own.gamesPlayed ?? 0,
        pts: own.avgPoints ?? 0,
        oppPts: opp.avgPoints ?? 0,
        fgPct: (own.fieldGoalPct ?? 0) / 100,
        fg3Pct: (own.threePointFieldGoalPct ?? 0) / 100,
        ftPct: (own.freeThrowPct ?? 0) / 100,
        reb: own.avgRebounds ?? 0,
        ast: own.avgAssists ?? 0,
        tov: own.avgTurnovers ?? 0,
        oppTov: opp.avgTurnovers ?? 0,
        // Estimated from totals (ESPN doesn't publish pace/ratings): 100 × points ÷ possessions.
        pace: poss > 0 ? Math.round(((poss + oppPoss) / 2) * 10) / 10 : null,
        offRtg: poss > 0 ? Math.round(((100 * (own.avgPoints ?? 0)) / poss) * 10) / 10 : null,
        defRtg: oppPoss > 0 ? Math.round(((100 * (opp.avgPoints ?? 0)) / oppPoss) * 10) / 10 : null,
        wins: rec?.wins ?? 0,
        losses: rec?.losses ?? 0,
      })
    }
    return out.length > 0 ? out : null
  })
}

// ---------------------------------------------------------------------------
// Box score
// ---------------------------------------------------------------------------

export async function espnNbaBoxScore(gameId: string): Promise<NBABoxScore | null> {
  const eventId = gameId.replace(ESPN_ID_PREFIX, '')
  return cached(`espn:nba:box:${eventId}`, 60, async () => {
    const res = await fetchJsonSafe<Json>(`${SITE}/summary?event=${eventId}`, { timeoutMs: 12000, cache: 'no-store' }, 'espn-nba')
    if (!res) return null
    const comps: Json[] = res.data.header?.competitions?.[0]?.competitors ?? []
    const scores = new Map<string, number>(comps.map((c) => [String(c.team?.abbreviation), num(c.score)]))
    const sides: Record<'home' | 'away', NBABoxScoreTeam | null> = { home: null, away: null }
    for (const block of (res.data.boxscore?.players as Json[] | undefined) ?? []) {
      const abbr = fromEspnAbbr('nba', String(block.team?.abbreviation ?? ''))
      const homeAway = comps.find((c) => String(c.team?.abbreviation) === String(block.team?.abbreviation))?.homeAway as 'home' | 'away' | undefined
      const stat = block.statistics?.[0]
      const labels: string[] = stat?.labels ?? []
      const idx = (l: string) => labels.indexOf(l)
      const players = ((stat?.athletes as Json[] | undefined) ?? [])
        .filter((p) => !p.didNotPlay && (p.stats as unknown[] | undefined)?.length)
        .map((p) => {
          const s = p.stats as string[]
          const threes = String(s[idx('3PT')] ?? '0-0').split('-')[0]
          return {
            personId: -num(p.athlete?.id),
            name: String(p.athlete?.displayName ?? ''),
            position: String(p.athlete?.position?.abbreviation ?? ''),
            starter: !!p.starter,
            min: `${num(s[idx('MIN')])}:00`,
            pts: num(s[idx('PTS')]),
            reb: num(s[idx('REB')]),
            ast: num(s[idx('AST')]),
            stl: num(s[idx('STL')]),
            blk: num(s[idx('BLK')]),
            tov: num(s[idx('TO')]),
            fg3m: num(threes),
          }
        })
      if (!homeAway) continue
      sides[homeAway] = { teamId: teamId(abbr), abbr, score: scores.get(String(block.team?.abbreviation)) ?? 0, players }
    }
    if (!sides.home || !sides.away) return null
    return { gameId, home: sides.home, away: sides.away }
  })
}

// ---------------------------------------------------------------------------
// Player game log
// ---------------------------------------------------------------------------

/** Game-by-game box lines for an ESPN-namespaced (negative) player id. */
export async function espnNbaPlayerGameLog(playerId: number, season: string): Promise<NBAPlayerGameLogRow[] | null> {
  const log = await getPlayerGameLog('basketball', 'nba', String(Math.abs(playerId)), espnSeasonYear(season))
  if (!log) return null
  const made = (v: string | undefined) => num(String(v ?? '0').split('-')[0])
  return log.rows.map((r) => ({
    gameId: `${ESPN_ID_PREFIX}${r.eventId}`,
    gameDate: (r.date ?? '').slice(0, 10),
    matchup: `${r.home ? 'vs.' : '@'} ${r.opponent}`,
    opponentAbbr: r.opponent,
    isHome: r.home,
    wl: r.result === 'W' ? ('W' as const) : r.result === 'L' ? ('L' as const) : null,
    min: num(r.raw.minutes),
    pts: num(r.raw.points),
    reb: num(r.raw.totalRebounds),
    ast: num(r.raw.assists),
    stl: num(r.raw.steals),
    blk: num(r.raw.blocks),
    tov: num(r.raw.turnovers),
    fg3m: made(r.raw['threePointFieldGoalsMade-threePointFieldGoalsAttempted']),
    fgPct: num(r.raw.fieldGoalPct) / 100,
  }))
}

// ---------------------------------------------------------------------------
// Team game log
// ---------------------------------------------------------------------------

export async function espnNbaTeamGameLog(abbr: string, season: string): Promise<NBATeamGameLogRow[] | null> {
  const year = espnSeasonYear(season)
  const slug = toEspnAbbr('nba', abbr).toLowerCase()
  return cached(`espn:nba:gamelog:${slug}:${year}`, 3600, async () => {
    const res = await fetchJsonSafe<Json>(`${SITE}/teams/${slug}/schedule?season=${year}&seasontype=2`, { timeoutMs: 12000, cache: 'no-store' }, 'espn-nba')
    if (!res) return null
    const rows: NBATeamGameLogRow[] = []
    for (const ev of (res.data.events as Json[] | undefined) ?? []) {
      const comp = ev.competitions?.[0]
      if (!comp || comp.status?.type?.state !== 'post') continue
      const cs: Json[] = comp.competitors ?? []
      const mine = cs.find((c) => fromEspnAbbr('nba', String(c.team?.abbreviation)) === abbr)
      const theirs = cs.find((c) => c !== mine)
      if (!mine || !theirs) continue
      const pts = num(mine.score?.value ?? mine.score)
      const oppPts = num(theirs.score?.value ?? theirs.score)
      const opp = fromEspnAbbr('nba', String(theirs.team?.abbreviation))
      const isHome = mine.homeAway === 'home'
      rows.push({
        gameId: `${ESPN_ID_PREFIX}${ev.id}`,
        gameDate: String(ev.date).slice(0, 10),
        matchup: isHome ? `${abbr} vs. ${opp}` : `${abbr} @ ${opp}`,
        opponentAbbr: opp,
        isHome,
        wl: pts > oppPts ? 'W' : 'L',
        pts,
        oppPts,
        // Rebounds/assists/turnovers/3P% per game aren't on ESPN's schedule feed.
        reb: 0,
        ast: 0,
        tov: 0,
        fg3Pct: 0,
      })
    }
    return rows.sort((a, b) => b.gameDate.localeCompare(a.gameDate))
  })
}
