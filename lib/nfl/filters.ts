import { NFL_TEAM_DIVISIONS } from './divisions'

export const TIME_WINDOWS = ['Season', 'Last 5', 'Last 3', 'Last 30', 'Last 14', 'Last 7', 'Career'] as const
export type TimeWindow = (typeof TIME_WINDOWS)[number]

export const HOME_AWAY_OPTIONS = ['All', 'Home', 'Away'] as const
export type HomeAwayOption = (typeof HOME_AWAY_OPTIONS)[number]

export const MONTH_OPTIONS = ['All', 'September', 'October', 'November', 'December', 'January'] as const
export type MonthOption = (typeof MONTH_OPTIONS)[number]

export const CONFERENCE_OPTIONS = ['All', 'AFC', 'NFC'] as const
export type ConferenceOption = (typeof CONFERENCE_OPTIONS)[number]

export interface NFLLeaderFilters {
  window: TimeWindow
  /** Opponent abbreviation, or 'All Teams'. */
  team: string
  homeAway: HomeAwayOption
  month: MonthOption
  /** Opponent conference (used by the scatter builder; the Leaders board leaves it at 'All'). */
  conference: ConferenceOption
}

export const DEFAULT_NFL_FILTERS: NFLLeaderFilters = {
  window: 'Season',
  team: 'All Teams',
  homeAway: 'All',
  month: 'All',
  conference: 'All',
}

const MONTH_INDEX: Record<string, number> = { September: 8, October: 9, November: 10, December: 11, January: 0 }

export function windowToDays(window: TimeWindow): number | null {
  if (window === 'Last 30') return 30
  if (window === 'Last 14') return 14
  if (window === 'Last 7') return 7
  return null
}

/** One player-game: a weekly stat row joined to its schedule date. */
export interface NFLGameContext {
  date: string
  opponent: string
  isHome: boolean
}

export function gameMatchesFilters(g: NFLGameContext, filters: NFLLeaderFilters): boolean {
  const days = windowToDays(filters.window)
  if (days !== null && g.date) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    if (new Date(`${g.date}T12:00:00Z`).getTime() < cutoff) return false
  }
  if (filters.team !== 'All Teams' && g.opponent !== filters.team) return false
  if (filters.conference !== 'All' && !NFL_TEAM_DIVISIONS[g.opponent]?.startsWith(filters.conference)) return false
  if (filters.homeAway === 'Home' && !g.isHome) return false
  if (filters.homeAway === 'Away' && g.isHome) return false
  if (filters.month !== 'All' && g.date) {
    if (new Date(`${g.date}T12:00:00Z`).getUTCMonth() !== MONTH_INDEX[filters.month]) return false
  }
  return true
}
