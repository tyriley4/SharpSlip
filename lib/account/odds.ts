import type { OddsFormat } from './types'

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/** American → decimal odds (e.g. -110 → 1.91, +145 → 2.45). */
export function americanToDecimal(odds: number): number {
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds)
}

/** American → reduced fractional odds (e.g. -110 → "10/11", +145 → "29/20"). */
export function americanToFractional(odds: number): string {
  const num = odds > 0 ? odds : 100
  const den = odds > 0 ? 100 : Math.abs(odds)
  const divisor = gcd(num, den) || 1
  return `${num / divisor}/${den / divisor}`
}

export function formatAmericanOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`
}

/** Formats a raw American-odds integer for display in the user's preferred odds format. */
export function formatOdds(odds: number, format: OddsFormat): string {
  if (format === 'Decimal') return americanToDecimal(odds).toFixed(2)
  if (format === 'Fractional') return americanToFractional(odds)
  return formatAmericanOdds(odds)
}

/** Profit on a win, given American odds and a dollar stake (excludes the returned stake itself). */
export function profitForWin(odds: number, stake: number): number {
  const raw = odds > 0 ? stake * (odds / 100) : stake * (100 / Math.abs(odds))
  return Math.round(raw * 100) / 100
}

/** Decimal → American odds (inverse of americanToDecimal). */
export function decimalToAmerican(decimal: number): number {
  if (decimal >= 2) return Math.round((decimal - 1) * 100)
  return Math.round(-100 / (decimal - 1))
}

/** Combines a parlay's American-odds legs into one American price via decimal-odds multiplication. */
export function combineAmericanOdds(legOdds: number[]): number | null {
  if (legOdds.length === 0) return null
  const combinedDecimal = legOdds.reduce((acc, odds) => acc * americanToDecimal(odds), 1)
  return decimalToAmerican(combinedDecimal)
}
