import type { LeaderGroup, LeaderRow } from '@/data/leaders/types'
import { getCollegeDirectory } from '@/lib/college/directory'
import { getLeagueData, type PlayerGameRow } from '@/lib/football/league'
import type { BettingLeaderRow } from '@/lib/mlb/bettingLeaders'
import { ncaaRating } from '@/lib/cfb/engine'

/**
 * College football leaderboards (game stats and betting hit rates) computed from league-wide box-score rows.
 * Positions come from ESPN rosters; a player with no roster position is classified by what he did on the field.
 */

export type CfbSub = 'QB' | 'RB' | 'WR' | 'TE' | 'DEF' | 'Teams'
export const CFB_SUBS: CfbSub[] = ['QB', 'RB', 'WR', 'TE', 'DEF', 'Teams']

export const CFB_GAME_CATEGORIES: Record<CfbSub, string[]> = {
  QB: ['Pass Yds', 'TDs', 'Comp%', 'Rating', 'Rush Yds', 'INTs'],
  RB: ['Rush Yds', 'TDs', 'YPC', 'Rec Yds'],
  WR: ['Rec Yds', 'Rec', 'TDs', 'Yds/Catch'],
  TE: ['Rec Yds', 'Rec', 'TDs', 'Yds/Catch'],
  DEF: ['Sacks', 'INTs', 'Tackles', 'TFL', 'PD'],
  Teams: ['Points/G', 'Pass Yds/G', 'Rush Yds/G', 'Points Allowed/G', 'Total Yds/G'],
}

export { CFB_BETTING_CATEGORIES, CFB_BETTING_SUBS, CFB_BETTING_THRESHOLDS, isCfbBettingSub, type CfbBettingSub } from './cfbProps'
import type { CfbBettingSub } from './cfbProps'

const POS_GROUP: Record<string, CfbSub> = { QB: 'QB', RB: 'RB', FB: 'RB', HB: 'RB', WR: 'WR', TE: 'TE' }

export interface Agg {
  id: string
  name: string
  team: string
  teamId: string
  games: number
  comp: number
  att: number
  pyds: number
  ptd: number
  int: number
  car: number
  ryds: number
  rtd: number
  rec: number
  recyds: number
  rectd: number
  tot: number
  sacks: number
  tfl: number
  pd: number
  dint: number
}

const blank = (r: PlayerGameRow): Agg => ({ id: r.playerId, name: r.name, team: r.team, teamId: r.teamId, games: 0, comp: 0, att: 0, pyds: 0, ptd: 0, int: 0, car: 0, ryds: 0, rtd: 0, rec: 0, recyds: 0, rectd: 0, tot: 0, sacks: 0, tfl: 0, pd: 0, dint: 0 })

export function aggregate(rows: PlayerGameRow[]): Map<string, Agg> {
  const m = new Map<string, Agg>()
  for (const r of rows) {
    const a = m.get(r.playerId) ?? blank(r)
    a.team = r.team
    a.teamId = r.teamId
    a.games++
    a.comp += r.comp ?? 0; a.att += r.att ?? 0; a.pyds += r.pyds ?? 0; a.ptd += r.ptd ?? 0; a.int += r.int ?? 0
    a.car += r.car ?? 0; a.ryds += r.ryds ?? 0; a.rtd += r.rtd ?? 0
    a.rec += r.rec ?? 0; a.recyds += r.recyds ?? 0; a.rectd += r.rectd ?? 0
    a.tot += r.tot ?? 0; a.sacks += r.sacks ?? 0; a.tfl += r.tfl ?? 0; a.pd += r.pd ?? 0; a.dint += r.dint ?? 0
    m.set(r.playerId, a)
  }
  return m
}

/** Which board a player belongs on. */
export function subFor(a: Agg, pos: string | undefined): CfbSub | null {
  const fromRoster = pos ? POS_GROUP[pos.toUpperCase()] : undefined
  if (fromRoster) return fromRoster
  if (a.att >= 10) return 'QB'
  if (pos && !['QB', 'RB', 'FB', 'WR', 'TE', 'K', 'P', 'PK', 'LS', 'ATH'].includes(pos.toUpperCase())) return 'DEF'
  if (a.tot + a.sacks + a.tfl > 0 && a.car + a.rec === 0) return 'DEF'
  if (a.car >= 8 && a.car * 4 >= a.rec) return 'RB'
  if (a.rec >= 3) return 'WR'
  return null
}

