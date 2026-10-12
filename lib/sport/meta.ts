import type { Sport } from './SportContext'

export interface SportMeta {
  id: Sport
  icon: string
  label: string
  /** Brand color: pill fills, borders, chart accents. */
  color: string
  /** Readable-on-dark variant of `color`, for text. Equal to `color` except where the brand color is too dark to read. */
  text: string
}

/** Shared per-sport badge color, used by the ticker, top edges, scores strip, injuries, weather, and articles. */
export const SPORT_META: Record<Sport, SportMeta> = {
  mlb: { id: 'mlb', icon: '⚾', label: 'MLB', color: '#00E5A0', text: '#00E5A0' },
  nfl: { id: 'nfl', icon: '🏈', label: 'NFL', color: '#EF4444', text: '#EF4444' },
  // College football's dark red (#8B0000) vanishes on the dark theme as text, so labels use a lighter tint.
  cfb: { id: 'cfb', icon: '🏈', label: 'CFB', color: '#8B0000', text: '#F26B6B' },
  nba: { id: 'nba', icon: '🏀', label: 'NBA', color: '#FF6B35', text: '#FF6B35' },
  // A warmer amber-orange so it stays distinguishable from the NBA's red-orange.
  cbb: { id: 'cbb', icon: '🏀', label: 'CBB', color: '#FF9F1C', text: '#FF9F1C' },
  nhl: { id: 'nhl', icon: '🏒', label: 'NHL', color: '#3B9EFF', text: '#3B9EFF' },
}

export function sportMeta(sport: string): SportMeta {
  return SPORT_META[sport as Sport] ?? SPORT_META.mlb
}

/** Sports whose data comes from ESPN alone (no dedicated league API). */
export const COLLEGE_SPORTS: Sport[] = ['cfb', 'cbb']
export const isCollege = (sport: string): boolean => sport === 'cfb' || sport === 'cbb'
