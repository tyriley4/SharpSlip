export const TIME_WINDOWS = ['Season', 'Last 15', 'Last 10', 'Last 5', 'Last 30', 'Last 14', 'Last 7', 'Career'] as const
export type TimeWindow = (typeof TIME_WINDOWS)[number]

export const HOME_AWAY_OPTIONS = ['All', 'Home', 'Away'] as const
export type HomeAwayOption = (typeof HOME_AWAY_OPTIONS)[number]

export const HANDEDNESS_OPTIONS = ['All', 'vs RHP', 'vs LHP'] as const
export type HandednessOption = (typeof HANDEDNESS_OPTIONS)[number]

export const DAY_NIGHT_OPTIONS = ['All', 'Day', 'Night'] as const
export type DayNightOption = (typeof DAY_NIGHT_OPTIONS)[number]

export const MONTH_OPTIONS = ['All', 'April', 'May', 'June', 'July', 'August', 'September'] as const
export type MonthOption = (typeof MONTH_OPTIONS)[number]

export interface LeaderFilters {
  window: TimeWindow
  team: string // team abbreviation, or 'All Teams'
  homeAway: HomeAwayOption
  handedness: HandednessOption
  dayNight: DayNightOption
  month: MonthOption
}

export const DEFAULT_FILTERS: LeaderFilters = {
  window: 'Season',
  team: 'All Teams',
  homeAway: 'All',
  handedness: 'All',
  dayNight: 'All',
  month: 'All',
}

export function hasActiveFilters(f: LeaderFilters): boolean {
  return (
    f.window !== DEFAULT_FILTERS.window ||
    f.team !== DEFAULT_FILTERS.team ||
    f.homeAway !== DEFAULT_FILTERS.homeAway ||
    f.handedness !== DEFAULT_FILTERS.handedness ||
    f.dayNight !== DEFAULT_FILTERS.dayNight ||
    f.month !== DEFAULT_FILTERS.month
  )
}

export function countActiveFilters(f: LeaderFilters): number {
  let count = 0
  if (f.window !== DEFAULT_FILTERS.window) count++
  if (f.team !== DEFAULT_FILTERS.team) count++
  if (f.homeAway !== DEFAULT_FILTERS.homeAway) count++
  if (f.handedness !== DEFAULT_FILTERS.handedness) count++
  if (f.dayNight !== DEFAULT_FILTERS.dayNight) count++
  if (f.month !== DEFAULT_FILTERS.month) count++
  return count
}

const MONTH_INDEX: Record<string, number> = {
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
}

export function monthToIndex(month: MonthOption): number | null {
  return month === 'All' ? null : MONTH_INDEX[month]
}

export function windowToDays(window: TimeWindow): number | null {
  if (window === 'Last 30') return 30
  if (window === 'Last 14') return 14
  if (window === 'Last 7') return 7
  return null
}

interface FilterableGame {
  date: string
  isHome: boolean
  opponent: { id: number }
  game?: { dayNight?: string }
}

/** Shared per-game filter predicate reused by both the leaders engine and the betting-stats engine. */
export function gameMatchesFilters(
  g: FilterableGame,
  filters: LeaderFilters,
  teamAbbrById: Map<number, { abbr: string }> | null
): boolean {
  const days = windowToDays(filters.window)
  if (days !== null) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    if (new Date(g.date).getTime() < cutoff) return false
  }

  if (filters.team !== 'All Teams') {
    const abbr = teamAbbrById?.get(g.opponent.id)?.abbr
    if (abbr !== filters.team) return false
  }

  if (filters.homeAway === 'Home' && !g.isHome) return false
  if (filters.homeAway === 'Away' && g.isHome) return false

  if (filters.dayNight !== 'All') {
    const dn = g.game?.dayNight
    if (filters.dayNight === 'Day' && dn !== 'day') return false
    if (filters.dayNight === 'Night' && dn !== 'night') return false
  }

  const monthIdx = monthToIndex(filters.month)
  if (monthIdx !== null && new Date(g.date).getMonth() !== monthIdx) return false

  return true
}