export interface RowFilter {
  /** Only games within this many days of the newest game on record. */
  days?: number
  homeAway?: 'All' | 'Home' | 'Away'
  /** 1-12 calendar month, or 0 for all. */
  month?: number
  conference?: string
  vsTeam?: string
}

export const WINDOW_DAYS: Record<string, number | undefined> = { Season: undefined, 'Last 30': 30, 'Last 14': 14, 'Last 7': 7 }

async function filteredRows(f: RowFilter): Promise<{ rows: PlayerGameRow[]; positions: Record<string, string>; conferenceOf: (teamId: string) => string; building: boolean }> {
  const data = getLeagueData('college-football')
  const dir = await getCollegeDirectory('cfb')
  const conferenceOf = (teamId: string) => dir?.byId.get(teamId)?.conferenceAbbr ?? ''
  let rows = data.rows
  if (f.days) {
    const newest = rows.reduce((m, r) => (r.date > m ? r.date : m), '')
    const cutoff = Date.parse(newest) - f.days * 86400000
    rows = rows.filter((r) => Date.parse(r.date) >= cutoff)
  }
  if (f.homeAway === 'Home') rows = rows.filter((r) => r.home)
  if (f.homeAway === 'Away') rows = rows.filter((r) => !r.home)
  if (f.month) rows = rows.filter((r) => new Date(r.date).getUTCMonth() + 1 === f.month)
  if (f.conference && f.conference !== 'All') rows = rows.filter((r) => conferenceOf(r.teamId) === f.conference)
  if (f.vsTeam && f.vsTeam !== 'All Teams') rows = rows.filter((r) => r.opp === f.vsTeam)
  return { rows, positions: data.positions, conferenceOf, building: data.building }
}

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

function playerEntries(sub: Exclude<CfbSub, 'Teams'>, category: string, aggs: Agg[]): Entry[] {
  const e = (a: Agg, value: number, display: string): Entry => ({ name: a.name, team: a.team, value, display })
  switch (sub) {
    case 'QB': {
      const pool = aggs.filter((a) => a.att >= 20)
      switch (category) {
        case 'Pass Yds': return pool.map((a) => e(a, a.pyds, String(a.pyds)))
        case 'TDs': return pool.map((a) => e(a, a.ptd, String(a.ptd)))
        case 'Comp%': return pool.map((a) => e(a, a.comp / a.att, `${r1((a.comp / a.att) * 100)}%`))
        case 'Rating': return pool.map((a) => e(a, ncaaRating(a.comp, a.att, a.pyds, a.ptd, a.int), r1(ncaaRating(a.comp, a.att, a.pyds, a.ptd, a.int))))
        case 'Rush Yds': return pool.map((a) => e(a, a.ryds, String(a.ryds)))
        case 'INTs': return pool.map((a) => e(a, a.int, String(a.int)))
      }
      return []
    }
    case 'RB': {
      const pool = aggs.filter((a) => a.car >= 15)
      switch (category) {
        case 'Rush Yds': return pool.map((a) => e(a, a.ryds, String(a.ryds)))
        case 'TDs': return pool.map((a) => e(a, a.rtd + a.rectd, String(a.rtd + a.rectd)))
        case 'YPC': return pool.filter((a) => a.car >= 25).map((a) => e(a, a.ryds / a.car, r1(a.ryds / a.car)))
        case 'Rec Yds': return aggs.filter((a) => a.rec > 0).map((a) => e(a, a.recyds, String(a.recyds)))
      }
      return []
    }
    case 'WR':
    case 'TE': {
      const pool = aggs.filter((a) => a.rec >= (sub === 'TE' ? 3 : 5))
      switch (category) {
        case 'Rec Yds': return pool.map((a) => e(a, a.recyds, String(a.recyds)))
        case 'Rec': return pool.map((a) => e(a, a.rec, String(a.rec)))
        case 'TDs': return pool.map((a) => e(a, a.rectd, String(a.rectd)))
        case 'Yds/Catch': return pool.map((a) => e(a, a.recyds / a.rec, r1(a.recyds / a.rec)))
      }
      return []
    }
    case 'DEF': {
      const pool = aggs.filter((a) => a.tot + a.sacks + a.tfl + a.pd + a.dint > 0)
      switch (category) {
        case 'Sacks': return pool.map((a) => e(a, a.sacks, r1(a.sacks).replace(/\.0$/, '')))
        case 'INTs': return pool.map((a) => e(a, a.dint, String(a.dint)))
        case 'Tackles': return pool.map((a) => e(a, a.tot, String(a.tot)))
        case 'TFL': return pool.map((a) => e(a, a.tfl, r1(a.tfl).replace(/\.0$/, '')))
        case 'PD': return pool.map((a) => e(a, a.pd, String(a.pd)))
      }
      return []
    }
  }
}

