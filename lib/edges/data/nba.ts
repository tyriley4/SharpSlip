import { q } from '../evidenceFramework'
import type { ModuleInput } from '../modules/shared'
import type { Edge, GameContext, ModuleOutput } from '../types'

/**
 * NBA data connections. The regular season opens October 20: until then preseason games are hidden and no analysis is
 * generated. After that, fatigue is read from the schedule (back-to-backs and three games in four nights); usage is read
 * from minutes in the role module; the defense matchup comes from team ratings already loaded with the game.
 */

export { NBA_ANALYSIS_NOTE } from '../seasonText'

export interface NbaGameFacts {
  /** Games each team plays in the four nights ending with tonight (including tonight). */
  gamesInFour: Record<string, number>
}

export function loadNbaGameFacts(game: Pick<GameContext, 'away' | 'home' | 'results' | 'startTime'>): NbaGameFacts {
  const ref = game.startTime ? Date.parse(game.startTime) : Date.now()
  const count = (abbr: string) => 1 + (game.results[abbr] ?? []).filter((g) => (ref - Date.parse(g.date)) / 86400000 <= 3.5 && (ref - Date.parse(g.date)) / 86400000 > 0).length
  return { gamesInFour: { [game.away]: count(game.away), [game.home]: count(game.home) } }
}

/** Fatigue evidence: the opponent on three games in four nights, or the player's own team in that spot. */
export function getNbaEvidence({ outcome: o, game }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  const facts = game.facts.nba
  if (!facts) return { edges, conflicts }
  const team = o.type === 'player_prop' ? o.player?.team : o.team?.abbr
  const opp = o.type === 'player_prop' ? o.opponent : o.team?.opponent
  if (!team || !opp || o.type === 'total') return { edges, conflicts }
  const mine = facts.gamesInFour[team]
  const theirs = facts.gamesInFour[opp]
  const over = o.direction !== 'under'
  if (theirs >= 3 && mine <= 2 && over) edges.push({ description: `${opp} is playing its third game in four nights while ${team} is on ${mine === 2 ? 'a normal schedule' : 'rest'} — tired legs on the other side`, category: 'situational', horizon: 'tonight', layer: 'situational', relevanceScore: 0.55, supportingData: 'Schedule', weight: 0.08, ageDays: 0, quality: q(2, 3, 3, 1) })
  else if (mine >= 3 && theirs <= 2) conflicts++
  return { edges, conflicts }
}
