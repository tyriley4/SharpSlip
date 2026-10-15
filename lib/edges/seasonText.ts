/** Season-context wording shared by the server (engine notes) and the browser (banners). */
export const NBA_PRESEASON_BANNER = 'NBA Regular Season begins October 20 — preseason games hidden. Full analysis available from opening night.'
export const PRESEASON_ANALYSIS_NOTE = 'Preseason Game — analysis not generated. Rotations and minutes are experimental.'
export const PLAYOFF_BANNER = 'Playoff analysis — evidence weighted toward recent form and matchup-specific factors'
export const EARLY_SEASON_NOTE = 'Early season — analysis weighted toward historical patterns and offseason context as current season data builds.'

/** NBA 2026-27 regular season tip-off: preseason games before this date (US Eastern) are hidden from the games tab. */
export const NBA_REGULAR_SEASON_START = '2026-10-20'

/** True when an NBA game (YYYY-MM-DD or an ISO timestamp) falls before the 2026 regular-season opener, by Eastern date. */
export function isNbaPreseasonDate(date: string | null | undefined): boolean {
  if (!date) return false
  const day = date.length > 10 ? new Date(date).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) : date
  return day >= '2026-09-01' && day < NBA_REGULAR_SEASON_START
}
