import type { LeaderRow } from '@/data/leaders/types'
import { isCareer, mlbLog } from '@/lib/career/logs'
import { mapWithConcurrency } from '@/lib/utils/concurrency'
import { getPlayerHandednessSplit, type RawGameLogEntry } from './api'
import { gameMatchesFilters, type HandednessOption, type LeaderFilters } from './filters'
import { NOTABLE_HITTERS, NOTABLE_PITCHERS } from './notablePlayers'
import { resolvePlayerIds } from './playerLookup'
import { getMlbTeamsIndex, type MlbTeamInfo } from './teams'

export interface HitterAgg {
  atBats: number
  hits: number
  baseOnBalls: number
  hitByPitch: number
  sacFlies: number
  totalBases: number
  homeRuns: number
  rbi: number
  runs: number
  stolenBases: number
  strikeOuts: number
  games: number
}

export interface PitcherAgg {
  outs: number
  earnedRuns: number
  baseOnBalls: number
  hits: number
  strikeOuts: number
  wins: number
  saves: number
  holds: number
  qualityStarts: number
  games: number
}

export function emptyHitterAgg(): HitterAgg {
  return { atBats: 0, hits: 0, baseOnBalls: 0, hitByPitch: 0, sacFlies: 0, totalBases: 0, homeRuns: 0, rbi: 0, runs: 0, stolenBases: 0, strikeOuts: 0, games: 0 }
}

export function emptyPitcherAgg(): PitcherAgg {
  return { outs: 0, earnedRuns: 0, baseOnBalls: 0, hits: 0, strikeOuts: 0, wins: 0, saves: 0, holds: 0, qualityStarts: 0, games: 0 }
}

export function addHitterGame(agg: HitterAgg, g: RawGameLogEntry) {
  agg.atBats += Number(g.stat.atBats ?? 0)
  agg.hits += Number(g.stat.hits ?? 0)
  agg.baseOnBalls += Number(g.stat.baseOnBalls ?? 0)
  agg.hitByPitch += Number(g.stat.hitByPitch ?? 0)
  agg.sacFlies += Number(g.stat.sacFlies ?? 0)
  agg.totalBases += Number(g.stat.totalBases ?? 0)
  agg.homeRuns += Number(g.stat.homeRuns ?? 0)
  agg.rbi += Number(g.stat.rbi ?? 0)
  agg.runs += Number(g.stat.runs ?? 0)
  agg.stolenBases += Number(g.stat.stolenBases ?? 0)
  agg.strikeOuts += Number(g.stat.strikeOuts ?? 0)
  agg.games += 1
}

export function addPitcherGame(agg: PitcherAgg, g: RawGameLogEntry) {
  agg.outs += Number(g.stat.outs ?? 0)
  agg.earnedRuns += Number(g.stat.earnedRuns ?? 0)
  agg.baseOnBalls += Number(g.stat.baseOnBalls ?? 0)
  agg.hits += Number(g.stat.hits ?? 0)
  agg.strikeOuts += Number(g.stat.strikeOuts ?? 0)
  agg.wins += Number(g.stat.wins ?? 0)
  agg.saves += Number(g.stat.saves ?? 0)
  agg.holds += Number(g.stat.holds ?? 0)
  const ip = parseFloat(String(g.stat.inningsPitched ?? '0'))
  const er = Number(g.stat.earnedRuns ?? 99)
  if (ip >= 6 && er <= 3) agg.qualityStarts += 1
  agg.games += 1
}

function obp(a: HitterAgg): number {
  const denom = a.atBats + a.baseOnBalls + a.hitByPitch + a.sacFlies
  return denom > 0 ? (a.hits + a.baseOnBalls + a.hitByPitch) / denom : 0
}

function slg(a: HitterAgg): number {
  return a.atBats > 0 ? a.totalBases / a.atBats : 0
}

export function hitterCategoryValue(a: HitterAgg, category: string): number {
  switch (category) {
    case 'AVG':
      return a.atBats > 0 ? a.hits / a.atBats : 0
    case 'HR':
      return a.homeRuns
    case 'RBI':
      return a.rbi
    case 'OPS':
      return obp(a) + slg(a)
    case 'OBP':
      return obp(a)
    case 'SLG':
      return slg(a)
    case 'H':
      return a.hits
    case 'R':
      return a.runs
    case 'SB':
      return a.stolenBases
    case 'K':
      return a.strikeOuts
    default:
      return 0
  }
}

function hitterDisplay(category: string, value: number): string {
  if (['AVG', 'OPS', 'OBP', 'SLG'].includes(category)) return value.toFixed(3).replace(/^0/, '')
  return String(Math.round(value))
}

const HITTER_ASCENDING = new Set<string>()

function pitcherInnings(a: PitcherAgg): number {
  return a.outs / 3
}

export function pitcherCategoryValue(a: PitcherAgg, category: string): number {
  const ip = pitcherInnings(a)
  switch (category) {
    case 'ERA':
      return ip > 0 ? (a.earnedRuns * 9) / ip : 0
    case 'W':
      return a.wins
    case 'K':
      return a.strikeOuts
    case 'WHIP':
      return ip > 0 ? (a.baseOnBalls + a.hits) / ip : 0
    case 'K/9':
      return ip > 0 ? (a.strikeOuts * 9) / ip : 0
    case 'BB/9':
      return ip > 0 ? (a.baseOnBalls * 9) / ip : 0
    case 'SV':
      return a.saves
    case 'HLD':
      return a.holds
    case 'QS':
      return a.qualityStarts
    default:
      return 0
  }
}

