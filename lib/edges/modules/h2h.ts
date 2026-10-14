import { weightedPlayerRate, weightedTeamRate } from '../historicalRates'
import type { Edge, ModuleOutput } from '../types'
import { fmtPct, outcomeNoun, playerHit, rateRelevance, subjectTeam, teamHit, type ModuleInput } from './shared'

const W_CAREER_VS = 0.12
const W_RECENT_VS = 0.06
const W_TEAM_VS = 0.1
/** Fewer meetings than this is anecdote, not pattern. */
const MIN_MEETINGS = 3

/**
 * MODULE 5: how has this player or team done against this specific opponent? Needs at least three meetings;
 * team-vs-team looks back three seasons at most (older rosters are not comparable).
 */
export function h2hModule({ outcome: o, game, history }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  const noun = outcomeNoun(o)

  if (o.type === 'player_prop') {
    const opp = o.opponent
    if (!opp || !history) return { edges, conflicts }
    const vs = history.games.filter((g) => g.opp === opp)
    if (vs.length < MIN_MEETINGS) return { edges, conflicts }
    const r = weightedPlayerRate(vs, (g) => playerHit(o, g))
    if (r && r.rate > 0.52) {
      edges.push({
        description: `Against ${opp}, cleared ${noun} in ${r.hits} of ${r.games} career games (${fmtPct(r.hits / r.games)})`,
        category: 'h2h',
        relevanceScore: rateRelevance(r.hits / r.games),
        supportingData: 'Recent seasons weighted more',
        weight: W_CAREER_VS,
        sample: r.games,
      })
      const last3 = vs.slice(0, 3).map((g) => playerHit(o, g))
      if (last3.length === 3 && last3.every((x) => x === true)) {
        edges.push({ description: `Cleared ${noun} in each of the last 3 meetings with ${opp}`, category: 'h2h', relevanceScore: 0.7, supportingData: vs.slice(0, 3).map((g) => g.values[o.category ?? '']).join(', '), weight: W_RECENT_VS, sample: 3 })
      }
    } else if (r && r.rate < 0.48) conflicts++
    return { edges, conflicts }
  }

  // Team outcomes: only the meetings between these two teams within the three-season window.
  const subjectGames = o.type === 'total' ? game.results[game.home] : game.results[subjectTeam(o) ?? '']
  const other = o.type === 'total' ? game.away : o.team?.opponent
  if (!other) return { edges, conflicts }
  const meets = (subjectGames ?? []).filter((g) => g.opp === other)
  if (meets.length < MIN_MEETINGS) return { edges, conflicts }
  const r = weightedTeamRate(meets, (g) => teamHit(o, g))
  if (r && r.games >= MIN_MEETINGS) {
    const raw = r.hits / r.games
    if (raw > 0.52) {
      edges.push({
        description: `In the last ${new Set(meets.map((g) => g.season)).size} season${new Set(meets.map((g) => g.season)).size === 1 ? '' : 's'} of meetings: ${o.type === 'moneyline' ? `${subjectTeam(o)} won` : `cleared ${noun}`} in ${r.hits} of ${r.games}`,
        category: 'h2h',
        relevanceScore: rateRelevance(raw),
        supportingData: 'Three-season window; older meetings are not used',
        weight: W_TEAM_VS,
        sample: r.games,
      })
    } else if (raw < 0.48) conflicts++
  }
  return { edges, conflicts }
}
