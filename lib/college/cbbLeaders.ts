import type { LeaderGroup, LeaderRow } from '@/data/leaders/types'
import { getCollegeDirectory } from '@/lib/college/directory'
import { getCollegeStandings } from '@/lib/college/standings'
import { getAllPlayerStats, getAllTeamStats, getPlayerGameLog, type AllPlayerStatsRow, type GameLogRow } from '@/lib/espn/api'
import type { BettingLeaderRow } from '@/lib/mlb/bettingLeaders'
import { cached } from '@/lib/net/ttlCache'
import { CBB_BETTING_CATEGORIES, CBB_BETTING_THRESHOLDS, CBB_GAME_CATEGORIES, CBB_SUBS } from './cbbProps'

export { CBB_BETTING_CATEGORIES, CBB_BETTING_THRESHOLDS, CBB_GAME_CATEGORIES, CBB_SUBS } from './cbbProps'

/**
 * College basketball leaderboards. Season boards come straight from ESPN's season totals; windowed and
 * betting boards are computed from the game logs of the top ~100 players (by scoring, rebounding, assists
 * and threes). When the new season hasn't started, everything is last season's, and says so.
 */

const SPORT = 'basketball' as const
const LEAGUE = 'mens-college-basketball' as const

export interface CbbSeasonInfo {
  /** ESPN season year the boards read (2026 = 2025-26). */
  season: number
  label: string
  /** True when the current season hasn't produced results and these are the previous season's. */
  lastSeason: boolean
}

export async function getCbbSeasonInfo(): Promise<CbbSeasonInfo> {
  const st = await getCollegeStandings('cbb').catch(() => null)
  const season = st?.season ?? (new Date().getUTCMonth() >= 6 ? new Date().getUTCFullYear() + 1 : new Date().getUTCFullYear())
  return { season, label: `${season - 1}-${String(season).slice(2)}`, lastSeason: st?.lastSeason ?? false }
}

// ---------------------------------------------------------------------------
// Player pool
// ---------------------------------------------------------------------------

const SORTS = ['offensive.points', 'general.rebounds', 'offensive.assists', 'offensive.threePointFieldGoalsMade', 'defensive.steals', 'defensive.blocks']

export async function playerPool(season: number): Promise<AllPlayerStatsRow[]> {
  const lists = await Promise.all(SORTS.map((sort) => getAllPlayerStats(SPORT, LEAGUE, { season, sort, limit: sort === 'offensive.points' ? 150 : 80 }).catch(() => null)))
  const byId = new Map<string, AllPlayerStatsRow>()
  for (const l of lists) for (const p of l ?? []) if (!byId.has(p.playerId)) byId.set(p.playerId, p)
  return Array.from(byId.values()).filter((p) => (p.stats['general.gamesPlayed'] ?? 0) >= 8)
}

const g = (p: AllPlayerStatsRow, key: string) => p.stats[key] ?? 0
const r1 = (x: number) => (Math.round(x * 10) / 10).toFixed(1)

interface Entry {
  name: string
  team: string
  value: number
  display: string
}

function toRows(entries: Entry[], limit: number, ascending = false): LeaderRow[] {
  return [...entries]
    .sort((a, b) => (ascending ? a.value - b.value : b.value - a.value))
    .slice(0, limit)
    .map((e, i) => ({ rank: i + 1, name: e.name, team: e.team, value: e.display, record: '—', hitPct: 0 }))
}

function seasonEntries(category: string, pool: AllPlayerStatsRow[]): Entry[] {
  const e = (p: AllPlayerStatsRow, value: number, display: string): Entry => ({ name: p.name, team: p.teamAbbr, value, display })
  const qualified = pool.filter((p) => g(p, 'general.gamesPlayed') >= 12)
  switch (category) {
    case 'PTS': return qualified.map((p) => e(p, g(p, 'offensive.avgPoints'), r1(g(p, 'offensive.avgPoints'))))
    case 'REB': return qualified.map((p) => e(p, g(p, 'general.avgRebounds'), r1(g(p, 'general.avgRebounds'))))
    case 'AST': return qualified.map((p) => e(p, g(p, 'offensive.avgAssists'), r1(g(p, 'offensive.avgAssists'))))
    case 'BLK': return qualified.map((p) => e(p, g(p, 'defensive.avgBlocks'), r1(g(p, 'defensive.avgBlocks'))))
    case 'STL': return qualified.map((p) => e(p, g(p, 'defensive.avgSteals'), r1(g(p, 'defensive.avgSteals'))))
    case 'FG%': return qualified.filter((p) => g(p, 'offensive.fieldGoalsAttempted') >= 150).map((p) => e(p, g(p, 'offensive.fieldGoalPct'), `${r1(g(p, 'offensive.fieldGoalPct'))}%`))
    case '3P%': return qualified.filter((p) => g(p, 'offensive.threePointFieldGoalsAttempted') >= 60).map((p) => e(p, g(p, 'offensive.threePointFieldGoalPct'), `${r1(g(p, 'offensive.threePointFieldGoalPct'))}%`))
    case 'FT%': return qualified.filter((p) => g(p, 'offensive.freeThrowsAttempted') >= 60).map((p) => e(p, g(p, 'offensive.freeThrowPct'), `${r1(g(p, 'offensive.freeThrowPct'))}%`))
  }
  return []
}

