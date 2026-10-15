import type { Edge, ModuleOutput } from '../types'
import { q } from '../evidenceFramework'
import { avg, type ModuleInput } from './shared'

const W_PACE = 0.08

/** A game total counts as a clear pace signal when the teams season average sits this far from the line (relative). */
const PACE_GAP = 0.04

/**
 * MODULE 6: broader factors about the game. Fires sparingly: a pace signal for totals. The previous-season note is
 * shown once at the top of the tab instead of on every bet. (Line movement is not available - the line archive keeps
 * only the latest number, not the opener.)
 */
export function contextModule({ outcome: o, game }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0

  if (o.type === 'total' && o.threshold !== undefined) {
    const seasonTotals = (abbr: string) => {
      const games = game.results[abbr] ?? []
      if (games.length === 0) return []
      const season = Math.max(...games.map((g) => g.season))
      return games.filter((g) => g.season === season).map((g) => g.us + g.them)
    }
    const a = seasonTotals(game.away)
    const h = seasonTotals(game.home)
    if (a.length >= 5 && h.length >= 5) {
      const mean = (avg(a) + avg(h)) / 2
      const gap = (mean - o.threshold) / o.threshold
      const over = o.direction !== 'under'
      if ((over && gap >= PACE_GAP) || (!over && gap <= -PACE_GAP)) {
        edges.push({
          description: `Season pace points toward ${over ? 'more' : 'less'} scoring: these teams average ${mean.toFixed(1)} combined points per game against a line of ${o.threshold}`,
          category: 'context',
          relevanceScore: Math.min(1, 0.5 + Math.abs(gap) * 5),
          supportingData: `${game.away} ${avg(a).toFixed(1)}, ${game.home} ${avg(h).toFixed(1)} per game`,
          weight: W_PACE,
          sample: Math.min(a.length, h.length),
          quality: q(2, 2, 2, 2),
        })
      } else if ((over && gap <= -PACE_GAP) || (!over && gap >= PACE_GAP)) conflicts++
    }
  }

  return { edges, conflicts }
}
