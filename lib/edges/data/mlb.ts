import { getMlbTeamsIndex } from '@/lib/mlb/teams'
import { cached } from '@/lib/net/ttlCache'
import { getTeamLinedGames } from '@/lib/odds/history'
import { slugify } from '@/lib/players/slug'
import { mapWithConcurrency } from '@/lib/utils/concurrency'
import { q } from '../evidenceFramework'
import { daysSince } from '../historicalRates'
import type { ModuleInput } from '../modules/shared'
import type { Edge, GameContext, ModuleOutput } from '../types'
import { loadMlbGameInfo, type MlbGameInfo } from './mlbGame'

/**
 * MLB data connections. Everything here comes from the MLB Stats API (statsapi.mlb.com): starter game logs including
 * postseason starts, splits, career lines against tonight's opponent; the announced lineup's platoon splits and career
 * numbers against tonight's starter; team form over the last 7 and 15 days; series status; and bullpen usage from the
 * boxscores of the series games already played. Nothing is invented: a fact is only produced when its call returned data.
 */

const API = 'https://statsapi.mlb.com/api/v1'

async function get<T>(url: string, revalidate = 21600): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate } })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

/** "6.2" innings means six and two thirds. */
const ip = (s: string | number | undefined) => {
  const [w, f] = String(s ?? '0').split('.')
  return Number(w) + Number(f ?? 0) / 3
}
const mdY = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`
const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * 86400000)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PitchSplit {
  ip: number
  era: number
  k9: number
  whip: number
  kPct: number
  bf: number
}

export interface StartLine {
  date: string
  opp: string
  ip: number
  h: number
  er: number
  bb: number
  k: number
  win: boolean
  home: boolean
  playoff: boolean
}

export interface StarterFacts {
  id: number
  name: string
  slug: string
  hand: 'L' | 'R' | null
  /** Newest first, regular season and postseason together. */
  starts: StartLine[]
  season: PitchSplit | null
  splits: Partial<Record<'vl' | 'vr' | 'h' | 'a' | 'd' | 'n', PitchSplit>>
  /** Career against tonight's opponent: the line opposing hitters have put up against him. */
  vsTeam: { games: number; pa: number; kPct: number; avg: number; ops: string } | null
  restDays: number | null
}

export interface BatterFacts {
  id: number
  name: string
  side: 'L' | 'R' | 'S' | null
  vsHand: { pa: number; k: number; avg: number } | null
  vsPitcher: { pa: number; ab: number; h: number; k: number; hr: number } | null
}

export interface LineupFacts {
  team: string
  /** The starter this lineup faces tonight. */
  facing: { id: number; name: string; hand: 'L' | 'R' | null }
  batters: BatterFacts[]
  kPctVsHand: number | null
  paVsHand: number
  lefties: number
  righties: number
  switches: number
  /** Starters with at least five career plate appearances against the starter. */
  facedCount: number
  facedPa: number
  facedAvg: number | null
  facedKPct: number | null
}

export interface TeamRecent {
  days: number
  games: number
  runsPerGame: number
  avg: number
  kPct: number
}

export interface BullpenFacts {
  team: string
  /** Relief innings thrown in the series games already played. */
  seriesInnings: number
  games: number
  lastTwoDaysInnings: number
  /** Relievers who threw yesterday. */
  usedYesterday: string[]
}

export interface SeriesFacts {
  description: string
  short: string
  result: string
  gameNumber: number
  totalGames: number
  leader: string | null
  leaderWins: number
  trailWins: number
  isOver: boolean
}

/** A team's hitting against left- and right-handed pitching this season (team-level, the stored stat behind the lineup view). */
export interface TeamHandSplits {
  vl: { kPct: number; avg: number; ops: string; pa: number } | null
  vr: { kPct: number; avg: number; ops: string; pa: number } | null
}

export interface MlbGameFacts {
  teamVsHand: { away: TeamHandSplits; home: TeamHandSplits }
  series: SeriesFacts | null
  starters: { away: StarterFacts | null; home: StarterFacts | null }
  lineups: { away: LineupFacts | null; home: LineupFacts | null }
  bullpen: { away: BullpenFacts | null; home: BullpenFacts | null }
  recent: { away: { d7: TeamRecent | null; d15: TeamRecent | null }; home: { d7: TeamRecent | null; d15: TeamRecent | null } }
  /** Over results across each team's last lined games (only when closing lines are on file). */
  overs: { away: { over: number; of: number } | null; home: { over: number; of: number } | null }
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

interface RawStat {
  inningsPitched?: string
  hits?: number
  earnedRuns?: number
  baseOnBalls?: number
  strikeOuts?: number
  battersFaced?: number
  gamesStarted?: number
  plateAppearances?: number
  atBats?: number
  homeRuns?: number
  avg?: string
  runs?: number
}
interface RawSplit {
  date?: string
  isHome?: boolean
  isWin?: boolean
  season?: string
  split?: { code?: string }
  opponent?: { id: number }
  stat: RawStat
}
type StatsResp = { stats?: { splits?: RawSplit[] }[] }

const splitsOf = (r: StatsResp | null) => r?.stats?.[0]?.splits ?? []

function toSplit(s: RawStat): PitchSplit | null {
  const inn = ip(s.inningsPitched)
  if (inn <= 0) return null
  const bf = s.battersFaced ?? 0
  return { ip: inn, era: ((s.earnedRuns ?? 0) * 9) / inn, k9: ((s.strikeOuts ?? 0) * 9) / inn, whip: ((s.hits ?? 0) + (s.baseOnBalls ?? 0)) / inn, kPct: bf > 0 ? ((s.strikeOuts ?? 0) / bf) * 100 : 0, bf }
}

export async function loadStarterFacts(id: number, name: string, opponentTeamId: number, officialDate: string, year: number): Promise<StarterFacts> {
  return (
    (await cached(`edges:mlbstarter:${id}:${opponentTeamId}:${officialDate}`, 6 * 3600, async () => {
      const teams = await getMlbTeamsIndex().catch(() => null)
      const [person, reg, post, splits, season, vs] = await Promise.all([
        get<{ people?: { pitchHand?: { code?: string } }[] }>(`${API}/people/${id}?fields=people,id,pitchHand,code`),
        get<StatsResp>(`${API}/people/${id}/stats?stats=gameLog&group=pitching&season=${year}`),
        get<StatsResp>(`${API}/people/${id}/stats?stats=gameLog&group=pitching&season=${year}&gameType=P`),
        get<StatsResp>(`${API}/people/${id}/stats?stats=statSplits&group=pitching&sitCodes=vl,vr,h,a,d,n&season=${year}`),
        get<StatsResp>(`${API}/people/${id}/stats?stats=season&group=pitching&season=${year}`),
        get<StatsResp>(`${API}/people/${id}/stats?stats=vsTeam&group=pitching&opposingTeamId=${opponentTeamId}`),
      ])
      const h = person?.people?.[0]?.pitchHand?.code
      const toLine = (s: RawSplit, playoff: boolean): StartLine | null => {
        if ((s.stat.gamesStarted ?? 0) < 1) return null
        return { date: s.date ?? '', opp: teams?.get(s.opponent?.id ?? 0)?.abbr ?? '', ip: ip(s.stat.inningsPitched), h: s.stat.hits ?? 0, er: s.stat.earnedRuns ?? 0, bb: s.stat.baseOnBalls ?? 0, k: s.stat.strikeOuts ?? 0, win: !!s.isWin, home: !!s.isHome, playoff }
      }
      // Starts before tonight only: a game already under way must not feed its own evidence.
      const starts = [...splitsOf(reg).map((s) => toLine(s, false)), ...splitsOf(post).map((s) => toLine(s, true))].filter((x): x is StartLine => x !== null && x.date < officialDate).sort((a, b) => b.date.localeCompare(a.date))
      const sp: StarterFacts['splits'] = {}
      for (const s of splitsOf(splits)) {
        const code = s.split?.code as keyof StarterFacts['splits'] | undefined
        const v = toSplit(s.stat)
        if (code && v) sp[code] = v
      }
      const vsStat = splitsOf(vs)[0]?.stat as (RawStat & { gamesPlayed?: number; ops?: string }) | undefined
      const lastStart = starts.find((s) => s.date < officialDate)
      return {
        id,
        name,
        slug: slugify(name),
        hand: h === 'L' || h === 'R' ? h : null,
        starts,
        season: splitsOf(season)[0] ? toSplit(splitsOf(season)[0].stat) : null,
        splits: sp,
        vsTeam: vsStat && (vsStat.plateAppearances ?? 0) >= 20 ? { games: vsStat.gamesPlayed ?? 0, pa: vsStat.plateAppearances ?? 0, kPct: ((vsStat.strikeOuts ?? 0) / (vsStat.plateAppearances ?? 1)) * 100, avg: Number(vsStat.avg ?? 0), ops: vsStat.ops ?? '' } : null,
        restDays: lastStart ? Math.round((Date.parse(officialDate) - Date.parse(lastStart.date)) / 86400000) - 1 : null,
      } satisfies StarterFacts
    })) ?? { id, name, slug: slugify(name), hand: null, starts: [], season: null, splits: {}, vsTeam: null, restDays: null }
  )
}

export async function loadLineupFacts(team: string, batters: { id: number; name: string }[], facing: { id: number; name: string; hand: 'L' | 'R' | null }, year: number): Promise<LineupFacts | null> {
  if (batters.length < 8) return null
  return cached(`edges:mlblineup:${team}:${facing.id}:${batters.map((b) => b.id).join('-')}`, 6 * 3600, async () => {
    const sides = await get<{ people?: { id: number; batSide?: { code?: string } }[] }>(`${API}/people?personIds=${batters.map((b) => b.id).join(',')}&fields=people,id,batSide,code`)
    const sideOf = new Map((sides?.people ?? []).map((p) => [p.id, p.batSide?.code]))
    const rows = await mapWithConcurrency(batters, 5, async (b): Promise<BatterFacts> => {
      const [sp, vs] = await Promise.all([
        facing.hand ? get<StatsResp>(`${API}/people/${b.id}/stats?stats=statSplits&group=hitting&sitCodes=${facing.hand === 'L' ? 'vl' : 'vr'}&season=${year}`) : Promise.resolve(null),
        get<StatsResp>(`${API}/people/${b.id}/stats?stats=vsPlayer&group=hitting&opposingPlayerId=${facing.id}`),
      ])
      const s = splitsOf(sp)[0]?.stat
      const v = splitsOf(vs)[0]?.stat
      const c = sideOf.get(b.id)
      return {
        id: b.id,
        name: b.name,
        side: c === 'L' || c === 'R' || c === 'S' ? c : null,
        vsHand: s ? { pa: s.plateAppearances ?? 0, k: s.strikeOuts ?? 0, avg: Number(s.avg ?? 0) } : null,
        vsPitcher: v ? { pa: v.plateAppearances ?? 0, ab: v.atBats ?? 0, h: v.hits ?? 0, k: v.strikeOuts ?? 0, hr: v.homeRuns ?? 0 } : null,
      }
    })
    // A switch hitter bats from the side opposite the pitcher's hand, so against a lefty he is a righty.
    const lefties = rows.filter((r) => r.side === 'L' || (r.side === 'S' && facing.hand === 'R')).length
    const switches = rows.filter((r) => r.side === 'S').length
    const righties = rows.filter((r) => r.side === 'R' || (r.side === 'S' && facing.hand === 'L')).length
    const pa = rows.reduce((n, r) => n + (r.vsHand?.pa ?? 0), 0)
    const k = rows.reduce((n, r) => n + (r.vsHand?.k ?? 0), 0)
    const faced = rows.filter((r) => (r.vsPitcher?.pa ?? 0) >= 5)
    const fPa = faced.reduce((n, r) => n + (r.vsPitcher?.pa ?? 0), 0)
    const fAb = faced.reduce((n, r) => n + (r.vsPitcher?.ab ?? 0), 0)
    const fH = faced.reduce((n, r) => n + (r.vsPitcher?.h ?? 0), 0)
    const fK = faced.reduce((n, r) => n + (r.vsPitcher?.k ?? 0), 0)
    return {
      team,
      facing,
      batters: rows,
      kPctVsHand: pa >= 150 ? (k / pa) * 100 : null,
      paVsHand: pa,
      lefties,
      righties,
      switches,
      facedCount: faced.length,
      facedPa: fPa,
      facedAvg: fAb > 0 ? fH / fAb : null,
      facedKPct: fPa > 0 ? (fK / fPa) * 100 : null,
    } satisfies LineupFacts
  })
}

export async function loadTeamHandSplits(teamId: number, year: number): Promise<TeamHandSplits> {
  return (
    (await cached(`edges:mlbteamhand:${teamId}:${year}`, 6 * 3600, async () => {
      const r = await get<StatsResp>(`${API}/teams/${teamId}/stats?stats=statSplits&group=hitting&sitCodes=vl,vr&season=${year}`)
      const pick = (code: string) => {
        const s = splitsOf(r).find((x) => x.split?.code === code)?.stat as (RawStat & { ops?: string }) | undefined
        const pa = s?.plateAppearances ?? 0
        return s && pa >= 100 ? { kPct: ((s.strikeOuts ?? 0) / pa) * 100, avg: Number(s.avg ?? 0), ops: s.ops ?? '', pa } : null
      }
      return { vl: pick('vl'), vr: pick('vr') } satisfies TeamHandSplits
    })) ?? { vl: null, vr: null }
  )
}

export async function loadTeamRecent(teamId: number, officialDate: string, days: number, year: number): Promise<TeamRecent | null> {
  return cached(`edges:mlbrecent:${teamId}:${officialDate}:${days}`, 3 * 3600, async () => {
    const r = await get<StatsResp>(`${API}/teams/${teamId}/stats?stats=byDateRange&group=hitting&startDate=${mdY(addDays(officialDate, -days))}&endDate=${mdY(addDays(officialDate, -1))}&season=${year}&gameType=R,D,L,W,F`, 3 * 3600)
    const s = splitsOf(r)[0]?.stat as (RawStat & { gamesPlayed?: number }) | undefined
    if (!s || !s.gamesPlayed) return null
    const pa = s.plateAppearances ?? 0
    return { days, games: s.gamesPlayed, runsPerGame: (s.runs ?? 0) / s.gamesPlayed, avg: Number(s.avg ?? 0), kPct: pa > 0 ? ((s.strikeOuts ?? 0) / pa) * 100 : 0 }
  })
}

interface Boxscore {
  teams?: Record<'away' | 'home', { team?: { id: number }; pitchers?: number[]; players?: Record<string, { person?: { fullName?: string }; stats?: { pitching?: { inningsPitched?: string; numberOfPitches?: number } } }> }>
}

/** Relief usage in the series games already played, from each game's boxscore (final games never change, so cached long). */
export async function loadBullpens(info: MlbGameInfo, away: string, home: string): Promise<{ away: BullpenFacts | null; home: BullpenFacts | null }> {
  if (!info.series || info.gameType === 'R') return { away: null, home: null }
  return (
    (await cached(`edges:mlbpen:${info.teamIds.away}:${info.teamIds.home}:${info.officialDate}`, 3600, async () => {
      const sched = await get<{ dates?: { date: string; games: { gamePk: number; officialDate: string; seriesDescription?: string; status: { abstractGameState: string }; teams: { away: { team: { id: number } }; home: { team: { id: number } } } }[] }[] }>(
        `${API}/schedule?sportId=1&teamId=${info.teamIds.away}&startDate=${addDays(info.officialDate, -10).toISOString().slice(0, 10)}&endDate=${addDays(info.officialDate, -1).toISOString().slice(0, 10)}&gameType=D,L,W,F`,
        1800
      )
      const games = (sched?.dates ?? [])
        .flatMap((d) => d.games)
        .filter((g) => g.status.abstractGameState === 'Final' && g.seriesDescription === info.seriesDescription && [g.teams.away.team.id, g.teams.home.team.id].includes(info.teamIds.home))
      if (games.length === 0) return { away: null, home: null }
      const boxes = await mapWithConcurrency(games, 3, async (g) => ({ g, box: (await get<Boxscore>(`${API}/game/${g.gamePk}/boxscore`, 86400)) ?? (await get<Boxscore>(`${API}/game/${g.gamePk}/boxscore`, 0)) }))
      // A missing boxscore would understate the workload, so the whole read is skipped (and not cached) rather than half-reported.
      if (boxes.some((b) => !b.box)) return null
      const build = (teamId: number, label: string): BullpenFacts => {
        let seriesInnings = 0
        let lastTwo = 0
        const yesterday = new Set<string>()
        for (const { g, box } of boxes) {
          const side = box?.teams?.away?.team?.id === teamId ? 'away' : 'home'
          const t = box?.teams?.[side]
          if (!t?.pitchers) continue
          const daysBefore = Math.round((Date.parse(info.officialDate) - Date.parse(g.officialDate)) / 86400000)
          t.pitchers.slice(1).forEach((pid) => {
            const p = t.players?.[`ID${pid}`]
            const inn = ip(p?.stats?.pitching?.inningsPitched)
            seriesInnings += inn
            if (daysBefore <= 2) lastTwo += inn
            if (daysBefore === 1 && p?.person?.fullName) yesterday.add(p.person.fullName)
          })
        }
        return { team: label, seriesInnings, games: boxes.length, lastTwoDaysInnings: lastTwo, usedYesterday: Array.from(yesterday) }
      }
      return { away: build(info.teamIds.away, away), home: build(info.teamIds.home, home) }
    })) ?? { away: null, home: null }
  )
}

async function overRecord(abbr: string, year: number): Promise<{ over: number; of: number } | null> {
  const lined = await getTeamLinedGames('mlb', abbr, year, 10).catch(() => null)
  const last = (lined ?? []).filter((g) => g.line?.total != null).slice(-10)
  if (last.length < 8) return null
  return { over: last.filter((g) => g.awayScore + g.homeScore > (g.line!.total as number)).length, of: last.length }
}

export async function loadMlbGameFacts(info: MlbGameInfo | null, away: string, home: string): Promise<MlbGameFacts | null> {
  if (!info) return null
  const year = Number(info.officialDate.slice(0, 4)) || new Date().getUTCFullYear()
  const { probables, teamIds, lineupPlayers } = info
  const [sAway, sHome] = await Promise.all([
    probables.away ? loadStarterFacts(probables.away.id, probables.away.name, teamIds.home, info.officialDate, year) : Promise.resolve(null),
    probables.home ? loadStarterFacts(probables.home.id, probables.home.name, teamIds.away, info.officialDate, year) : Promise.resolve(null),
  ])
  const [lAway, lHome, pens, awayD7, awayD15, homeD7, homeD15, oAway, oHome, tAway, tHome] = await Promise.all([
    sHome ? loadLineupFacts(away, lineupPlayers.away, { id: sHome.id, name: sHome.name, hand: sHome.hand }, year) : Promise.resolve(null),
    sAway ? loadLineupFacts(home, lineupPlayers.home, { id: sAway.id, name: sAway.name, hand: sAway.hand }, year) : Promise.resolve(null),
    loadBullpens(info, away, home),
    loadTeamRecent(teamIds.away, info.officialDate, 7, year),
    loadTeamRecent(teamIds.away, info.officialDate, 15, year),
    loadTeamRecent(teamIds.home, info.officialDate, 7, year),
    loadTeamRecent(teamIds.home, info.officialDate, 15, year),
    overRecord(away, year),
    overRecord(home, year),
    loadTeamHandSplits(teamIds.away, year),
    loadTeamHandSplits(teamIds.home, year),
  ])
  const s = info.series
  const series: SeriesFacts | null = s
    ? { description: s.description, short: s.short, result: s.result, gameNumber: s.gameNumber, totalGames: s.totalGames, leader: s.leaderId === null ? null : s.leaderId === teamIds.away ? away : home, leaderWins: s.wins, trailWins: s.losses, isOver: s.isOver }
    : null
  return { teamVsHand: { away: tAway, home: tHome }, series, starters: { away: sAway, home: sHome }, lineups: { away: lAway, home: lHome }, bullpen: pens, recent: { away: { d7: awayD7, d15: awayD15 }, home: { d7: homeD7, d15: homeD15 } }, overs: { away: oAway, home: oHome } }
}

export { loadMlbGameInfo }

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

const f1 = (n: number) => n.toFixed(1)
const avgText = (a: number) => a.toFixed(3).replace(/^0/, '')
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)

function leagueKPct(game: GameContext): number | null {
  const vals = Object.values(game.defense)
    .map((d) => d['Strikeout rate']?.value)
    .filter((v): v is number => typeof v === 'number')
  return vals.length >= 20 ? mean(vals) : null
}

/** Evidence for a pitcher's strikeout prop: the last five starts, the lineup he faces, and how he does in this setting. */
export function getStarterEvidence({ outcome: o, game }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  const facts = game.facts.mlb
  if (!facts || o.type !== 'player_prop' || o.category !== 'Strikeouts' || o.threshold === undefined || !o.player) return { edges, conflicts }
  const over = o.direction !== 'under'
  const line = o.threshold
  const slug = slugify(o.player.name)
  const side = facts.starters.away?.slug === slug ? 'away' : facts.starters.home?.slug === slug ? 'home' : null
  const starter = side ? facts.starters[side] : null
  if (!side || !starter) return { edges, conflicts }
  const oppSide = side === 'away' ? 'home' : 'away'
  const opp = oppSide === 'home' ? game.home : game.away
  const nounLine = `${over ? 'Over' : 'Under'} ${line}`

  // 1. Last five starts, with innings, so the strikeout totals are read against how deep he goes.
  const last5 = starter.starts.slice(0, 5)
  if (last5.length >= 3) {
    const ks = last5.map((s) => s.k)
    const hits = ks.filter((k) => (over ? k > line : k < line)).length
    const age = daysSince(last5[0].date)
    const post = last5.filter((s) => s.playoff).length
    if (hits / last5.length >= 0.6 || (over ? mean(ks) > line : mean(ks) < line)) {
      edges.push({
        description: `Last ${last5.length} starts: ${ks.join(', ')} strikeouts (most recent first), clearing ${nounLine} in ${hits} of ${last5.length}, averaging ${f1(mean(last5.map((s) => s.ip)))} innings per start${post ? ` (${post} in the postseason)` : ''}`,
        category: 'recent_form',
        horizon: 'last30',
        layer: 'statistical',
        relevanceScore: Math.min(1, 0.4 + (hits / last5.length - 0.5) * 1.2),
        supportingData: last5.map((s) => `${s.k} K, ${f1(s.ip)} IP vs ${s.opp}`).join(' · '),
        weight: 0.18,
        ageDays: age,
        quality: q(3, 3, 3, last5.length >= 5 ? 1 : 0),
        sample: last5.length,
        metrics: { rate: hits / last5.length, avg: mean(ks), n: last5.length },
      })
    } else if (hits / last5.length <= 0.2) conflicts++
  }

  // 2. The lineup he faces tonight, against his handedness.
  const lineup = facts.lineups[oppSide]
  const base = leagueKPct(game)
  // No lineup posted yet: the team's strikeout rate against this handedness stands in.
  const teamHand = starter.hand ? facts.teamVsHand[oppSide][starter.hand === 'L' ? 'vl' : 'vr'] : null
  if ((!lineup || lineup.kPctVsHand == null) && teamHand && base !== null && starter.hand) {
    const gap = teamHand.kPct - base
    if ((over && gap >= 1.5) || (!over && gap <= -1.5)) {
      edges.push({
        description: `${opp} strikes out in ${f1(teamHand.kPct)}% of plate appearances against ${starter.hand === 'L' ? 'left-handed' : 'right-handed'} pitching this season (${teamHand.pa} PA) — ${f1(Math.abs(gap))} points ${gap > 0 ? 'above' : 'below'} the league rate of ${f1(base)}%; the lineup is not posted yet`,
        category: 'matchup',
        horizon: 'season',
        layer: 'opportunity',
        relevanceScore: Math.min(1, 0.5 + Math.abs(gap) / 8),
        supportingData: 'Team splits by pitcher handedness',
        weight: 0.18,
        quality: q(3, 3, 2, 3),
        sample: teamHand.pa,
      })
    } else if ((over && gap <= -1.5) || (!over && gap >= 1.5)) conflicts++
  }
  if (lineup?.kPctVsHand != null && base !== null && starter.hand) {
    const gap = lineup.kPctVsHand - base
    const handWord = starter.hand === 'L' ? 'left-handed' : 'right-handed'
    const mix = `${lineup.lefties} of ${lineup.batters.length} bat left-handed against ${starter.hand === 'L' ? 'a lefty' : 'a righty'}`
    if ((over && gap >= 1.5) || (!over && gap <= -1.5)) {
      edges.push({
        description: `${opp}'s announced lineup strikes out in ${f1(lineup.kPctVsHand)}% of plate appearances against ${handWord} pitching (${lineup.paVsHand} PA this season) — ${f1(Math.abs(gap))} points ${gap > 0 ? 'above' : 'below'} the league rate of ${f1(base)}%; ${mix}`,
        category: 'matchup',
        horizon: 'tonight',
        layer: 'opportunity',
        relevanceScore: Math.min(1, 0.55 + Math.abs(gap) / 8),
        supportingData: 'Tonight\'s lineup, season splits against this handedness',
        weight: 0.24,
        quality: q(3, 3, 3, lineup.paVsHand >= 400 ? 3 : 2),
        sample: lineup.paVsHand,
        metrics: { rate: lineup.kPctVsHand / 100, n: lineup.paVsHand },
      })
    } else if ((over && gap <= -1.5) || (!over && gap >= 1.5)) conflicts++
  }

  // 3. Career numbers of tonight's batters against him.
  if (lineup && lineup.facedCount >= 3 && lineup.facedPa >= 20 && lineup.facedAvg !== null && lineup.facedKPct !== null) {
    const supportsOver = lineup.facedKPct >= 25 || lineup.facedAvg <= 0.22
    const supportsUnder = lineup.facedKPct <= 17 || lineup.facedAvg >= 0.285
    if ((over && supportsOver) || (!over && supportsUnder)) {
      edges.push({
        description: `${lineup.facedCount} of ${lineup.batters.length} starters have faced ${starter.name} (${lineup.facedPa} career plate appearances) — the group is batting ${avgText(lineup.facedAvg)} with a ${f1(lineup.facedKPct)}% strikeout rate in those matchups`,
        category: 'h2h',
        horizon: 'career_vs_opp',
        layer: 'statistical',
        relevanceScore: Math.min(1, 0.5 + lineup.facedPa / 200),
        supportingData: 'Career batter-vs-pitcher results, minimum five plate appearances each',
        weight: 0.14,
        seasonsAgo: 1,
        quality: q(3, 3, 1, lineup.facedPa >= 40 ? 3 : 2),
        sample: lineup.facedPa,
        metrics: { rate: lineup.facedKPct / 100, avg: lineup.facedAvg, n: lineup.facedPa },
      })
    } else if ((over && supportsUnder) || (!over && supportsOver)) conflicts++
  }

  // 4. His best-supported context split: home/road, day/night.
  const season = starter.season
  if (season && season.ip >= 25) {
    const picks: { label: string; sp: PitchSplit | undefined }[] = [
      { label: starter.hand && game.home === o.player.team ? 'at home' : 'on the road', sp: starter.splits[game.home === o.player.team ? 'h' : 'a'] },
    ]
    const best = picks.filter((p) => p.sp && p.sp.ip >= 20).map((p) => ({ ...p, gap: (p.sp!.k9 - season.k9) / season.k9 })).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0]
    if (best && ((over && best.gap >= 0.12) || (!over && best.gap <= -0.12))) {
      edges.push({
        description: `${best.label.charAt(0).toUpperCase()}${best.label.slice(1)} this season ${starter.name} strikes out ${f1(best.sp!.k9)} per nine over ${f1(best.sp!.ip)} innings, against ${f1(season.k9)} overall`,
        category: 'hit_rate',
        horizon: 'season',
        layer: 'statistical',
        relevanceScore: Math.min(1, 0.45 + Math.abs(best.gap)),
        supportingData: `${f1(best.sp!.era)} ERA in this split`,
        weight: 0.1,
        quality: q(3, 2, 2, best.sp!.ip >= 40 ? 3 : 2),
        sample: Math.round(best.sp!.ip),
      })
    }
  }

  // 5. Career against tonight's team.
  const vs = starter.vsTeam
  if (vs && vs.games >= 2 && season && season.kPct > 0) {
    const gap = (vs.kPct - season.kPct) / season.kPct
    if ((over && gap >= 0.1) || (!over && gap <= -0.1)) {
      edges.push({
        description: `In ${vs.games} career games against ${opp}, hitters have batted ${avgText(vs.avg)} against ${starter.name} with a ${f1(vs.kPct)}% strikeout rate over ${vs.pa} plate appearances (${f1(season.kPct)}% this season)`,
        category: 'h2h',
        horizon: 'career_vs_opp',
        layer: 'statistical',
        relevanceScore: Math.min(1, 0.45 + Math.abs(gap)),
        supportingData: 'Career, all seasons',
        weight: 0.12,
        seasonsAgo: 1,
        quality: q(3, 3, 1, vs.pa >= 60 ? 3 : 2),
        sample: vs.games,
      })
    }
  }

  // 6. Rest.
  if (starter.restDays !== null && starter.restDays <= 3) {
    if (!over) edges.push({ description: `${starter.name} is working on ${starter.restDays} days of rest — shorter rest tends to cut innings and strikeouts`, category: 'situational', horizon: 'tonight', layer: 'situational', relevanceScore: 0.6, supportingData: 'Days since his last start', weight: 0.1, ageDays: 0, quality: q(3, 3, 3, 1) })
    else conflicts++
  }

  // 7. Opposing team's strikeout rate over the last 15 days, against its season rate.
  const rec = facts.recent[oppSide].d15
  const seasonK = game.defense[opp]?.['Strikeout rate']?.value
  if (rec && seasonK !== undefined && rec.games >= 5) {
    const gap = rec.kPct - seasonK
    if ((over && gap >= 1.5) || (!over && gap <= -1.5)) {
      edges.push({
        description: `${opp} has struck out in ${f1(rec.kPct)}% of plate appearances over its last ${rec.games} games, ${gap > 0 ? 'up from' : 'down from'} ${f1(seasonK)}% for the season`,
        category: 'recent_form',
        horizon: 'last15',
        layer: 'statistical',
        relevanceScore: Math.min(1, 0.45 + Math.abs(gap) / 8),
        supportingData: 'Team hitting, last 15 days',
        weight: 0.1,
        ageDays: 1,
        quality: q(3, 2, 3, 1),
        sample: rec.games,
      })
    }
  }
  return { edges, conflicts }
}