async function teamEntries(season: number): Promise<Record<string, Entry[]>> {
  const [all, dir] = await Promise.all([getAllTeamStats(SPORT, LEAGUE, season).catch(() => null), getCollegeDirectory('cbb')])
  const rows = (all ?? []).filter((t) => dir?.byId.has(t.teamId) && (t.own.gamesPlayed ?? 0) >= 8)
  const mk = (f: (t: (typeof rows)[number]) => number | undefined, fmt: (x: number) => string = r1): Entry[] =>
    rows.flatMap((t) => {
      const v = f(t)
      const team = dir?.byId.get(t.teamId)
      return v === undefined ? [] : [{ name: team?.shortName ?? t.name, team: team?.abbr ?? t.abbr, value: v, display: fmt(v) }]
    })
  return {
    'Points/G': mk((t) => t.own.avgPoints),
    'Points Allowed/G': mk((t) => (t.own.avgPoints !== undefined && t.own.avgPointsDifferential !== undefined ? t.own.avgPoints - t.own.avgPointsDifferential : undefined)),
    'Reb/G': mk((t) => t.own.avgRebounds),
    'Ast/G': mk((t) => t.own.avgAssists),
    'FG%': mk((t) => t.own.fieldGoalPct, (x) => `${r1(x)}%`),
    '3P%': mk((t) => t.own.threePointFieldGoalPct, (x) => `${r1(x)}%`),
  }
}

/** Season boards for both sub-tabs. */
export async function buildCbbLeaders(depth = 40): Promise<{ leaders: LeaderGroup | null; info: CbbSeasonInfo }> {
  const info = await getCbbSeasonInfo()
  return cached(`cbb:leaders:${info.season}:${depth}`, 3600, async () => {
    const pool = await playerPool(info.season)
    if (pool.length === 0) return { leaders: null, info }
    const out: LeaderGroup = { subs: [...CBB_SUBS], cats: CBB_GAME_CATEGORIES, rows: { Players: {}, Teams: {} } }
    for (const cat of CBB_GAME_CATEGORIES.Players) out.rows.Players[cat] = toRows(seasonEntries(cat, pool), depth)
    const teams = await teamEntries(info.season)
    for (const cat of CBB_GAME_CATEGORIES.Teams) out.rows.Teams[cat] = toRows(teams[cat] ?? [], depth, cat === 'Points Allowed/G')
    return { leaders: out, info }
  }).then((v) => v ?? { leaders: null, info })
}

// ---------------------------------------------------------------------------
// Game-log driven boards (windows, filters, betting)
// ---------------------------------------------------------------------------

interface LoggedPlayer {
  p: AllPlayerStatsRow
  rows: GameLogRow[]
}

const half = (v: string | undefined): [number, number] => {
  const [a, b] = String(v ?? '0-0').split('-')
  return [Number(a) || 0, Number(b) || 0]
}

async function loggedPool(season: number): Promise<LoggedPlayer[]> {
  return (
    (await cached(`cbb:loggedpool:v2:${season}`, 3600, async () => {
      const pool = await playerPool(season)
      const top = [...pool].sort((a, b) => g(b, 'offensive.points') - g(a, 'offensive.points')).slice(0, 120)
      const out: LoggedPlayer[] = []
      for (let i = 0; i < top.length; i += 8) {
        const chunk = await Promise.all(top.slice(i, i + 8).map(async (p) => ({ p, log: await getPlayerGameLog(SPORT, LEAGUE, p.playerId, season).catch(() => null) })))
        for (const c of chunk) if (c.log && c.log.rows.length > 0) out.push({ p: c.p, rows: c.log.rows })
      }
      return out.length > 0 ? out : null
    })) ?? []
  )
}

export interface CbbRowFilter {
  window: string
  homeAway: 'All' | 'Home' | 'Away'
  vsTeam: string
  month: number
}

const WINDOW_DAYS: Record<string, number | undefined> = { Season: undefined, 'Last 30': 30, 'Last 14': 14, 'Last 7': 7 }

