import { combineAmericanOdds, profitForWin } from './odds'
import type { Bet, BetDetails, BetLeg, BetResult, BetType } from './types'

export const PARLAY_MIN_LEGS = 2
export const PARLAY_MAX_LEGS = 12
export const TEASER_MAX_LEGS = 6
export const TEASER_POINTS = [6, 6.5, 7] as const

/**
 * Typical sportsbook teaser prices by points moved and number of teams. Books differ, so these are
 * estimates that pre-fill the odds box — the user can overwrite them with their book's price.
 */
const TEASER_ODDS: Record<number, Record<number, number>> = {
  6: { 2: -120, 3: 100, 4: 180, 5: 300, 6: 450 },
  6.5: { 2: -130, 3: -110, 4: 160, 5: 260, 6: 400 },
  7: { 2: -140, 3: -120, 4: 140, 5: 225, 6: 350 },
}

export function teaserOdds(points: number, legCount: number): number | null {
  return TEASER_ODDS[points]?.[legCount] ?? null
}

export function isMultiLeg(type: BetType): boolean {
  return type === 'Parlay' || type === 'Teaser'
}

/** Combined American price for a parlay's legs (decimal odds multiplied). Pushed legs drop out. */
export function parlayOdds(legs: Pick<BetLeg, 'odds' | 'result'>[]): number | null {
  const live = legs.filter((l) => l.result !== 'push')
  return combineAmericanOdds(live.map((l) => l.odds))
}

/** A parlay/teaser loses on any lost leg, waits on pending ones, pushes if every leg pushed, otherwise wins. */
export function deriveMultiLegResult(legs: Pick<BetLeg, 'result'>[]): BetResult {
  if (legs.some((l) => l.result === 'loss')) return 'loss'
  if (legs.some((l) => l.result === 'pending')) return 'pending'
  if (legs.every((l) => l.result === 'push')) return 'push'
  return 'win'
}

/** The odds a winning ticket is paid at: pushed legs are removed, so a 3-leg parlay with a push pays as a 2-leg. */
export function payoutOdds(type: BetType, odds: number, details?: BetDetails | null): number {
  if (type === 'Parlay' && details && details.legs.some((l) => l.result === 'push')) {
    return parlayOdds(details.legs) ?? odds
  }
  return odds
}

/** Profit for a ticket given its result (null while pending). */
export function profitFor(type: BetType, result: BetResult, odds: number, stake: number, details?: BetDetails | null): number | null {
  if (result === 'win') return profitForWin(payoutOdds(type, odds, details), stake)
  if (result === 'loss') return -stake
  if (result === 'push') return 0
  return null
}

/** What a pending ticket would pay in profit if it wins. */
export function potentialProfit(type: BetType, odds: number, stake: number, details?: BetDetails | null): number {
  return profitForWin(payoutOdds(type, odds, details), stake)
}

/** "NYY vs BOS" for the history row — or the first game plus a count for multi-game tickets. */
export function gameLabel(bet: Pick<Bet, 'bet_type' | 'details'>): string | null {
  const legs = bet.details?.legs
  if (!legs || legs.length === 0) return null
  if (legs.length === 1) return `${legs[0].away} vs ${legs[0].home}`
  const games = new Set(legs.map((l) => `${l.away}-${l.home}-${l.gameDate ?? ''}`))
  return games.size === 1 ? `${legs[0].away} vs ${legs[0].home}` : `${games.size} games`
}

/** Builds the readable one-line description saved in `description` (and shown if details are missing). */
export function describeBet(type: BetType, legs: BetLeg[], odds: number, teaserPoints?: number): string {
  const price = odds > 0 ? `+${odds}` : `${odds}`
  if (type === 'Parlay') return `${legs.length}-leg parlay ${price}: ${legs.map((l) => l.pick).join(' / ')}`
  if (type === 'Teaser') return `${legs.length}-leg ${teaserPoints ?? ''}pt teaser ${price}: ${legs.map((l) => l.pick).join(' / ')}`
  return `${legs[0]?.pick ?? ''} ${price}`.trim()
}