function pitcherDisplay(category: string, value: number): string {
  if (['ERA', 'WHIP', 'K/9', 'BB/9'].includes(category)) return value.toFixed(2)
  return String(Math.round(value))
}

const PITCHER_ASCENDING = new Set(['ERA', 'WHIP', 'BB/9'])

async function buildHandednessRows(
  names: string[],
  group: 'hitting' | 'pitching',
  hand: HandednessOption,
  category: string,
  teams: Map<number, MlbTeamInfo> | null,
  limit: number
): Promise<LeaderRow[]> {
  const sitCode = hand === 'vs LHP' ? 'vl' : 'vr'
  const resolved = await resolvePlayerIds(names)

  const results = await Promise.all(
    resolved.map(async (p) => {
      const split = await getPlayerHandednessSplit(p.id, sitCode, group)
      if (!split) return null
      const stat = split.stat
      const agg: HitterAgg & PitcherAgg = {
        atBats: Number(stat.atBats ?? 0),
        hits: Number(stat.hits ?? 0),
        baseOnBalls: Number(stat.baseOnBalls ?? 0),
        hitByPitch: Number(stat.hitByPitch ?? 0),
        sacFlies: Number(stat.sacFlies ?? 0),
        totalBases: Number(stat.totalBases ?? 0),
        homeRuns: Number(stat.homeRuns ?? 0),
        rbi: Number(stat.rbi ?? 0),
        runs: Number(stat.runs ?? 0),
        stolenBases: Number(stat.stolenBases ?? 0),
        strikeOuts: Number(stat.strikeOuts ?? 0),
        outs: Number(stat.outs ?? 0),
        earnedRuns: Number(stat.earnedRuns ?? 0),
        wins: Number(stat.wins ?? 0),
        saves: Number(stat.saves ?? 0),
        holds: Number(stat.holds ?? 0),
        qualityStarts: 0,
        games: Number(stat.gamesPlayed ?? 0),
      }
      const value = group === 'hitting' ? hitterCategoryValue(agg, category) : pitcherCategoryValue(agg, category)
      const display = group === 'hitting' ? hitterDisplay(category, value) : pitcherDisplay(category, value)
      const teamId = split.team?.id
      return {
        name: p.fullName,
        team: teamId ? (teams?.get(teamId)?.abbr ?? '') : '',
        value,
        display,
        games: agg.games,
      }
    })
  )

  const valid = results.filter((r): r is NonNullable<typeof r> => r !== null && r.games > 0)
  const ascending = group === 'hitting' ? HITTER_ASCENDING.has(category) : PITCHER_ASCENDING.has(category)
  const sorted = valid.sort((a, b) => (ascending ? a.value - b.value : b.value - a.value)).slice(0, limit)

  return sorted.map((r, i) => ({ rank: i + 1, name: r.name, team: r.team, value: r.display, record: '—', hitPct: 0 }))
}

/**
 * Computes a filtered leaderboard for one Hitters/Pitchers category from the notable-players
 * pool's real game logs. Handedness uses a season-long split (the API has no way to combine
 * it with the other per-game filters), so when active it takes priority and the other filters
 * are ignored for that computation.
 */
export async function getFilteredLeaders(
  sub: 'Hitters' | 'Pitchers',
  category: string,
  filters: LeaderFilters,
  limit = 15
): Promise<LeaderRow[]> {
  const teams = await getMlbTeamsIndex()
  const group: 'hitting' | 'pitching' = sub === 'Hitters' ? 'hitting' : 'pitching'
  const names = sub === 'Hitters' ? NOTABLE_HITTERS : NOTABLE_PITCHERS

  if (filters.handedness !== 'All') {
    return buildHandednessRows(names, group, filters.handedness, category, teams, limit)
  }

  const resolved = await resolvePlayerIds(names)

  const career = isCareer(filters.window)
  const results = await mapWithConcurrency(resolved, 8, async (p) => {
      const log = await mlbLog(p.id, group, career)
      const matching = (log ?? []).filter((g) => gameMatchesFilters(g, filters, teams))

      if (sub === 'Hitters') {
        const agg = emptyHitterAgg()
        matching.forEach((g) => addHitterGame(agg, g))
        const teamId = matching[matching.length - 1]?.team.id
        return {
          name: p.fullName,
          team: teamId ? (teams?.get(teamId)?.abbr ?? '') : '',
          value: hitterCategoryValue(agg, category),
          display: hitterDisplay(category, hitterCategoryValue(agg, category)),
          games: agg.games,
        }
      }

      const agg = emptyPitcherAgg()
      matching.forEach((g) => addPitcherGame(agg, g))
      const teamId = matching[matching.length - 1]?.team.id
      return {
        name: p.fullName,
        team: teamId ? (teams?.get(teamId)?.abbr ?? '') : '',
        value: pitcherCategoryValue(agg, category),
        display: pitcherDisplay(category, pitcherCategoryValue(agg, category)),
        games: agg.games,
      }
    })

  const valid = results.filter((r) => r.games > 0)
  const ascending = sub === 'Hitters' ? HITTER_ASCENDING.has(category) : PITCHER_ASCENDING.has(category)
  const sorted = valid.sort((a, b) => (ascending ? a.value - b.value : b.value - a.value)).slice(0, limit)

  return sorted.map((r, i) => ({ rank: i + 1, name: r.name, team: r.team, value: r.display, record: '—', hitPct: 0 }))
}
