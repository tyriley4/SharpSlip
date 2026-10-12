import type { Sport } from '@/lib/sport/SportContext'

export interface SportTabStyle {
  id: Sport
  icon: string
  label: string
  color: string
  textOnActive: string
  glow: string
}

export const SPORT_TAB_STYLES: SportTabStyle[] = [
  { id: 'mlb', icon: '⚾', label: 'MLB', color: '#00E5A0', textOnActive: '#08090C', glow: 'rgba(0,229,160,0.3)' },
  { id: 'nfl', icon: '🏈', label: 'NFL', color: '#EF4444', textOnActive: '#FFFFFF', glow: 'rgba(239,68,68,0.3)' },
  { id: 'cfb', icon: '🏈', label: 'CFB', color: '#8B0000', textOnActive: '#FFFFFF', glow: 'rgba(139,0,0,0.4)' },
  { id: 'nba', icon: '🏀', label: 'NBA', color: '#FF6B35', textOnActive: '#FFFFFF', glow: 'rgba(255,107,53,0.3)' },
  { id: 'cbb', icon: '🏀', label: 'CBB', color: '#FF9F1C', textOnActive: '#08090C', glow: 'rgba(255,159,28,0.3)' },
  { id: 'nhl', icon: '🏒', label: 'NHL', color: '#3B9EFF', textOnActive: '#FFFFFF', glow: 'rgba(59,158,255,0.3)' },
]

export const RANK_STYLES = [
  { label: '1st', color: '#FFD700', glow: 'rgba(255,215,0,0.35)' },
  { label: '2nd', color: '#C0C0C0', glow: 'rgba(192,192,192,0.2)' },
  { label: '3rd', color: '#CD7F32', glow: 'rgba(205,127,50,0.25)' },
]

export const POSITION_COLORS: Record<string, string> = {
  QB: '#3B9EFF',
  RB: '#10B981',
  WR: '#FF6B35',
  TE: '#A855F7',
  DEF: '#EF4444',
  Hitters: '#00E5A0',
  Pitchers: '#FFB800',
  Skaters: '#3B9EFF',
  Goalies: '#A855F7',
}

/** Short badge text for a leaderboard position group. */
export function positionBadge(sub: string): string | null {
  switch (sub) {
    case 'Hitters':
      return 'HIT'
    case 'Pitchers':
      return 'PIT'
    case 'Skaters':
      return 'SKT'
    case 'Goalies':
      return 'G'
    case 'QB':
    case 'RB':
    case 'WR':
    case 'TE':
    case 'DEF':
      return sub
    default:
      return null
  }
}

/** Hit-rate color bands used by bars and values. */
export function hitRateColor(pct: number): string {
  if (pct >= 65) return '#00E5A0'
  if (pct >= 55) return '#FFB800'
  return '#EF4444'
}

/** Parses a displayed stat ("0.312", ".312", "1,204", "67.5%", "—") into a number, or null. */
export function parseNumeric(v: string): number | null {
  const cleaned = v.replace(/[,%+\s]/g, '')
  if (cleaned === '' || cleaned === '—' || cleaned === '-') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/** Consecutive hits counted from the most recent game (index 0 is newest). */
export function currentStreak(last5: boolean[]): number {
  let n = 0
  for (const hit of last5) {
    if (hit) n++
    else break
  }
  return n
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Lightens very dark team colors (navy, maroon…) so text, borders and bars stay visible on the dark UI. */
export function readableTeamColor(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255
  if (luminance >= 0.3) return hex
  const mix = Math.min(0.65, (0.3 - luminance) * 2.2 + 0.25)
  const out = rgb.map((c) => Math.round(c + (255 - c) * mix))
  return `#${out.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}