async function teamEntries(): Promise<Record<string, Entry[]>> {
  const data = getLeagueData('college-football')
  const dir = await getCollegeDirectory('cfb')
  const t = new Map<string, { abbr: string; name: string; g: number; pf: number; pa: number; py: number; ry: number; ty: number }>()
  for (const g of data.games) {
    for (const [mine, theirs] of [[g.home, g.away], [g.away, g.home]] as const) {
      if (dir && !dir.byId.has(mine.teamId)) continue
      const c = t.get(mine.teamId) ?? { abbr: dir?.byId.get(mine.teamId)?.abbr ?? mine.abbr, name: dir?.byId.get(mine.teamId)?.shortName ?? mine.abbr, g: 0, pf: 0, pa: 0, py: 0, ry: 0, ty: 0 }
      c.g++
      c.pf += mine.score
      c.pa += theirs.score
      c.py += Number(mine.stats.netPassingYards ?? 0) || 0
      c.ry += Number(mine.stats.rushingYards ?? 0) || 0
      c.ty += Number(mine.stats.totalYards ?? 0) || 0
      t.set(mine.teamId, c)
    }
  }
  const all = Array.from(t.values()).filter((c) => c.g >= 2)
  const mk = (f: (c: (typeof all)[number]) => number): Entry[] => all.map((c) => ({ name: c.name, team: c.abbr, value: f(c), display: r1(f(c)) }))
  return {
    'Points/G': mk((c) => c.pf / c.g),
    'Pass Yds/G': mk((c) => c.py / c.g),
    'Rush Yds/G': mk((c) => c.ry / c.g),
    'Points Allowed/G': mk((c) => c.pa / c.g),
    'Total Yds/G': mk((c) => c.ty / c.g),
  }
}

/** Season leaderboards for every sub-tab (the page renders these directly; windows are recomputed on demand). */
export async function buildCfbLeaders(depth = 40): Promise<LeaderGroup | null> {
  const { rows, positions } = await filteredRows({})
  if (rows.length === 0) return null
  const aggs = Array.from(aggregate(rows).values())
  const bySub = new Map<CfbSub, Agg[]>()
  for (const a of aggs) {
    const s = subFor(a, positions[a.id])
    if (s && s !== 'Teams') bySub.set(s, [...(bySub.get(s) ?? []), a])
  }
  const out: LeaderGroup = { subs: CFB_SUBS, cats: CFB_GAME_CATEGORIES, rows: {} }
  for (const sub of CFB_SUBS) {
    out.rows[sub] = {}
    if (sub === 'Teams') {
      const teams = await teamEntries()
      for (const cat of CFB_GAME_CATEGORIES.Teams) out.rows.Teams[cat] = toRows(teams[cat] ?? [], depth, cat === 'Points Allowed/G')
      continue
    }
    for (const cat of CFB_GAME_CATEGORIES[sub]) out.rows[sub][cat] = toRows(playerEntries(sub, cat, bySub.get(sub) ?? []), depth, false)
  }
  return out
}

/** A single game-stat board for a time window / filter set. */
export async function getCfbWindowedLeaders(sub: string, category: string, f: RowFilter & { window: string }, limit = 40): Promise<LeaderRow[]> {
  if (!(CFB_SUBS as string[]).includes(sub) || sub === 'Teams') return []
  const { rows, positions } = await filteredRows({ ...f, days: WINDOW_DAYS[f.window] })
  const aggs = Array.from(aggregate(rows).values()).filter((a) => subFor(a, positions[a.id]) === sub)
  return toRows(playerEntries(sub as Exclude<CfbSub, 'Teams'>, category, aggs), limit, false)
}

// ---------------------------------------------------------------------------
// Betting hit rates
// ---------------------------------------------------------------------------

