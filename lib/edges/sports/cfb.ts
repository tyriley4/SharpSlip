import type { ModuleInput } from '../modules/shared'
import type { Edge, ModuleOutput } from '../types'
import { ev, f1, recRelevance } from './format'
import { footballEvidence } from './football'
import { avgAgainst, avgFor, currentSeason, totalSide, games as played } from './records'

/**
 * College football evidence: the NFL framework with the college adjustments. Opponents from the power conferences count
 * 1.3x and everyone else 0.8x (applied inside the shared module), conference games are their own records, and totals
 * between conference opponents add each team's scoring against conference opponents only.
 */
export function cfbEvidence(input: ModuleInput): ModuleOutput {
  const base = footballEvidence(input, 'cfb')
  const { outcome: o, game } = input
  const edges: Edge[] = [...base.edges]
  let conflicts = base.conflicts
  if (o.type === 'total' && o.threshold !== undefined && game.conference[game.away] && game.conference[game.away] === game.conference[game.home]) {
    const conf = game.conference[game.away]
    const over = o.direction !== 'under'
    const inConf = (abbr: string) => currentSeason(game, abbr).filter((g) => game.conference[g.opp] === conf)
    const a = inConf(game.away)
    const h = inConf(game.home)
    if (a.length >= 2 && h.length >= 2) {
      const ra = totalSide(a, o.threshold, over)
      const rh = totalSide(h, o.threshold, over)
      const word = over ? 'Over' : 'Under'
      const rate = (ra.w + rh.w) / Math.max(1, played(ra) + played(rh))
      if (rate >= 0.6) {
        edges.push(
          ev({
            tier: 4,
            text: `In ${conf} games: ${game.away} scoring ${f1(avgFor(a))} and allowing ${f1(avgAgainst(a))} (${word} ${o.threshold} in ${ra.w} of ${a.length}); ${game.home} scoring ${f1(avgFor(h))} and allowing ${f1(avgAgainst(h))} (${word} ${o.threshold} in ${rh.w} of ${h.length}) — tonight is a ${conf} game`,
            category: 'hit_rate',
            horizon: 'season',
            relevance: recRelevance(ra.w + rh.w, played(ra) + played(rh) - ra.w - rh.w),
            support: 'Games against same-conference opponents only',
            n: Math.min(a.length, h.length),
            smallSample: Math.min(a.length, h.length) < 4,
          })
        )
      } else if (rate <= 0.4) conflicts++
    }
  }
  return { edges, conflicts }
}
