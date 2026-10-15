import type { GameContext } from './types'

/**
 * Sample-size minimums. When the current season is below the standard minimum the evidence is NOT suppressed: it is
 * produced from what exists, flagged as an early-season signal, and the historical record carries more weight until the
 * sample builds. MLB keeps the standard minimums (162 games make them appropriate); the NFL's 17-game season uses the
 * lower ones throughout; NBA, NHL and college lower them for the opening games.
 */
export interface Minimums {
  /** Team record (win percentage) and matchup-adjusted season rate. */
  winPct: number
  /** Recent team form window. */
  recentForm: number
  /** Meetings needed for head-to-head. */
  h2h: number
  /** Games for a margin trend. */
  marginTrend: number
  /** Games against same-quality opponents. */
  tierSplit: number
  /** Games at the venue (home/road) for a venue split. */
  venueSplit: number
  /** True when these are the reduced, early-season minimums. */
  early: boolean
}

const STANDARD: Minimums = { winPct: 8, recentForm: 5, h2h: 3, marginTrend: 10, tierSplit: 8, venueSplit: 6, early: false }
const NFL: Minimums = { winPct: 4, recentForm: 3, h2h: 1, marginTrend: 5, tierSplit: 4, venueSplit: 3, early: true }

/** Current-season games the home team has played (postseason games included). */
export function gamesPlayed(game: Pick<GameContext, 'results' | 'home'>): number {
  const g = game.results[game.home] ?? []
  if (g.length === 0) return 0
  const season = Math.max(...g.map((x) => x.season))
  return g.filter((x) => x.season === season).length
}

export function minimumsFor(game: Pick<GameContext, 'sport' | 'results' | 'home'>): Minimums {
  if (game.sport === 'nfl') return NFL
  if (game.sport === 'mlb') return STANDARD
  const n = gamesPlayed(game)
  if (game.sport === 'cfb') return n < 6 ? NFL : { ...STANDARD, h2h: 2 }
  // NBA, NHL and college basketball: the first ten games lean on history.
  return n < 10 ? { ...NFL, h2h: 2 } : STANDARD
}

/** The note shown when an item rests on fewer games than the standard minimum. */
export const earlySignalNote = (n: number) => `Early season signal — ${n} game${n === 1 ? '' : 's'} — historical patterns carry more weight until the sample builds`
