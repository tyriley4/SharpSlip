import { getBettingLeaders } from '@/lib/mlb/bettingLeaders'
import type { PropCategory } from '@/lib/mlb/bettingCategories'
import { getFilteredLeaders } from '@/lib/mlb/filteredLeaders'
import { DEFAULT_FILTERS, type LeaderFilters } from '@/lib/mlb/filters'
import { NOTABLE_PITCHERS } from '@/lib/mlb/notablePlayers'
import { getPlayerGameLog } from '@/lib/mlb/api'
import { getPitcherNrfiRate } from '@/lib/mlb/pitchingBreakdown'
import { resolvePlayerIds } from '@/lib/mlb/playerLookup'
import { getMlbTeamsIndex } from '@/lib/mlb/teams'
import { getAllNBAPlayerSeasonStats, getNBAPlayerGameLog, type NBAPlayerGameLogRow } from '@/lib/nba/api'
import { getNbaBettingLeaders } from '@/lib/nba/bettingLeaders'
import { NBA_CURRENT_SEASON } from '@/lib/nba/divisions'
import { DEFAULT_NBA_FILTERS, gameMatchesFilters as nbaMatches, type NBALeaderFilters } from '@/lib/nba/filters'
import type { NBABettingCategory } from '@/lib/nba/leaderCategories'
import { NOTABLE_NBA_PLAYERS } from '@/lib/nba/notablePlayers'
import { getActiveNFLSeason } from '@/lib/nfl/api'
import type { NflBettingSub } from '@/lib/nfl/bettingCategories'
import { getNflBettingLeaders, loadNflPlayerGames, type PlayerGame } from '@/lib/nfl/bettingLeaders'
import { DEFAULT_NFL_FILTERS, gameMatchesFilters as nflMatches, type NFLLeaderFilters } from '@/lib/nfl/filters'
import { getAllNHLGoalieStats, getAllNHLSkaterStats, getNHLPlayerGameLog, type NHLPlayerGameLogRow } from '@/lib/nhl/api'
import { getNhlGoalieBettingLeaders, getNhlSkaterBettingLeaders } from '@/lib/nhl/bettingLeaders'
import { DEFAULT_NHL_FILTERS, gameMatchesFilters as nhlMatches, type NHLLeaderFilters } from '@/lib/nhl/filters'
import type { NHLSkaterBettingCategory } from '@/lib/nhl/leaderCategories'
import { NOTABLE_NHL_GOALIES, NOTABLE_NHL_SKATERS } from '@/lib/nhl/notablePlayers'
import type { Sport } from '@/lib/sport/SportContext'
import { mapWithConcurrency } from '@/lib/utils/concurrency'
import { findRateAxis, type ScatterFilters } from './axes'

export interface ScatterPointOut {
  name: string
  team: string
  x: number
  y: number
}

interface AxisValue {
  team: string
  value: number
}

interface AxisResult {
  values: Map<string, AxisValue>
  /** Set when this axis can't be recomputed with the active filters (the plot is then empty). */
  unsupported?: boolean
  note?: string
}

export interface ScatterResult {
  points: ScatterPointOut[]
  notes: string[]
}

