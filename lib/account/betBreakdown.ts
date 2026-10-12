import { isMultiLeg } from './parlay'
import type { Bet, BetSport } from './types'

export interface BetTally {
  bets: number
  wins: number
  losses: number
  pushes: number
  /** Dollars won or lost on settled bets. */
  profit: number
}

export interface TeamTally extends BetTally {
  sport: BetSport
  abbr: string
}

export interface PlayerTally extends BetTally {
  sport: BetSport
  name: string
}

function emptyTally(): BetTally {
  return { bets: 0, wins: 0, losses: 0, pushes: 0, profit: 0 }
}

function add(t: BetTally, bet: Bet) {
  t.bets++
  if (bet.result === 'win') t.wins++
  else if (bet.result === 'loss') t.losses++
  else if (bet.result === 'push') t.pushes++
  t.profit += bet.profit ?? 0
}

/**
 * Tallies straight bets (not parlays/teasers, whose result belongs to the whole ticket) by the team that was
 * backed — moneylines and spreads — so Favorites can show which teams a user actually bets and how they've done.
 */
export function teamTallies(bets: Bet[]): TeamTally[] {
  const map = new Map<string, TeamTally>()
  for (const bet of bets) {
    if (isMultiLeg(bet.bet_type)) continue
    const leg = bet.details?.legs?.[0]
    if (!leg?.team) continue
    const key = `${leg.sport}:${leg.team}`
    const t = map.get(key) ?? { ...emptyTally(), sport: leg.sport, abbr: leg.team }
    add(t, bet)
    map.set(key, t)
  }
  return Array.from(map.values())
}

/** Same idea for single player props, keyed by player. */
export function playerTallies(bets: Bet[]): PlayerTally[] {
  const map = new Map<string, PlayerTally>()
  for (const bet of bets) {
    if (isMultiLeg(bet.bet_type)) continue
    const leg = bet.details?.legs?.[0]
    if (!leg?.player) continue
    const key = `${leg.sport}:${leg.player}`
    const t = map.get(key) ?? { ...emptyTally(), sport: leg.sport, name: leg.player }
    add(t, bet)
    map.set(key, t)
  }
  return Array.from(map.values())
}

export function recordText(t: BetTally): string {
  return `${t.wins}-${t.losses}${t.pushes > 0 ? `-${t.pushes}` : ''}`
}

export function profitText(profit: number): string {
  const r = Math.round(profit)
  return `${r > 0 ? '+' : r < 0 ? '-' : ''}$${Math.abs(r).toLocaleString('en-US')}`
}
