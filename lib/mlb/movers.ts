import { getPlayerGameLog } from './api'
import { NOTABLE_HITTERS, NOTABLE_PITCHERS } from './notablePlayers'
import { resolvePlayerIds } from './playerLookup'
import { getMlbTeamsIndex } from './teams'

export interface MoverPlayer {
  name: string
  team: string
  value: number
  display: string
}

export interface MoverCategoryResult {
  hot: MoverPlayer[]
  cold: MoverPlayer[]
}

export const HITTER_MOVER_CATEGORIES = ['Hits', 'Home Runs', 'RBIs', 'Total Bases', 'Runs', 'Walks'] as const
export const PITCHER_MOVER_CATEGORIES = ['Strikeouts', 'Quality Starts', 'Outs'] as const

export type HitterMoverCategory = (typeof HITTER_MOVER_CATEGORIES)[number]
export type PitcherMoverCategory = (typeof PITCHER_MOVER_CATEGORIES)[number]

function daysAgo(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000
}

export const MOVER_WINDOWS = ['7D', '14D', '30D'] as const
export type MoverWindow = (typeof MOVER_WINDOWS)[number]

export const MOVER_WINDOW_DAYS: Record<MoverWindow, number> = { '7D': 7, '14D': 14, '30D': 30 }

async function computeHitterAggregates(days: number): Promise<{ name: string; team: string; stats: Record<HitterMoverCategory, number> }[]> {
  const [resolved, teams] = await Promise.all([resolvePlayerIds(NOTABLE_HITTERS), getMlbTeamsIndex()])
  const cutoff = daysAgo(days)

  const results = await Promise.all(
    resolved.map(async (p) => {
      const log = await getPlayerGameLog(p.id, 'hitting')
      const recent = (log ?? []).filter((g) => new Date(g.date).getTime() >= cutoff)
      const stats: Record<HitterMoverCategory, number> = {
        Hits: 0,
        'Home Runs': 0,
        RBIs: 0,
        'Total Bases': 0,
        Runs: 0,
        Walks: 0,
      }
      for (const g of recent) {
        stats.Hits += Number(g.stat.hits ?? 0)
        stats['Home Runs'] += Number(g.stat.homeRuns ?? 0)
        stats.RBIs += Number(g.stat.rbi ?? 0)
        stats['Total Bases'] += Number(g.stat.totalBases ?? 0)
        stats.Runs += Number(g.stat.runs ?? 0)
        stats.Walks += Number(g.stat.baseOnBalls ?? 0)
      }
      const teamId = recent[recent.length - 1]?.team.id
      const teamAbbr = teamId ? (teams?.get(teamId)?.abbr ?? '') : ''
      return { name: p.fullName, team: teamAbbr, stats, gamesPlayed: recent.length }
    })
  )

  return results.filter((r) => r.gamesPlayed > 0).map((r) => ({ name: r.name, team: r.team, stats: r.stats }))
}

async function computePitcherAggregates(days: number): Promise<{ name: string; team: string; stats: Record<PitcherMoverCategory, number> }[]> {
  const [resolved, teams] = await Promise.all([resolvePlayerIds(NOTABLE_PITCHERS), getMlbTeamsIndex()])
  const cutoff = daysAgo(days)

  const results = await Promise.all(
    resolved.map(async (p) => {
      const log = await getPlayerGameLog(p.id, 'pitching')
      const recent = (log ?? []).filter((g) => new Date(g.date).getTime() >= cutoff)
      const stats: Record<PitcherMoverCategory, number> = { Strikeouts: 0, 'Quality Starts': 0, Outs: 0 }
      for (const g of recent) {
        stats.Strikeouts += Number(g.stat.strikeOuts ?? 0)
        stats.Outs += Number(g.stat.outs ?? 0)
        const ip = parseFloat(String(g.stat.inningsPitched ?? '0'))
        const er = Number(g.stat.earnedRuns ?? 99)
        if (ip >= 6.0 && er <= 3) stats['Quality Starts'] += 1
      }
      const teamId = recent[recent.length - 1]?.team.id
      const teamAbbr = teamId ? (teams?.get(teamId)?.abbr ?? '') : ''
      return { name: p.fullName, team: teamAbbr, stats, gamesPlayed: recent.length }
    })
  )

  return results.filter((r) => r.gamesPlayed > 0)
}

function formatDisplay(category: string, value: number): string {
  const unit = category === 'Home Runs' ? 'HR' : category === 'RBIs' ? 'RBI' : category === 'Total Bases' ? 'TB'
    : category === 'Walks' ? 'BB' : category === 'Strikeouts' ? 'K' : category === 'Quality Starts' ? 'QS'
    : category === 'Outs' ? 'Outs' : category === 'Runs' ? 'R' : 'H'
  return `${value} ${unit}`
}

function rankTopBottom(
  entries: { name: string; team: string; stats: Record<string, number> }[],
  category: string
): MoverCategoryResult {
  const withValue = entries.map((e) => ({ name: e.name, team: e.team, value: e.stats[category] ?? 0 }))
  const sorted = [...withValue].sort((a, b) => b.value - a.value)
  const hot = sorted.slice(0, 3).map((e) => ({ ...e, display: formatDisplay(category, e.value) }))
  const cold = sorted
    .slice(-3)
    .reverse()
    .map((e) => ({ ...e, display: formatDisplay(category, e.value) }))
  return { hot, cold }
}

export interface MoversData {
  hitters: Record<HitterMoverCategory, MoverCategoryResult>
  pitchers: Record<PitcherMoverCategory, MoverCategoryResult>
}

/** Computes hot/cold top-3 for every mover category, from the notable-players pool's game logs over the given window. */
export async function getMoversData(window: MoverWindow = '7D'): Promise<MoversData> {
  const days = MOVER_WINDOW_DAYS[window]
  const [hitterAggs, pitcherAggs] = await Promise.all([computeHitterAggregates(days), computePitcherAggregates(days)])

  const hitters = Object.fromEntries(
    HITTER_MOVER_CATEGORIES.map((cat) => [cat, rankTopBottom(hitterAggs, cat)])
  ) as Record<HitterMoverCategory, MoverCategoryResult>

  const pitchers = Object.fromEntries(
    PITCHER_MOVER_CATEGORIES.map((cat) => [cat, rankTopBottom(pitcherAggs, cat)])
  ) as Record<PitcherMoverCategory, MoverCategoryResult>

  return { hitters, pitchers }
}
