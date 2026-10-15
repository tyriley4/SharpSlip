/**
 * Game-count time windows for the Leaders boards ("Last 15" = each player's own 15 most recent games), as opposed to
 * the day-based windows (Last 30/14/7) that cut by calendar date for everyone.
 */
const COUNT = /^Last (\d+)( games)?$/

/** Windows measured in games, per sport. Day-based windows keep their existing "Last 30/14/7" names. */
export const GAME_COUNT_WINDOWS = {
  mlb: ['Last 5', 'Last 10', 'Last 15', 'Last 20'],
  nba: ['Last 5', 'Last 10', 'Last 15', 'Last 20'],
  nhl: ['Last 5', 'Last 10', 'Last 15', 'Last 20'],
  nfl: ['Last 3', 'Last 5'],
} as const

/** A window narrower than the full season (Last N games or Last N days), the ones worth comparing to the season rate. */
export function isRollingWindow(window: string): boolean {
  return window !== 'Season' && window !== 'Career'
}

/** The N of a game-count window, or null for Season / Career / day-based windows. */
export function windowGameCount(window: string): number | null {
  // "Last 30/14/7" are calendar-day windows, not game counts.
  if (window === 'Last 30' || window === 'Last 14' || window === 'Last 7') return null
  const m = COUNT.exec(window)
  return m ? Number(m[1]) : null
}

/**
 * Keep a player's `n` most recent games, preserving the source order. `dateOf` returns a sortable date string
 * (ISO) or a week number.
 */
export function takeLastGames<T>(games: T[], window: string, dateOf: (g: T) => string | number): T[] {
  const n = windowGameCount(window)
  if (n === null || games.length <= n) return games
  const newest = new Set([...games].sort((a, b) => (dateOf(a) < dateOf(b) ? 1 : dateOf(a) > dateOf(b) ? -1 : 0)).slice(0, n))
  return games.filter((g) => newest.has(g))
}