function filterRows(all: LoggedPlayer[], f: CbbRowFilter): LoggedPlayer[] {
  const newest = all.reduce((m, x) => (x.rows[0]?.date && x.rows[0].date > m ? x.rows[0].date : m), '')
  const days = WINDOW_DAYS[f.window]
  const cutoff = days && newest ? Date.parse(newest) - days * 86400000 : null
  return all.map((x) => ({
    p: x.p,
    rows: x.rows.filter((r) => {
      if (cutoff !== null && r.date && Date.parse(r.date) < cutoff) return false
      if (f.homeAway === 'Home' && !r.home) return false
      if (f.homeAway === 'Away' && r.home) return false
      if (f.vsTeam !== 'All Teams' && r.opponent !== f.vsTeam) return false
      if (f.month && r.date && new Date(r.date).getUTCMonth() + 1 !== f.month) return false
      return true
    }),
  }))
}

/** Value of a prop category in one game (null if not applicable). */
export function cbbGameValue(category: string, r: GameLogRow): number | null {
  const pts = r.stats.points
  const reb = r.stats.totalRebounds
  const ast = r.stats.assists
  switch (category) {
    case 'Points': return pts ?? null
    case 'Rebounds': return reb ?? null
    case 'Assists': return ast ?? null
    case '3-Pointers': return half(r.raw['threePointFieldGoalsMade-threePointFieldGoalsAttempted'])[0]
    case 'PRA': return pts !== undefined && reb !== undefined && ast !== undefined ? pts + reb + ast : null
    case 'PTS': return pts ?? null
    case 'REB': return reb ?? null
    case 'AST': return ast ?? null
    case 'BLK': return r.stats.blocks ?? null
    case 'STL': return r.stats.steals ?? null
  }
  return null
}

/** Windowed / filtered game-stat board for Players. */
export async function getCbbWindowedLeaders(category: string, f: CbbRowFilter, limit = 40): Promise<LeaderRow[]> {
  const info = await getCbbSeasonInfo()
  const logged = filterRows(await loggedPool(info.season), f)
  const entries: Entry[] = []
  for (const { p, rows } of logged) {
    if (rows.length < 2) continue
    if (['PTS', 'REB', 'AST', 'BLK', 'STL'].includes(category)) {
      const vals = rows.map((r) => cbbGameValue(category, r)).filter((v): v is number => v !== null)
      if (vals.length < 2) continue
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length
      entries.push({ name: p.name, team: p.teamAbbr, value: avg, display: r1(avg) })
    } else {
      const key = category === 'FG%' ? 'fieldGoalsMade-fieldGoalsAttempted' : category === '3P%' ? 'threePointFieldGoalsMade-threePointFieldGoalsAttempted' : 'freeThrowsMade-freeThrowsAttempted'
      let m = 0, a = 0
      for (const r of rows) {
        const [x, y] = half(r.raw[key])
        m += x
        a += y
      }
      const min = category === 'FG%' ? rows.length * 3 : rows.length * 1
      if (a < Math.max(10, min)) continue
      entries.push({ name: p.name, team: p.teamAbbr, value: m / a, display: `${r1((m / a) * 100)}%` })
    }
  }
  return toRows(entries, limit)
}

export async function getCbbBettingLeaders(category: string, threshold: number, f: CbbRowFilter, limit = 40): Promise<BettingLeaderRow[]> {
  const info = await getCbbSeasonInfo()
  const logged = filterRows(await loggedPool(info.season), f)
  const out: BettingLeaderRow[] = []
  for (const { p, rows } of logged) {
    const played = rows.map((r) => cbbGameValue(category, r)).filter((v): v is number => v !== null)
    if (played.length < 2) continue
    const hit = played.filter((v) => v >= threshold).length
    out.push({
      rank: 0,
      name: p.name,
      team: p.teamAbbr,
      hitRate: Math.round((hit / played.length) * 1000) / 10,
      wins: hit,
      losses: played.length - hit,
      gamesPlayed: played.length,
      last5: played.slice(0, 5).map((v) => v >= threshold),
    })
  }
  out.sort((a, b) => b.hitRate - a.hitRate || b.gamesPlayed - a.gamesPlayed)
  return out.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }))
}

/** Oldest-first values for one player from the logged pool: a stat per game, or 0/1 hits against a betting threshold. */
export async function cbbPlayerSeries(name: string, team: string, mode: 'stat' | 'betting', category: string, threshold: number): Promise<number[]> {
  const info = await getCbbSeasonInfo()
  const hit = (await loggedPool(info.season)).find((x) => x.p.name === name && (!team || x.p.teamAbbr === team))
  if (!hit) return []
  const out: number[] = []
  for (const r of [...hit.rows].reverse()) {
    const v = cbbGameValue(category, r)
    if (v === null) continue
    out.push(mode === 'betting' ? (v >= threshold ? 1 : 0) : v)
  }
  return out
}
