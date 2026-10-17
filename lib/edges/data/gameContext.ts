import { getCollegeDirectory } from '@/lib/college/directory'
import { ESPN_REF, getAllTeamStats, getGameSummary, getInjuries, getStandings, getTeamList } from '@/lib/espn/api'
import { fromEspnAbbr } from '@/lib/espn/teams'
import { getLeagueData } from '@/lib/football/league'
import { fetchJson } from '@/lib/mlb/fetchJson'
import { getMlbTeamsIndex } from '@/lib/mlb/teams'
import { NBA_TEAM_DIVISIONS } from '@/lib/nba/divisions'
import { getNFLSchedule } from '@/lib/nfl/api'
import { NFL_TEAM_DIVISIONS } from '@/lib/nfl/divisions'
import { getAllNHLTeamStats } from '@/lib/nhl/api'
import { NHL_TEAM_DIVISIONS } from '@/lib/nhl/divisions'
import { cached } from '@/lib/net/ttlCache'
import { getGameOdds } from '@/lib/odds/api'
import { getTeamResults } from '@/lib/odds/history'
import { getVenueWeather } from '@/lib/weather/api'
import type { Sport } from '@/lib/sport/SportContext'
import { seasonPhase } from '../historicalRates'
import { gamesPlayed, minimumsFor } from '../minimums'
import { detectGameContext } from '../seasonContext'
import { getPostseasonRecords } from './postseason'
import { ALWAYS_INDOOR, nflIndoors } from '../venues'
import type { DefenseRank, GameContext, InjuryNote, TeamGameRecord } from '../types'
import { loadMlbGameInfo, mlbIndoors, type MlbGameInfo } from './mlbGame'
import { loadLineFacts } from './lines'
import { loadMlbGameFacts } from './mlb'
import { loadNbaGameFacts } from './nba'
import { loadNflGameFacts } from './nfl'
import { loadNhlGameFacts } from './nhl'
import { buildGameFoundation } from '../gameFoundation'
import { loadTeammatesOut } from './teammates'

/** ESPN season year for "now": basketball and hockey seasons are named for the year they end in. */
export function currentSeasonYear(sport: Sport, now = new Date()): number {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth() + 1
  if (sport === 'nba' || sport === 'nhl' || sport === 'cbb') return m >= 9 ? y + 1 : y
  if (sport === 'nfl' || sport === 'cfb') return m >= 7 ? y : y - 1
  return m >= 2 ? y : y - 1
}

