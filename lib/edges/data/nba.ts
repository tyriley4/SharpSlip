import type { GameContext } from '../types'

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
