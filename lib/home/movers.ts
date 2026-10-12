import { getPlayerGameLog } from '@/lib/mlb/api'
import { NOTABLE_HITTERS } from '@/lib/mlb/notablePlayers'
import { resolvePlayerIds } from '@/lib/mlb/playerLookup'
import { getMlbTeamsIndex } from '@/lib/mlb/teams'
import { getNBAPlayerGameLog } from '@/lib/nba/api'
import { NOTABLE_NBA_PLAYERS } from '@/lib/nba/notablePlayers'
import { resolveNbaPlayerIds } from '@/lib/nba/playerLookup'
import { getNHLPlayerGameLog } from '@/lib/nhl/api'
import { NOTABLE_NHL_SKATERS } from '@/lib/nhl/notablePlayers'
import { resolveNhlSkaterIds } from '@/lib/nhl/playerLookup'
import type { Sport } from '@/lib/sport/SportContext'
import { mapWithConcurrency, withTimeout } from '@/lib/utils/concurrency'

const CONCURRENCY = 5

export const MOVER_WINDOWS = ['7D', '14D', '30D'] as const
export type MoverWindow = (typeof MOVER_WINDOWS)[number]
const WINDOW_DAYS: Record<MoverWindow, number> = { '7D': 7, '14D': 14, '30D': 30 }

export interface CondensedMover {
  sport: Sport
  player: string
  team: string
  category: string
  value: string
  changePct: number | null
  isHot: boolean
}

function daysAgo(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000
}

interface Candidate {
  sport: Sport
  player: string
  team: string
  category: string
  unit: string
  current: number
  prior: number
  sampleGames: number
}

function toMovers(candidates: Candidate[], count: number): { hot: CondensedMover[]; cold: CondensedMover[] } {
  // Requires a minimum combined sample so a single huge/tiny game doesn't dominate the ranking.
  const qualified = candidates.filter((c) => c.sampleGames >= 3)
  const withChange = qualified.map((c) => ({
    ...c,
    changePct: c.prior > 0 ? Math.round(((c.current - c.prior) / c.prior) * 1000) / 10 : c.current > 0 ? 100 : 0,
  }))

  const sorted = [...withChange].sort((a, b) => b.changePct - a.changePct)
  const hot = sorted.slice(0, count).map(
    (c): CondensedMover => ({ sport: c.sport, player: c.player, team: c.team, category: c.category, value: `${c.current} ${c.unit}`, changePct: c.changePct, isHot: true })
  )
  const cold = [...sorted]
    .reverse()
    .slice(0, count)
    .map((c): CondensedMover => ({ sport: c.sport, player: c.player, team: c.team, category: c.category, value: `${c.current} ${c.unit}`, changePct: c.changePct, isHot: false }))

  return { hot, cold }
}

async function mlbCandidates(days: number): Promise<Candidate[]> {
  const [resolved, teams] = await Promise.all([resolvePlayerIds(NOTABLE_HITTERS), getMlbTeamsIndex()])
  const cutoffCurrent = daysAgo(days)
  const cutoffPrior = daysAgo(days * 2)

  const results = await mapWithConcurrency(
    resolved,
    CONCURRENCY,
    async (p): Promise<Candidate | null> => {
      const log = await getPlayerGameLog(p.id, 'hitting')
      if (!log) return null
      const current = log.filter((g) => new Date(g.date).getTime() >= cutoffCurrent)
      const prior = log.filter((g) => new Date(g.date).getTime() >= cutoffPrior && new Date(g.date).getTime() < cutoffCurrent)
      const sum = (rows: typeof log) => rows.reduce((s, g) => s + Number(g.stat.hits ?? 0), 0)
      const teamId = current[current.length - 1]?.team.id ?? prior[prior.length - 1]?.team.id
      return {
        sport: 'mlb',
        player: p.fullName,
        team: teamId ? teams?.get(teamId)?.abbr ?? '' : '',
        category: 'Hits',
        unit: 'H',
        current: sum(current),
        prior: sum(prior),
        sampleGames: current.length + prior.length,
      }
    }
  )
  return results.filter((r): r is Candidate => r !== null)
}

async function nbaCandidates(days: number): Promise<Candidate[]> {
  const resolved = await resolveNbaPlayerIds(NOTABLE_NBA_PLAYERS)
  const cutoffCurrent = daysAgo(days)
  const cutoffPrior = daysAgo(days * 2)

  const results = await mapWithConcurrency(
    resolved,
    CONCURRENCY,
    async (p): Promise<Candidate | null> => {
      const log = await getNBAPlayerGameLog(p.playerId)
      if (!log) return null
      const current = log.filter((g) => new Date(g.gameDate).getTime() >= cutoffCurrent)
      const prior = log.filter((g) => new Date(g.gameDate).getTime() >= cutoffPrior && new Date(g.gameDate).getTime() < cutoffCurrent)
      const sum = (rows: typeof log) => rows.reduce((s, g) => s + g.pts, 0)
      return {
        sport: 'nba',
        player: p.name,
        team: p.teamAbbr,
        category: 'Points',
        unit: 'PTS',
        current: sum(current),
        prior: sum(prior),
        sampleGames: current.length + prior.length,
      }
    }
  )
  return results.filter((r): r is Candidate => r !== null)
}

async function nhlCandidates(days: number): Promise<Candidate[]> {
  const resolved = await resolveNhlSkaterIds(NOTABLE_NHL_SKATERS)
  const cutoffCurrent = daysAgo(days)
  const cutoffPrior = daysAgo(days * 2)

  const results = await mapWithConcurrency(
    resolved,
    CONCURRENCY,
    async (p): Promise<Candidate | null> => {
      const log = await getNHLPlayerGameLog(p.playerId)
      if (!log) return null
      const current = log.filter((g) => new Date(g.gameDate).getTime() >= cutoffCurrent)
      const prior = log.filter((g) => new Date(g.gameDate).getTime() >= cutoffPrior && new Date(g.gameDate).getTime() < cutoffCurrent)
      const sum = (rows: typeof log) => rows.reduce((s, g) => s + g.points, 0)
      return {
        sport: 'nhl',
        player: p.name,
        team: p.teamAbbr,
        category: 'Points',
        unit: 'PTS',
        current: sum(current),
        prior: sum(prior),
        sampleGames: current.length + prior.length,
      }
    }
  )
  return results.filter((r): r is Candidate => r !== null)
}

/**
 * Condensed cross-sport hot/cold movers: ranks by % change between the current window and an
 * equal-length prior window (so categories/sports with different raw scales stay comparable).
 * NFL is omitted — there's no per-player weekly stat-trending infra built for it yet.
 */
export async function getCondensedMovers(window: MoverWindow = '7D', count = 3): Promise<{ hot: CondensedMover[]; cold: CondensedMover[] }> {
  const days = WINDOW_DAYS[window]
  const bounded = (p: Promise<Candidate[]>) => withTimeout(p, 20000, [] as Candidate[])
  const [mlb, nba, nhl] = await Promise.all([bounded(mlbCandidates(days)), bounded(nbaCandidates(days)), bounded(nhlCandidates(days))])
  return toMovers([...mlb, ...nba, ...nhl], count)
}