export async function teamRecords(sport: Sport, abbr: string, seasons: number[]): Promise<TeamGameRecord[]> {
  const lists = await Promise.all(seasons.map((s) => getTeamResults(sport, abbr, s).catch(() => null)))
  const out: TeamGameRecord[] = []
  lists.forEach((list, i) => {
    for (const g of list ?? []) {
      const home = g.home === abbr
      out.push({ season: seasons[i], date: g.date, opp: home ? g.away : g.home, home, us: home ? g.homeScore : g.awayScore, them: home ? g.awayScore : g.homeScore })
    }
  })
  // Postseason games belong to the current season; the regular-season schedule call never lists them.
  if (seasons.includes(currentSeasonYear(sport))) out.push(...(await getPostseasonRecords(sport, abbr, currentSeasonYear(sport))))
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

/** Ranks teams by a per-game figure; rank 1 = allows the MOST (the softest defense for that stat). */
function rankMap(values: { abbr: string; value: number }[]): Record<string, { rank: number; of: number; value: number }> {
  const sorted = [...values].sort((a, b) => b.value - a.value)
  const out: Record<string, { rank: number; of: number; value: number }> = {}
  sorted.forEach((v, i) => (out[v.abbr] = { rank: i + 1, of: sorted.length, value: v.value }))
  return out
}

async function defenseTables(sport: Sport): Promise<Record<string, Record<string, DefenseRank>>> {
  const table: Record<string, Record<string, DefenseRank>> = {}
  const put = (category: string, label: string, values: { abbr: string; value: number }[]) => {
    const ranks = rankMap(values)
    for (const [abbr, r] of Object.entries(ranks)) (table[abbr] ??= {})[category] = { ...r, label }
  }

  if (sport === 'nfl' || sport === 'cfb') {
    const data = getLeagueData(sport === 'nfl' ? 'nfl' : 'college-football')
    const agg = new Map<string, { g: number; pass: number; rush: number; pts: number }>()
    for (const g of data.games) {
      for (const [mine, theirs] of [[g.home, g.away], [g.away, g.home]] as const) {
        const c = agg.get(mine.abbr) ?? { g: 0, pass: 0, rush: 0, pts: 0 }
        c.g++
        c.pass += Number(theirs.stats.netPassingYards ?? 0) || 0
        c.rush += Number(theirs.stats.rushingYards ?? 0) || 0
        c.pts += theirs.score
        agg.set(mine.abbr, c)
      }
    }
    const teams = Array.from(agg.entries()).filter(([, c]) => c.g >= 2)
    put('Pass Yards', 'passing yards allowed per game', teams.map(([abbr, c]) => ({ abbr, value: c.pass / c.g })))
    put('Receiving Yards', 'passing yards allowed per game', teams.map(([abbr, c]) => ({ abbr, value: c.pass / c.g })))
    put('Rush Yards', 'rushing yards allowed per game', teams.map(([abbr, c]) => ({ abbr, value: c.rush / c.g })))
    put('Points', 'points allowed per game', teams.map(([abbr, c]) => ({ abbr, value: c.pts / c.g })))
  } else if (sport === 'nba' || sport === 'cbb') {
    const ref = ESPN_REF[sport]
    const rows = await getAllTeamStats(ref.sport, ref.league, currentSeasonYear(sport)).catch(() => null)
    const dir = sport === 'cbb' ? await getCollegeDirectory('cbb').catch(() => null) : null
    const usable = (rows ?? []).filter((r) => (r.own.gamesPlayed ?? 0) >= 5 && (sport === 'nba' || dir?.byId.has(r.teamId)))
    const abbrOf = (r: (typeof usable)[number]) => (sport === 'nba' ? fromEspnAbbr('nba', r.abbr) : (dir?.byId.get(r.teamId)?.abbr ?? r.abbr))
    const allowed = (own: string, diff: string) => usable.flatMap((r) => (r.own[own] !== undefined && r.own[diff] !== undefined ? [{ abbr: abbrOf(r), value: r.own[own] - r.own[diff] }] : []))
    put('Points', 'points allowed per game', allowed('avgPoints', 'avgPointsDifferential'))
    put('Rebounds', 'rebounds allowed per game', allowed('avgRebounds', 'avgReboundsDifferential'))
    put('Assists', 'assists allowed per game', allowed('avgAssists', 'avgAssistsDifferential'))
  } else if (sport === 'nhl') {
    const rows = await getAllNHLTeamStats().catch(() => null)
    const usable = (rows ?? []).filter((r) => r.gamesPlayed >= 3)
    put('Shots on Goal', 'shots against per game', usable.map((r) => ({ abbr: r.abbr, value: r.shotsAgainstPerGame })))
    put('Points', 'goals against per game', usable.map((r) => ({ abbr: r.abbr, value: r.goalsAgainstPerGame })))
    put('Assists', 'goals against per game', usable.map((r) => ({ abbr: r.abbr, value: r.goalsAgainstPerGame })))
  } else if (sport === 'mlb') {
    interface Split { team: { id: number }; stat: { era?: string; gamesPlayed?: number; hits?: number; homeRuns?: number; strikeOuts?: number; plateAppearances?: number } }
    const year = currentSeasonYear('mlb')
    const [pit, hit, idx] = await Promise.all([
      fetchJson<{ stats: { splits: Split[] }[] }>(`https://statsapi.mlb.com/api/v1/teams/stats?stats=season&group=pitching&season=${year}&sportIds=1`, 21600, `edges-mlb-pit-${year}`),
      fetchJson<{ stats: { splits: Split[] }[] }>(`https://statsapi.mlb.com/api/v1/teams/stats?stats=season&group=hitting&season=${year}&sportIds=1`, 21600, `edges-mlb-hit-${year}`),
      getMlbTeamsIndex(),
    ])
    const rows = (d: typeof pit, f: (s: Split['stat']) => number | undefined) =>
      (d?.stats?.[0]?.splits ?? []).flatMap((s) => {
        const abbr = idx?.get(s.team.id)?.abbr
        const gp = s.stat.gamesPlayed ?? 0
        const v = f(s.stat)
        return abbr && gp >= 5 && v !== undefined ? [{ abbr, value: v / gp }] : []
      })
    put('ERA', 'team ERA', (pit?.stats?.[0]?.splits ?? []).flatMap((s) => {
      const abbr = idx?.get(s.team.id)?.abbr
      const v = Number(s.stat.era)
      return abbr && (s.stat.gamesPlayed ?? 0) >= 5 && Number.isFinite(v) ? [{ abbr, value: v }] : []
    }))
    put('Hits', 'hits allowed per game', rows(pit, (s) => s.hits))
    put('Home Runs', 'home runs allowed per game', rows(pit, (s) => s.homeRuns))
    put('Strikeouts', 'batter strikeouts per game', rows(hit, (s) => s.strikeOuts))
    const kRate = (d: typeof hit) =>
      (d?.stats?.[0]?.splits ?? []).flatMap((s) => {
        const abbr = idx?.get(s.team.id)?.abbr
        const pa = s.stat.plateAppearances ?? 0
        return abbr && pa >= 150 && s.stat.strikeOuts !== undefined ? [{ abbr, value: (s.stat.strikeOuts / pa) * 100 }] : []
      })
    put('Strikeout rate', 'strikeout rate (K% of plate appearances)', kRate(hit))
  }
  return table
}

function injuryList(sport: Sport, teams: string[], all: Awaited<ReturnType<typeof getInjuries>>): InjuryNote[] {
  void sport
  return (all ?? [])
    .filter((i) => teams.includes(i.team))
    .map((i) => ({ team: i.team, player: i.player, position: i.position, designation: i.designation, injury: i.injury }))
}

function divisional(sport: Sport, a: string, h: string): boolean {
  if (sport === 'nfl') return !!NFL_TEAM_DIVISIONS[a] && NFL_TEAM_DIVISIONS[a] === NFL_TEAM_DIVISIONS[h]
  if (sport === 'nba') return !!NBA_TEAM_DIVISIONS[a] && NBA_TEAM_DIVISIONS[a] === NBA_TEAM_DIVISIONS[h]
  if (sport === 'nhl') return !!NHL_TEAM_DIVISIONS[a] && NHL_TEAM_DIVISIONS[a] === NHL_TEAM_DIVISIONS[h]
  return false
}

async function weatherFor(sport: Sport, gameId: string, home: string, startTime: string | null, mlb: MlbGameInfo | null): Promise<GameContext['weather']> {
  // Indoor sports never get a forecast.
  if (ALWAYS_INDOOR.has(sport)) return null
  const indoorWx = { tempF: null, windMph: null, windDirection: null, precipitation: false, indoor: true }
  try {
    let city: string | null = null
    if (sport === 'mlb') {
      if (mlbIndoors(mlb)) return indoorWx
      const w = mlb?.weather
      if (!w) return null
      return { tempF: w.tempF, windMph: w.windMph, windDirection: w.windDirection, precipitation: /rain|drizzle|snow|storm/i.test(w.condition), indoor: false }
    }
    if (sport === 'nfl') {
      const rows = await getNFLSchedule(currentSeasonYear('nfl')).catch(() => null)
      const row = rows?.find((r) => r.game_id === gameId)
      if (nflIndoors(home, row?.roof)) return indoorWx
      const list = await getTeamList('football', 'nfl')
      city = list?.find((t) => fromEspnAbbr('nfl', t.abbr) === home)?.location ?? null
    } else if (sport === 'cfb') {
      const s = await getGameSummary('football', 'college-football', gameId)
      if (s?.venue.indoor === true) return indoorWx
      city = s?.venue.city ? `${s.venue.city}${s.venue.state ? `,${s.venue.state},US` : ''}` : null
    } else {
      return null
    }
    if (!city) return null
    const w = await getVenueWeather(city, { gameTime: startTime })
    if (w.status !== 'ok') return null
    return { tempF: w.tempF, windMph: w.windMph, windDirection: null, precipitation: w.snow || w.currentlyRaining || (w.precipChancePct ?? 0) >= 60, indoor: false }
  } catch {
    return null
  }
}

/** Season win% for every team in the league, for splitting results by opponent quality. */
async function leagueWinPct(sport: Sport): Promise<Record<string, number>> {
  try {
    const ref = ESPN_REF[sport]
    const groups = await getStandings(ref.sport, ref.league)
    const out: Record<string, number> = {}
    for (const g of groups ?? [])
      for (const e of g.entries) {
        const w = e.nums.wins
        const l = e.nums.losses
        const t = e.nums.ties ?? 0
        const pct = e.nums.winPercent ?? (w !== undefined && l !== undefined && w + l + t > 0 ? w / (w + l + t) : undefined)
        if (pct !== undefined && (w ?? 0) + (l ?? 0) >= 4) out[e.abbr] = pct
      }
    return out
  } catch {
    return {}
  }
}

async function conferences(sport: Sport, teams: string[]): Promise<Record<string, string>> {
  if (sport !== 'cfb' && sport !== 'cbb') return {}
  const dir = await getCollegeDirectory(sport).catch(() => null)
  const out: Record<string, string> = {}
  for (const t of teams) {
    const c = dir?.byAbbr.get(t)?.conference
    if (c) out[t] = c
  }
  return out
}

/** Loads everything about one game that the evidence modules share. Cached an hour per game. */
export async function loadGameContext(sport: Sport, gameId: string, away: string, home: string): Promise<GameContext> {
  const out = await cached(`edges:ctx:${sport}:${gameId}`, 3600, async () => {
    const cur = currentSeasonYear(sport)
    const ref = ESPN_REF[sport]
    const [oddsRes, awayCur, homeCur, awayPrev, homePrev, injuriesAll, defense] = await Promise.all([
      getGameOdds(sport, gameId, { away, home }).catch(() => null),
      teamRecords(sport, away, [cur]),
      teamRecords(sport, home, [cur]),
      teamRecords(sport, away, [cur - 1, cur - 2]),
      teamRecords(sport, home, [cur - 1, cur - 2]),
      getInjuries(ref.sport, ref.league).catch(() => null),
      defenseTables(sport).catch(() => ({}) as Record<string, Record<string, DefenseRank>>),
    ])
    const odds = oddsRes
    const startTime = odds?.commenceTime ?? null
    const mlb = sport === 'mlb' ? await loadMlbGameInfo(gameId) : null
    const [season, winLeague] = await Promise.all([detectGameContext({ sport, gameId, startTime }), leagueWinPct(sport)])
    const results = { [away]: [...awayCur, ...awayPrev], [home]: [...homeCur, ...homePrev] }
    // College conferences for both teams and every opponent they have met (conference-game records need the opponent's).
    const conf = await conferences(sport, Array.from(new Set([away, home, ...results[away].map((g) => g.opp), ...results[home].map((g) => g.opp)])))
    const priorSeasonOnly = awayCur.length === 0 && homeCur.length === 0
    const winMin = minimumsFor({ sport, results, home }).winPct
    const winPct: Record<string, number> = {}
    for (const [abbr, games] of Object.entries(results)) {
      const season = games.filter((g) => g.season === Math.max(...games.map((x) => x.season), 0))
      if (season.length >= winMin) winPct[abbr] = season.filter((g) => g.us > g.them).length / season.length
    }
    const restFor = (games: TeamGameRecord[]) => {
      const last = games[0]
      return last && startTime ? Math.max(0, Math.round((Date.parse(startTime) - Date.parse(last.date)) / 86400000) - 1) : null
    }
    const hour = startTime ? Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' }).format(new Date(startTime))) % 24 : 0
    const weekday = startTime ? new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/New_York' }).format(new Date(startTime)) : ''
    const injuries = injuryList(sport, [away, home], injuriesAll)
    const teammatesOut = await loadTeammatesOut(sport, injuries).catch(() => [])
    const facts: GameContext['facts'] = {}
    if (!season.isPreseason) {
      const run = async <T,>(f: () => Promise<T | null> | T | null) => {
        try {
          return await f()
        } catch (err) {
          console.error(`[edges] ${sport} facts failed`, err)
          return null
        }
      }
      facts.lines = await run(() => loadLineFacts(sport, away, home, currentSeasonYear(sport), winLeague, conf))
      if (sport === 'mlb') facts.mlb = await run(() => loadMlbGameFacts(mlb, away, home, injuries))
      else if (sport === 'nfl') facts.nfl = await run(() => loadNflGameFacts(away, home, currentSeasonYear('nfl')))
      else if (sport === 'nhl') facts.nhl = await run(() => loadNhlGameFacts(away, home, startTime))
      else if (sport === 'nba') facts.nba = loadNbaGameFacts({ away, home, results, startTime })
    }
    const ctx: GameContext = {
      sport,
      gameId,
      away,
      home,
      startTime,
      neutral: false,
      odds,
      results,
      injuries,
      teammatesOut,
      defense,
      rest: { [away]: restFor(awayCur.length ? awayCur : awayPrev), [home]: restFor(homeCur.length ? homeCur : homePrev) },
      winPct,
      weather: await weatherFor(sport, gameId, home, startTime, mlb),
      flags: { divisional: divisional(sport, away, home), primetime: (sport === 'nfl' || sport === 'cfb') && (hour >= 19 || weekday === 'Thu' || weekday === 'Mon'), rivalry: null },
      priorSeasonOnly,
      season: { ...season, phase: seasonPhase(sport, gamesPlayed({ results, home }), season.isPlayoffs) },
      mlb,
      facts,
      leagueWinPct: winLeague,
      conference: conf,
      lineMove: null,
    }
    // The game picture every bet in this game reads (styles, quality-adjusted form, venue history, weather impact, roster).
    ctx.foundation = await buildGameFoundation(ctx).catch((err) => {
      console.error(`[edges] ${sport} foundation failed`, err)
      return undefined
    })
    return ctx
  })
  return out as GameContext
}