function parseNum(v: string): number | null {
  const cleaned = v.replace(/[,%+\s]/g, '')
  if (cleaned === '' || cleaned === '—' || cleaned === '-') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function fromRows(rows: { name: string; team: string; value: number }[]): Map<string, AxisValue> {
  const map = new Map<string, AxisValue>()
  for (const r of rows) map.set(r.name, { team: r.team, value: r.value })
  return map
}

const UNSUPPORTED = (label: string): AxisResult => ({
  values: new Map(),
  unsupported: true,
  note: `${label} can't be recomputed per game, so it isn't available while filters are active.`,
})

// ---------------------------------------------------------------------------
// MLB
// ---------------------------------------------------------------------------

async function mlbAxis(sub: string, label: string, f: ScatterFilters): Promise<AxisResult> {
  if (sub !== 'Hitters' && sub !== 'Pitchers') return UNSUPPORTED(label)
  const filters: LeaderFilters = { ...DEFAULT_FILTERS, team: f.vsTeam, homeAway: f.homeAway, handedness: f.hand }
  const rate = findRateAxis('mlb', sub, label)

  if (rate?.kind === 'nrfi') {
    const [resolved, teams] = await Promise.all([resolvePlayerIds(NOTABLE_PITCHERS), getMlbTeamsIndex()])
    const rows = await mapWithConcurrency(resolved, 4, async (p) => {
      const [nrfi, log] = await Promise.all([getPitcherNrfiRate(p.id), getPlayerGameLog(p.id, 'pitching')])
      const teamId = log?.[log.length - 1]?.team.id
      return { name: p.fullName, team: teamId ? (teams?.get(teamId)?.abbr ?? '') : '', value: nrfi.rate, sample: nrfi.sample }
    })
    return {
      values: fromRows(rows.filter((r) => r.sample >= 3)),
      note: 'NRFI uses each starter’s last 10 starts, so the opponent, venue and handedness filters don’t apply to it.',
    }
  }

  if (rate) {
    const rows = await getBettingLeaders(sub, rate.category as PropCategory, rate.threshold, { ...filters, handedness: 'All' })
    return {
      values: fromRows(rows.map((r) => ({ name: r.name, team: r.team, value: r.hitRate }))),
      note: f.hand !== 'All' ? 'Hit-rate axes can’t be split by pitcher handedness, so that filter is ignored for them.' : undefined,
    }
  }

  const rows = await getFilteredLeaders(sub, label, filters, 100)
  const out: { name: string; team: string; value: number }[] = []
  for (const r of rows) {
    const v = parseNum(r.value)
    if (v !== null) out.push({ name: r.name, team: r.team, value: v })
  }
  return { values: fromRows(out) }
}

// ---------------------------------------------------------------------------
// NFL
// ---------------------------------------------------------------------------

function num(v: string | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function passerRating(comp: number, att: number, yds: number, td: number, int: number): number {
  if (att === 0) return 0
  const a = Math.max(0, Math.min(2.375, (comp / att - 0.3) * 5))
  const b = Math.max(0, Math.min(2.375, (yds / att - 3) * 0.25))
  const c = Math.max(0, Math.min(2.375, (td / att) * 20))
  const d = Math.max(0, Math.min(2.375, 2.375 - (int / att) * 25))
  return ((a + b + c + d) / 6) * 100
}

export function nflStat(sub: string, label: string, games: PlayerGame[]): number | null {
  const sum = (k: string) => games.reduce((s, g) => s + num(g.row[k]), 0)
  switch (label) {
    case 'Pass Yds':
      return sum('passing_yards')
    case 'TDs':
      return sub === 'QB' ? sum('passing_tds') : sum('rushing_tds') + sum('receiving_tds')
    case 'Comp%':
      return sum('attempts') > 0 ? (sum('completions') / sum('attempts')) * 100 : 0
    case 'Rating':
      return passerRating(sum('completions'), sum('attempts'), sum('passing_yards'), sum('passing_tds'), sum('interceptions'))
    case 'Rush Yds':
      return sum('rushing_yards')
    case 'INTs':
      return sum('interceptions')
    case 'YPC':
      return sum('carries') > 0 ? sum('rushing_yards') / sum('carries') : 0
    case 'Rec':
      return sum('receptions')
    case 'Rec Yds':
      return sum('receiving_yards')
    case 'Fumbles':
      return sum('rushing_fumbles') + sum('receiving_fumbles')
    case 'Targets':
      return sum('targets')
    case 'YPR':
      return sum('receptions') > 0 ? sum('receiving_yards') / sum('receptions') : 0
    case 'Target%':
      return games.length > 0 ? (sum('target_share') / games.length) * 100 : 0
    default:
      return null
  }
}

async function nflAxis(sub: string, label: string, f: ScatterFilters): Promise<AxisResult> {
  if (!['QB', 'RB', 'WR', 'TE'].includes(sub)) return UNSUPPORTED(label)
  const position = sub as NflBettingSub
  const season = await getActiveNFLSeason()
  const filters: NFLLeaderFilters = { ...DEFAULT_NFL_FILTERS, team: f.vsTeam, homeAway: f.homeAway, conference: f.conference }
  const rate = findRateAxis('nfl', sub, label)

  if (rate) {
    const rows = await getNflBettingLeaders(position, rate.category, rate.threshold, filters, season, 200)
    return { values: fromRows(rows.map((r) => ({ name: r.name, team: r.team, value: r.hitRate }))) }
  }

  const players = await loadNflPlayerGames(position, season)
  const out: { name: string; team: string; value: number }[] = []
  for (const p of players) {
    const games = p.games.filter((g) => nflMatches(g, filters))
    if (games.length === 0) continue
    const v = nflStat(sub, label, games)
    if (v === null) return UNSUPPORTED(label)
    out.push({ name: p.name, team: p.team, value: Math.round(v * 100) / 100 })
  }
  return { values: fromRows(out) }
}

// ---------------------------------------------------------------------------
// NBA
// ---------------------------------------------------------------------------

export function nbaStat(label: string, log: NBAPlayerGameLogRow[]): number | null {
  const avg = (pick: (g: NBAPlayerGameLogRow) => number) => log.reduce((s, g) => s + pick(g), 0) / log.length
  switch (label) {
    case 'PTS':
      return avg((g) => g.pts)
    case 'REB':
      return avg((g) => g.reb)
    case 'AST':
      return avg((g) => g.ast)
    case 'STL':
      return avg((g) => g.stl)
    case 'BLK':
      return avg((g) => g.blk)
    case 'MIN':
      return avg((g) => g.min)
    case 'TO':
      return avg((g) => g.tov)
    default:
      return null
  }
}

async function nbaAxis(sub: string, label: string, f: ScatterFilters): Promise<AxisResult> {
  if (sub !== 'Players') return UNSUPPORTED(label)
  const filters: NBALeaderFilters = { ...DEFAULT_NBA_FILTERS, team: f.vsTeam, homeAway: f.homeAway }
  const rate = findRateAxis('nba', sub, label)

  if (rate) {
    const rows = await getNbaBettingLeaders(rate.category as NBABettingCategory, rate.threshold, filters, NBA_CURRENT_SEASON, 200)
    return { values: fromRows(rows.map((r) => ({ name: r.name, team: r.teamAbbr, value: r.hitRate }))) }
  }

  const all = await getAllNBAPlayerSeasonStats(NBA_CURRENT_SEASON)
  if (!all) return { values: new Map() }
  const pool = all.filter((p) => NOTABLE_NBA_PLAYERS.includes(p.name))
  const rows = await mapWithConcurrency(pool, 5, async (p) => {
    const log = await getNBAPlayerGameLog(p.playerId, NBA_CURRENT_SEASON)
    if (!log || log.length < 15) return null
    const filtered = log.filter((g) => nbaMatches(g, filters))
    if (filtered.length === 0) return null
    const v = nbaStat(label, filtered)
    return v === null ? ('unsupported' as const) : { name: p.name, team: p.teamAbbr, value: Math.round(v * 100) / 100 }
  })
  if (rows.includes('unsupported')) return UNSUPPORTED(label)
  return { values: fromRows(rows.filter((r): r is { name: string; team: string; value: number } => r !== null && r !== 'unsupported')) }
}

// ---------------------------------------------------------------------------
// NHL
// ---------------------------------------------------------------------------

function toiMinutes(toi: string): number {
  const [m, s] = toi.split(':').map(Number)
  return (Number.isFinite(m) ? m : 0) + (Number.isFinite(s) ? s : 0) / 60
}

export function nhlSkaterStat(label: string, log: NHLPlayerGameLogRow[]): number | null {
  const sum = (pick: (g: NHLPlayerGameLogRow) => number) => log.reduce((s, g) => s + pick(g), 0)
  switch (label) {
    case 'PTS':
      return sum((g) => g.points)
    case 'G':
      return sum((g) => g.goals)
    case 'A':
      return sum((g) => g.assists)
    case '+/-':
      return sum((g) => g.plusMinus)
    case 'SOG':
      return sum((g) => g.shots)
    case 'PIM':
      return sum((g) => g.pim)
    default:
      return null
  }
}

export function nhlGoalieStat(label: string, log: NHLPlayerGameLogRow[]): number | null {
  const sum = (pick: (g: NHLPlayerGameLogRow) => number) => log.reduce((s, g) => s + pick(g), 0)
  const minutes = sum((g) => toiMinutes(g.toi))
  switch (label) {
    case 'SV%':
      return sum((g) => g.shotsAgainst) > 0 ? sum((g) => g.saves) / sum((g) => g.shotsAgainst) : 0
    case 'GAA':
      return minutes > 0 ? (sum((g) => g.goalsAgainst) * 60) / minutes : 0
    case 'W':
      return log.filter((g) => g.decision === 'W').length
    case 'SO':
      return log.filter((g) => g.goalsAgainst === 0).length
    case 'SA':
      return sum((g) => g.shotsAgainst)
    case 'GA':
      return sum((g) => g.goalsAgainst)
    case 'MIN':
      return minutes
    default:
      return null
  }
}

async function nhlAxis(sub: string, label: string, f: ScatterFilters): Promise<AxisResult> {
  if (sub !== 'Skaters' && sub !== 'Goalies') return UNSUPPORTED(label)
  const filters: NHLLeaderFilters = { ...DEFAULT_NHL_FILTERS, team: f.vsTeam, homeAway: f.homeAway }
  const rate = findRateAxis('nhl', sub, label)

  if (rate) {
    const rows =
      sub === 'Goalies'
        ? await getNhlGoalieBettingLeaders('Saves', rate.threshold, filters, 200)
        : await getNhlSkaterBettingLeaders(rate.category as NHLSkaterBettingCategory, rate.threshold, filters, 200)
    return { values: fromRows(rows.map((r) => ({ name: r.name, team: r.teamAbbr, value: r.hitRate }))) }
  }

  const goalies = sub === 'Goalies'
  const all = goalies ? await getAllNHLGoalieStats() : await getAllNHLSkaterStats()
  if (!all) return { values: new Map() }
  const names = goalies ? NOTABLE_NHL_GOALIES : NOTABLE_NHL_SKATERS
  const pool = all.filter((p) => names.includes(p.name))

  const rows = await mapWithConcurrency(pool, 5, async (p) => {
    const log = await getNHLPlayerGameLog(p.playerId)
    if (!log || log.length < 5) return null
    const filtered = log.filter((g) => nhlMatches(g, filters) && (!goalies || g.decision !== null))
    if (filtered.length === 0) return null
    const v = goalies ? nhlGoalieStat(label, filtered) : nhlSkaterStat(label, filtered)
    return v === null ? ('unsupported' as const) : { name: p.name, team: p.teamAbbr, value: Math.round(v * 1000) / 1000 }
  })
  if (rows.includes('unsupported')) return UNSUPPORTED(label)
  return { values: fromRows(rows.filter((r): r is { name: string; team: string; value: number } => r !== null && r !== 'unsupported')) }
}

// ---------------------------------------------------------------------------

async function axisValues(sport: Sport, sub: string, label: string, f: ScatterFilters): Promise<AxisResult> {
  switch (sport) {
    case 'mlb':
      return mlbAxis(sub, label, f)
    case 'nfl':
      return nflAxis(sub, label, f)
    case 'nba':
      return nbaAxis(sub, label, f)
    case 'nhl':
      return nhlAxis(sub, label, f)
    default:
      return UNSUPPORTED(label)
  }
}

/** Computes the scatter points for two axes (game stats and/or betting hit rates) under the given filters. */
export async function buildScatter(sport: Sport, sub: string, xLabel: string, yLabel: string, filters: ScatterFilters): Promise<ScatterResult> {
  const [x, y] = await Promise.all([axisValues(sport, sub, xLabel, filters), axisValues(sport, sub, yLabel, filters)])
  const notes = Array.from(new Set([x.note, y.note].filter((n): n is string => !!n)))
  const points: ScatterPointOut[] = []
  x.values.forEach((xv, name) => {
    const yv = y.values.get(name)
    if (!yv) return
    points.push({ name, team: xv.team || yv.team, x: xv.value, y: yv.value })
  })
  return { points, notes }
}
