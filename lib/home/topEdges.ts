import { getTodaysGameBreakdowns, type GameEdges } from './gameBreakdowns'
import type { Edge } from '@/data/breakdown/types'
import type { Sport } from '@/lib/sport/SportContext'

export interface TopEdgeResult {
  sport: Sport
  gameId: string
  matchup: string
  edge: Edge
  href: string
}

const ALL_SPORTS: Sport[] = ['mlb', 'nfl', 'cfb', 'nba', 'cbb', 'nhl']

function bestFromList(sport: Sport, list: GameEdges[]): TopEdgeResult | null {
  let best: TopEdgeResult | null = null
  for (const { game, edges } of list) {
    const top = edges[0]
    if (top && (!best || top.conf > best.edge.conf)) {
      best = { sport, gameId: game.id, matchup: `${game.away.abbr} @ ${game.home.abbr}`, edge: top, href: game.href }
    }
  }
  return best
}

/** The single highest-confidence edge per sport, derived from an already-fetched breakdown set. */
export function deriveTopEdges(breakdowns: Record<Sport, GameEdges[]>): TopEdgeResult[] {
  const results = ALL_SPORTS.map((sport) => bestFromList(sport, breakdowns[sport]))
  return results.filter((r): r is TopEdgeResult => r !== null)
}

/** Every qualifying edge across every game and sport, derived from an already-fetched breakdown set. */
export function deriveAllEdges(breakdowns: Record<Sport, GameEdges[]>): TopEdgeResult[] {
  const out: TopEdgeResult[] = []
  for (const sport of ALL_SPORTS) {
    for (const { game, edges } of breakdowns[sport]) {
      for (const edge of edges) {
        out.push({ sport, gameId: game.id, matchup: `${game.away.abbr} @ ${game.home.abbr}`, edge, href: game.href })
      }
    }
  }
  return out.sort((a, b) => b.edge.conf - a.edge.conf)
}

/** Convenience wrapper for callers (API routes) that only need this one slice and haven't already fetched breakdowns. */
export async function getTopEdgesToday(): Promise<TopEdgeResult[]> {
  return deriveTopEdges(await getTodaysGameBreakdowns())
}

/** Convenience wrapper for callers (API routes) that only need this one slice and haven't already fetched breakdowns. */
export async function getAllEdgesToday(): Promise<TopEdgeResult[]> {
  return deriveAllEdges(await getTodaysGameBreakdowns())
}