/** Team-level evidence for moneyline, run line and total: series state, bullpens, the two starters and recent scoring. */
export function getTeamGameContext({ outcome: o, game }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  const facts = game.facts.mlb
  if (!facts || (o.type !== 'moneyline' && o.type !== 'spread' && o.type !== 'total')) return { edges, conflicts }
  const team = o.team?.abbr
  const opp = o.team?.opponent
  const sideOf = (abbr: string) => (abbr === game.away ? 'away' : 'home') as 'away' | 'home'

  if (o.type !== 'total' && team && opp) {
    const mine = sideOf(team)
    const theirs = sideOf(opp)

    // Series state.
    const s = facts.series
    if (s && !s.isOver && s.leader) {
      const leading = s.leader === team
      if (leading) {
        const pen = facts.bullpen[theirs]
        const rest = pen && pen.lastTwoDaysInnings >= 4 ? `; ${opp}'s bullpen has thrown ${f1(pen.lastTwoDaysInnings)} innings over the last two days` : ''
        edges.push({ description: `${team} leads the ${s.description || s.short} ${s.leaderWins}-${s.trailWins} heading into Game ${s.gameNumber}${rest}`, category: 'context', horizon: 'tonight', layer: 'situational', relevanceScore: 0.55 + Math.min(0.2, (s.leaderWins - s.trailWins) * 0.1), supportingData: `${s.description}, best of ${s.totalGames}`, weight: 0.1, ageDays: 0, quality: q(3, 2, 3, 1) })
      } else conflicts++
    }

    // Bullpens.
    const own = facts.bullpen[mine]
    const their = facts.bullpen[theirs]
    if (their && their.games >= 2 && their.lastTwoDaysInnings >= 5) {
      edges.push({ description: `${opp}'s bullpen has thrown ${f1(their.lastTwoDaysInnings)} innings over the last two days (${f1(their.seriesInnings)} across ${their.games} series games)${their.usedYesterday.length ? `, with ${their.usedYesterday.slice(0, 3).join(', ')} pitching yesterday` : ''} — a fatigue factor for late innings`, category: 'situational', horizon: 'tonight', layer: 'situational', relevanceScore: Math.min(1, 0.5 + their.lastTwoDaysInnings / 20), supportingData: 'Series boxscores', weight: 0.1, ageDays: 1, quality: q(3, 3, 3, 1) })
    }
    if (own && own.games >= 2 && own.lastTwoDaysInnings >= 6) conflicts++

    // Starter against starter, over each one's last five starts.
    const a = facts.starters[mine]
    const b = facts.starters[theirs]
    const era = (st: StarterFacts | null) => {
      const l = st?.starts.slice(0, 5) ?? []
      const inn = l.reduce((n, x) => n + x.ip, 0)
      return l.length >= 3 && inn > 0 ? { era: (l.reduce((n, x) => n + x.er, 0) * 9) / inn, ip: inn, n: l.length } : null
    }
    const ea = era(a)
    const eb = era(b)
    if (a && b && ea && eb && Math.abs(ea.era - eb.era) >= 1.5) {
      if (ea.era < eb.era) edges.push({ description: `${a.name} has a ${ea.era.toFixed(2)} ERA over his last ${ea.n} starts (${f1(ea.ip)} IP) against ${eb.era.toFixed(2)} for ${b.name} over his last ${eb.n}`, category: 'recent_form', horizon: 'last30', layer: 'statistical', relevanceScore: Math.min(1, 0.45 + (eb.era - ea.era) / 6), supportingData: 'Starting pitching, last five starts each', weight: 0.14, ageDays: 5, quality: q(3, 3, 3, 1), sample: Math.min(ea.n, eb.n) })
      else conflicts++
    }
    if (a?.restDays !== null && a?.restDays !== undefined && a.restDays <= 3) conflicts++
    if (b?.restDays !== null && b?.restDays !== undefined && b.restDays <= 3) edges.push({ description: `${b.name} starts for ${opp} on ${b.restDays} days of rest — velocity and endurance can suffer on short rest`, category: 'situational', horizon: 'tonight', layer: 'situational', relevanceScore: 0.55, supportingData: 'Days since his last start', weight: 0.08, ageDays: 0, quality: q(3, 3, 3, 1) })
  }

  // Totals: recent scoring on both sides, starters, bullpens and the over record.
  if (o.type === 'total' && o.threshold !== undefined) {
    const over = o.direction !== 'under'
    const fromResults = (abbr: string, n: number): TeamRecent | null => {
      const g = (game.results[abbr] ?? []).slice(0, n)
      return g.length >= 5 ? { days: 0, games: g.length, runsPerGame: mean(g.map((x) => x.us)), avg: 0, kPct: 0 } : null
    }
    const aR = facts.recent.away.d15 ?? fromResults(game.away, 15)
    const hR = facts.recent.home.d15 ?? fromResults(game.home, 15)
    const a7 = facts.recent.away.d7 ?? fromResults(game.away, 7)
    const h7 = facts.recent.home.d7 ?? fromResults(game.home, 7)
    if (aR && hR && aR.games >= 5 && hR.games >= 5) {
      const combined = aR.runsPerGame + hR.runsPerGame
      const gap = combined - o.threshold
      if ((over && gap >= 0.6) || (!over && gap <= -0.6)) {
        edges.push({
          description: `Over the last ${aR.games} and ${hR.games} games ${game.away} has scored ${f1(aR.runsPerGame)} and ${game.home} ${f1(hR.runsPerGame)} runs per game — ${f1(combined)} combined against a line of ${o.threshold}${a7 && h7 ? `; the last 7 days read ${f1(a7.runsPerGame)} and ${f1(h7.runsPerGame)}` : ''}`,
          category: 'recent_form',
          horizon: 'last15',
          layer: 'statistical',
          relevanceScore: Math.min(1, 0.45 + Math.abs(gap) / 4),
          supportingData: 'Team hitting by date range',
          weight: 0.14,
          ageDays: 1,
          quality: q(3, 2, 3, 1),
          sample: Math.min(aR.games, hR.games),
        })
      } else if ((over && gap <= -0.6) || (!over && gap >= 0.6)) conflicts++
    }
    const sa = facts.starters.away
    const sh = facts.starters.home
    const eraOf = (st: StarterFacts | null) => {
      const l = st?.starts.slice(0, 5) ?? []
      const inn = l.reduce((n, x) => n + x.ip, 0)
      return l.length >= 3 && inn > 0 ? (l.reduce((n, x) => n + x.er, 0) * 9) / inn : null
    }
    const ea = eraOf(sa)
    const eh = eraOf(sh)
    if (sa && sh && ea !== null && eh !== null) {
      if (!over && ea <= 3 && eh <= 3) edges.push({ description: `Both starters have been sharp lately: ${sa.name} ${ea.toFixed(2)} ERA and ${sh.name} ${eh.toFixed(2)} ERA over their last five starts`, category: 'recent_form', horizon: 'last30', layer: 'statistical', relevanceScore: 0.6, supportingData: 'Starting pitching, last five starts each', weight: 0.12, ageDays: 5, quality: q(3, 3, 3, 1) })
      else if (over && ea >= 4.5 && eh >= 4.5) edges.push({ description: `Neither starter has been sharp lately: ${sa.name} ${ea.toFixed(2)} ERA and ${sh.name} ${eh.toFixed(2)} ERA over their last five starts`, category: 'recent_form', horizon: 'last30', layer: 'statistical', relevanceScore: 0.6, supportingData: 'Starting pitching, last five starts each', weight: 0.12, ageDays: 5, quality: q(3, 3, 3, 1) })
      else if ((over && ea <= 3 && eh <= 3) || (!over && ea >= 4.5 && eh >= 4.5)) conflicts++
    }
    const pens = [facts.bullpen.away, facts.bullpen.home].filter((p): p is BullpenFacts => !!p && p.games >= 2)
    const tired = pens.filter((p) => p.lastTwoDaysInnings >= 5)
    if (over && tired.length > 0) edges.push({ description: `${tired.map((p) => `${p.team}'s bullpen (${f1(p.lastTwoDaysInnings)} innings over the last two days)`).join(' and ')} ${tired.length > 1 ? 'are' : 'is'} worn — a late-inning scoring factor`, category: 'situational', horizon: 'tonight', layer: 'situational', relevanceScore: 0.55, supportingData: 'Series boxscores', weight: 0.08, ageDays: 1, quality: q(3, 3, 3, 1) })
    const oa = facts.overs.away
    const oh = facts.overs.home
    if (oa && oh) {
      const rate = (oa.over + oh.over) / (oa.of + oh.of)
      if ((over && rate >= 0.62) || (!over && rate <= 0.38)) {
        edges.push({ description: `The ${over ? 'over' : 'under'} has hit in ${over ? oa.over + oh.over : oa.of + oh.of - oa.over - oh.over} of the last ${oa.of + oh.of} games for these two teams combined (${game.away} ${over ? oa.over : oa.of - oa.over} of ${oa.of}, ${game.home} ${over ? oh.over : oh.of - oh.over} of ${oh.of})`, category: 'recent_form', horizon: 'last15', layer: 'statistical', relevanceScore: Math.min(1, 0.4 + Math.abs(rate - 0.5) * 1.6), supportingData: 'Against each game\'s closing total', weight: 0.1, ageDays: 3, quality: q(3, 2, 3, 2), sample: oa.of + oh.of })
      }
    }
  }
  return { edges, conflicts }
}
