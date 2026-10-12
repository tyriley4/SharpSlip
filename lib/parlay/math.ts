import { americanToDecimal, decimalToAmerican } from '@/lib/account/odds'

/** Implied win probability (0-100) of an American price, vig included. */
export function impliedProb(american: number): number {
  return american < 0 ? (-american / (-american + 100)) * 100 : (100 / (american + 100)) * 100
}

/** Two-sided no-vig probability (0-100) for side A given both sides' American prices. */
export function noVigProb(oddsA: number, oddsB: number): number {
  const a = impliedProb(oddsA)
  const b = impliedProb(oddsB)
  return (a / (a + b)) * 100
}

/** Fair (no-vig) American price for a probability (0-100). */
export function americanFromProb(prob: number): number {
  const p = Math.min(97, Math.max(3, prob))
  if (p >= 50) return -Math.round((p / (100 - p)) * 100)
  return Math.round(((100 - p) / p) * 100)
}

/** Sportsbook-style price for a side with a small built-in margin, clamped to a realistic range. */
export function priceFromProb(prob: number, margin = 2.2): number {
  const raw = americanFromProb(Math.min(97, prob + margin))
  if (raw > -100 && raw < 100) return raw >= 0 ? 100 : -100
  return raw
}

/** Maps an insight's 50-96 confidence score onto a more conservative estimated hit probability. */
export function edgeToProb(conf: number): number {
  return Math.round(50 + (conf - 50) * 0.5)
}

/** Grade shown for a leg derived from its estimated probability. */
export function gradeFromProb(prob: number): 'A' | 'B' | 'C' {
  if (prob >= 66) return 'A'
  if (prob >= 57) return 'B'
  return 'C'
}

/** Combined probability (0-100) of every leg hitting, assuming independent legs. */
export function combinedProb(probs: number[]): number {
  if (probs.length === 0) return 0
  return probs.reduce((acc, p) => acc * (p / 100), 1) * 100
}

/** Combined decimal odds: each probability → decimal odds, multiplied together. */
export function combinedDecimal(probs: number[]): number {
  if (probs.length === 0) return 0
  return probs.reduce((acc, p) => acc * (100 / Math.max(1, p)), 1)
}

export function combinedAmerican(probs: number[]): number | null {
  if (probs.length === 0) return null
  return decimalToAmerican(combinedDecimal(probs))
}

/** Parlay payout multiplier from the legs' actual posted American prices — the juice stays in. */
export function combinedDecimalFromPrices(prices: number[]): number {
  if (prices.length === 0) return 0
  return prices.reduce((acc, p) => acc * americanToDecimal(p), 1)
}

export function combinedAmericanFromPrices(prices: number[]): number | null {
  if (prices.length === 0) return null
  return decimalToAmerican(combinedDecimalFromPrices(prices))
}

export interface ProbTone {
  color: string
  label: string
}

/** Color bands for the parlay probability bar. */
export function probTone(prob: number): ProbTone {
  if (prob >= 70) return { color: '#00E5A0', label: 'Strong' }
  if (prob >= 50) return { color: '#A3E635', label: 'Solid' }
  if (prob >= 35) return { color: '#FFB800', label: 'Moderate' }
  if (prob >= 20) return { color: '#FF6B35', label: 'Long shot' }
  return { color: '#EF4444', label: 'Very long shot' }
}

export function formatProb(prob: number): string {
  if (prob >= 10) return `${Math.round(prob)}%`
  return `${prob.toFixed(1)}%`
}
