import { getTodaysGameBreakdowns, type GameEdges } from './gameBreakdowns'
import type { UnifiedGame } from './schedule'
import type { Edge } from '@/data/breakdown/types'
import type { Sport } from '@/lib/sport/SportContext'

export type ConvictionTier = 'strong' | 'edge' | null

export interface TopGame {
  game: UnifiedGame
  sport: Sport
  netScore: number
  tier: ConvictionTier
}

const GRADE_POINTS: Record<string, number> = { 'A+': 3, A: 3, 'A-': 3, 'B+': 2, B: 2, 'B-': 1, C: 1 }
const MAX_TOP_GAMES = 6
const QUALIFY_SCORE = 4
const ALL_SPORTS: Sport[] = ['mlb', 'nfl', 'cfb', 'nba', 'cbb', 'nhl']

function netScore(edges: Edge[]): number {
  const byTeam = new Map<string, number>()
  for (const e of edges) {
    if (!e.team) continue
    byTeam.set(e.team, (byTeam.get(e.team) ?? 0) + (GRADE_POINTS[e.grade] ?? 0))
  }
  const points = Array.from(byTeam.values())
  if (points.length === 0) return 0
  if (points.length === 1) return points[0]
  const sorted = points.sort((a, b) => b - a)
  return sorted[0] - sorted[sorted.length - 1]
}

function tierFor(score: number): ConvictionTier {
  if (score >= 6) return 'strong'
  if (score >= QUALIFY_SCORE) return 'edge'
  return null
}

/**
 * Ranks today's games by net edge conviction (Grade A=3/B=2/C=1 points per team, net score =
 * the gap between the two teams' totals). Games scoring 4+ qualify as "Top Games"; if fewer than
 * 6 qualify, remaining slots are filled with games that have known TV network coverage (a proxy
 * for national visibility — per-team win/loss record isn't available at this layer without an
 * extra standings fetch per sport, so that half of the spec'd fallback criterion is simplified).
 */
export function deriveTopGames(breakdowns: Record<Sport, GameEdges[]>): TopGame[] {
  const scored: TopGame[] = []
  for (const sport of ALL_SPORTS) {
    for (const { game, edges } of breakdowns[sport]) {
      const score = netScore(edges)
      scored.push({ game, sport, netScore: score, tier: tierFor(score) })
    }
  }

  const qualifying = scored.filter((g) => g.netScore >= QUALIFY_SCORE).sort((a, b) => b.netScore - a.netScore)
  if (qualifying.length >= MAX_TOP_GAMES) return qualifying.slice(0, MAX_TOP_GAMES)

  const used = new Set(qualifying.map((g) => `${g.sport}-${g.game.id}`))
  const remaining = scored.filter((g) => !used.has(`${g.sport}-${g.game.id}`))
  const withNetwork = remaining.filter((g) => g.game.network)
  const withoutNetwork = remaining.filter((g) => !g.game.network)
  const filler = [...withNetwork, ...withoutNetwork].slice(0, MAX_TOP_GAMES - qualifying.length)

  return [...qualifying, ...filler]
}

/** Convenience wrapper for callers that haven't already fetched breakdowns. */
export async function getTopGamesToday(): Promise<TopGame[]> {
  return deriveTopGames(await getTodaysGameBreakdowns())
}
