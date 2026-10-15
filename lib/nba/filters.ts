import type { NBAPlayerGameLogRow } from './api'

export const TIME_WINDOWS = ['Season', 'Last 15', 'Last 10', 'Last 5', 'Last 30', 'Last 14', 'Last 7', 'Career'] as const
export type TimeWindow = (typeof TIME_WINDOWS)[number]

export const HOME_AWAY_OPTIONS = ['All', 'Home', 'Away'] as const
export type HomeAwayOption = (typeof HOME_AWAY_OPTIONS)[number]

export const MONTH_OPTIONS = ['All', 'October', 'November', 'December', 'January', 'February', 'March', 'April'] as const
export type MonthOption = (typeof MONTH_OPTIONS)[number]

export interface NBALeaderFilters {
  window: TimeWindow
  team: string
  homeAway: HomeAwayOption
  month: MonthOption
}

export const DEFAULT_NBA_FILTERS: NBALeaderFilters = {
  window: 'Season',
  team: 'All Teams',
  homeAway: 'All',
  month: 'All',
}

export function hasActiveNBAFilters(f: NBALeaderFilters): boolean {
  return f.window !== DEFAULT_NBA_FILTERS.window || f.team !== DEFAULT_NBA_FILTERS.team || f.homeAway !== DEFAULT_NBA_FILTERS.homeAway || f.month !== DEFAULT_NBA_FILTERS.month
}

export function countActiveNBAFilters(f: NBALeaderFilters): number {
  let count = 0
  if (f.window !== DEFAULT_NBA_FILTERS.window) count++
  if (f.team !== DEFAULT_NBA_FILTERS.team) count++
  if (f.homeAway !== DEFAULT_NBA_FILTERS.homeAway) count++
  if (f.month !== DEFAULT_NBA_FILTERS.month) count++
  return count
}

const MONTH_INDEX: Record<string, number> = {
  October: 9, November: 10, December: 11, January: 0, February: 1, March: 2, April: 3,
}

export function windowToDays(window: TimeWindow): number | null {
  if (window === 'Last 30') return 30
  if (window === 'Last 14') return 14
  if (window === 'Last 7') return 7
  return null
}

export function gameMatchesFilters(g: NBAPlayerGameLogRow, filters: NBALeaderFilters): boolean {
  const days = windowToDays(filters.window)
  if (days !== null) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    if (new Date(g.gameDate).getTime() < cutoff) return false
  }
  if (filters.team !== 'All Teams' && g.opponentAbbr !== filters.team) return false
  if (filters.homeAway === 'Home' && !g.isHome) return false
  if (filters.homeAway === 'Away' && g.isHome) return false
  if (filters.month !== 'All') {
    const monthIdx = MONTH_INDEX[filters.month]
    if (new Date(g.gameDate).getMonth() !== monthIdx) return false
  }
  return true
}
