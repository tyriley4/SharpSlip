import { cfbOpponentWeight } from '../data/cfb'
import type { ModuleInput } from '../modules/shared'
import type { Edge, ModuleOutput } from '../types'
import { ev, f1, recRelevance, recText, signed } from './format'
import { footballEvidence } from './football'
import { atVenue, avgAgainst, avgFor, currentSeason, totalSide, wins, games as played } from './records'

/**
 * College football evidence: the NFL framework with the college adjustments. Opponents from the power conferences count
 * 1.3x and everyone else 0.8x (applied inside the shared module), conference games are their own records, home field
 * carries more weight than in the pros (so the home and road margins are compared directly), and totals between conference
 * opponents add each team's scoring against conference opponents only.
 */
export function cfbEvidence(input: ModuleInput): ModuleOutput {
  const base = footballEvidence(input, 'cfb')
  const { outcome: o, game } = input
  const edges: Edge[] = [...base.edges]
  let conflicts = base.conflicts

  // Home field: the margin at home against the margin on the road, this season.
  if ((o.type === 'spread' || o.type === 'moneyline') && o.team) {
    const T = o.team.abbr
    const cur = currentSeason(game, T).filter((g) => !g.playoff)
    const here = atVenue(cur, o.team.home)
    const there = atVenue(cur, !o.team.home)
    if (here.length >= 2 && there.length >= 2) {
      const mHere = avgFor(here) - avgAgainst(here)
      const mThere = avgFor(there) - avgAgainst(there)
      const weight = cfbOpponentWeight(game.conference[o.team.opponent], o.team.opponent) ?? 1
      const tierNote = weight > 1 ? `${o.team.opponent} is a power-conference opponent, so results against it count 1.3x` : weight < 1 ? `${o.team.opponent} is outside the power conferences, so results against it count 0.8x` : ''
      if (o.team.home && mHere - mThere >= 7) edges.push(ev({ tier: 4, text: `${T} has an average margin of ${signed(mHere)} points at home (${recText(wins(here))}) vs ${signed(mThere)} on the road (${recText(wins(there))}) this season — a ${f1(mHere - mThere)}-point home-field swing, and tonight is at ${T}'s stadium${tierNote ? `; ${tierNote}` : ''}`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(wins(here).w, wins(here).l), support: `${here.length} home and ${there.length} road games`, n: here.length, smallSample: here.length < 4, scale: weight }))
      else if (!o.team.home && mThere - mHere >= 7) conflicts++
      else if (!o.team.home && mHere - mThere >= 7) conflicts++
    }
  }

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
      const all = (abbr: string) => currentSeason(game, abbr)
      if (rate >= 0.6) {
        edges.push(
          ev({
            tier: 4,
            text: `In ${conf} games: ${game.away} scoring ${f1(avgFor(a))} and allowing ${f1(avgAgainst(a))} vs ${f1(avgFor(all(game.away)))} and ${f1(avgAgainst(all(game.away)))} in all games (${word} ${o.threshold} in ${ra.w} of ${a.length}); ${game.home} scoring ${f1(avgFor(h))} and allowing ${f1(avgAgainst(h))} vs ${f1(avgFor(all(game.home)))} and ${f1(avgAgainst(all(game.home)))} in all games (${word} ${o.threshold} in ${rh.w} of ${h.length}) — tonight is a ${conf} game`,
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
