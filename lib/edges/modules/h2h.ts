import { q } from '../evidenceFramework'
import { minimumsFor } from '../minimums'
import { weightedPlayerRate, weightedTeamRate } from '../historicalRates'
import type { Edge, ModuleOutput } from '../types'
import { fmtPct, outcomeNoun, playerHit, rateRelevance, scaled, seasonWeightFn, subjectTeam, teamHit, type ModuleInput } from './shared'

const W_CAREER_VS = 0.12
const W_RECENT_VS = 0.06
const W_TEAM_VS = 0.1
const W_VENUE_VS = 0.08
/** Fewer meetings than this is anecdote, not pattern (doubled in the playoffs). */
const MIN_MEETINGS = 3

const sampleOf = (n: number) => (n >= 12 ? 3 : n >= 6 ? 2 : 1)

/**
 * How has this player or team done against this specific opponent? Needs at least three meetings (six in the
 * playoffs); recent seasons weigh more; a player's record at this exact venue is a separate, narrower item.
 */
export function h2hModule({ outcome: o, game, history }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  const noun = outcomeNoun(o)
  // Football teams meet rarely, so two career games are enough; everywhere else it takes three.
  const minMeetings = scaled(minimumsFor(game).early ? minimumsFor(game).h2h : MIN_MEETINGS, game)

  if (o.type === 'player_prop') {
    const opp = o.opponent
    if (!opp || !history) return { edges, conflicts }
    const vs = history.games.filter((g) => g.opp === opp)
    if (vs.length < minMeetings) return { edges, conflicts }
    const r = weightedPlayerRate(vs, (g) => playerHit(o, g), seasonWeightFn(history))
    if (r && r.rate > 0.52) {
      edges.push({
        description: `Against ${opp}, has cleared ${noun} in ${r.hits} of ${r.games} career games (${fmtPct(r.hits / r.games)}), averaging ${(vs.reduce((n, g) => n + (g.values[o.category ?? ''] ?? 0), 0) / vs.length).toFixed(1)} ${o.category}`,
        category: 'h2h',
        horizon: 'career_vs_opp',
        relevanceScore: rateRelevance(r.hits / r.games),
        supportingData: 'Recent seasons weighted more',
        weight: W_CAREER_VS,
        sample: r.games,
        seasonsAgo: 1,
        quality: q(3, 3, 1, sampleOf(r.games)),
      })
      const last3 = vs.slice(0, 3).map((g) => playerHit(o, g))
      if (last3.length === 3 && last3.every((x) => x === true)) {
        edges.push({ description: `Cleared ${noun} in each of the last 3 meetings with ${opp}`, category: 'h2h', relevanceScore: 0.7, supportingData: vs.slice(0, 3).map((g) => g.values[o.category ?? '']).join(', '), weight: W_RECENT_VS, sample: 3, quality: q(3, 3, 2, 0) })
      }
    } else if (r && r.rate < 0.48) conflicts++

    // Tonight's exact venue: his games against this opponent in this home/road situation.
    const home = o.homeAway === 'home' ? true : o.homeAway === 'away' ? false : null
    if (home !== null) {
      const here = vs.filter((g) => g.home === home)
      const vr = here.length >= scaled(4, game) ? weightedPlayerRate(here, (g) => playerHit(o, g)) : null
      if (vr && vr.rate > 0.6 && vr.games >= scaled(4, game)) {
        edges.push({
          description: `In ${vr.games} career games ${home ? 'at home' : 'on the road'} against ${opp}, has cleared ${noun} ${vr.hits} times (${fmtPct(vr.hits / vr.games)})`,
          category: 'h2h',
          relevanceScore: rateRelevance(vr.hits / vr.games),
          supportingData: `Tonight's venue and opponent`,
          weight: W_VENUE_VS,
          sample: vr.games,
          seasonsAgo: 1,
          quality: q(3, 3, 1, sampleOf(vr.games)),
        })
      }
    }
    return { edges, conflicts }
  }

  // Team outcomes: only the meetings between these two teams within the three-season window.
  const subjectGames = o.type === 'total' ? game.results[game.home] : game.results[subjectTeam(o) ?? '']
  const other = o.type === 'total' ? game.away : o.team?.opponent
  if (!other) return { edges, conflicts }
  const meets = (subjectGames ?? []).filter((g) => g.opp === other)
  if (meets.length < minMeetings) return { edges, conflicts }
  const r = weightedTeamRate(meets, (g) => teamHit(o, g))
  if (r && r.games >= minMeetings) {
    const raw = r.hits / r.games
    if (raw > 0.52) {
      const seasons = new Set(meets.map((g) => g.season)).size
      edges.push({
        description: `In the last ${seasons} season${seasons === 1 ? '' : 's'} of meetings: ${o.type === 'moneyline' ? `${subjectTeam(o)} won` : `cleared ${noun}`} in ${r.hits} of ${r.games}`,
        category: 'h2h',
        relevanceScore: rateRelevance(raw),
        supportingData: 'Three-season window; older meetings are not used',
        weight: W_TEAM_VS,
        sample: r.games,
        smallSample: r.games < MIN_MEETINGS ? r.games : undefined,
        seasonsAgo: 1,
        quality: q(3, 3, 1, sampleOf(r.games)),
      })
    } else if (raw < 0.48) conflicts++
  }
  return { edges, conflicts }
}