function statFor(category: string, r: PlayerGameRow): number | null {
  switch (category) {
    case 'Pass Yards': return (r.att ?? 0) > 0 ? (r.pyds ?? 0) : null
    case 'Rush Yards': return (r.car ?? 0) > 0 || (r.att ?? 0) > 0 ? (r.ryds ?? 0) : null
    case 'Receiving Yards': return (r.rec ?? 0) > 0 || r.recyds !== undefined ? (r.recyds ?? 0) : null
    case 'Receptions': return r.rec !== undefined ? (r.rec ?? 0) : null
    case 'Anytime TD': return (r.rtd ?? 0) + (r.rectd ?? 0)
  }
  return null
}

export interface CfbBettingFilter extends RowFilter {
  window: string
}

export async function getCfbBettingLeaders(sub: CfbBettingSub, category: string, threshold: number, f: CfbBettingFilter, limit = 40): Promise<BettingLeaderRow[]> {
  const { rows, positions } = await filteredRows({ ...f, days: WINDOW_DAYS[f.window] })
  const all = getLeagueData('college-football').rows
  // Qualify players on their full-season role, not on the filtered subset.
  const season = aggregate(all)
  const byPlayer = new Map<string, PlayerGameRow[]>()
  for (const r of rows) byPlayer.set(r.playerId, [...(byPlayer.get(r.playerId) ?? []), r])

  const out: BettingLeaderRow[] = []
  Array.from(byPlayer.entries()).forEach(([id, games]) => {
    const a = season.get(id)
    if (!a || subFor(a, positions[id]) !== sub) return
    const played = games.filter((g) => statFor(category, g) !== null).sort((x, y) => y.date.localeCompare(x.date))
    if (played.length < 2) return
    const hit = played.filter((g) => (statFor(category, g) ?? 0) >= threshold).length
    out.push({
      rank: 0,
      name: a.name,
      team: a.team,
      hitRate: Math.round((hit / played.length) * 1000) / 10,
      wins: hit,
      losses: played.length - hit,
      gamesPlayed: played.length,
      last5: played.slice(0, 5).map((g) => (statFor(category, g) ?? 0) >= threshold),
    })
  })
  out.sort((x, y) => y.hitRate - x.hitRate || y.gamesPlayed - x.gamesPlayed)
  return out.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }))
}

// ---------------------------------------------------------------------------
// Trend lines
// ---------------------------------------------------------------------------

/** Per-game value of a game-stat category (rates are that game's rate). */
export function cfbGameValue(category: string, r: PlayerGameRow): number | null {
  switch (category) {
    case 'Pass Yds': return r.att ? (r.pyds ?? 0) : null
    case 'Comp%': return r.att ? ((r.comp ?? 0) / r.att) * 100 : null
    case 'Rating': return r.att ? ncaaRating(r.comp ?? 0, r.att, r.pyds ?? 0, r.ptd ?? 0, r.int ?? 0) : null
    case 'Rush Yds': return r.car !== undefined || r.att ? (r.ryds ?? 0) : null
    case 'YPC': return r.car ? (r.ryds ?? 0) / r.car : null
    case 'TDs': return (r.ptd ?? 0) + (r.rtd ?? 0) + (r.rectd ?? 0)
    case 'INTs': return r.att ? (r.int ?? 0) : r.tot !== undefined || r.dint !== undefined ? (r.dint ?? 0) : null
    case 'Rec Yds': return r.rec !== undefined ? (r.recyds ?? 0) : null
    case 'Rec': return r.rec !== undefined ? (r.rec ?? 0) : null
    case 'Yds/Catch': return r.rec ? (r.recyds ?? 0) / r.rec : null
    case 'Sacks': return r.tot !== undefined ? (r.sacks ?? 0) : null
    case 'Tackles': return r.tot !== undefined ? (r.tot ?? 0) : null
    case 'TFL': return r.tot !== undefined ? (r.tfl ?? 0) : null
    case 'PD': return r.tot !== undefined ? (r.pd ?? 0) : null
  }
  return null
}

/** Oldest-first values for one player: a game stat, or 0/1 hits against a betting threshold. */
export function cfbPlayerSeries(name: string, team: string, mode: 'stat' | 'betting', category: string, threshold: number): number[] {
  const rows = getLeagueData('college-football')
    .rows.filter((r) => r.name === name && (!team || r.team === team))
    .sort((a, b) => a.date.localeCompare(b.date))
  const out: number[] = []
  for (const r of rows) {
    const v = mode === 'betting' ? statFor(category, r) : cfbGameValue(category, r)
    if (v === null) continue
    out.push(mode === 'betting' ? (v >= threshold ? 1 : 0) : v)
  }
  return out
}
