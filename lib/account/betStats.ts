import { americanToDecimal, decimalToAmerican } from './odds'
import { UNIT_SIZE, type Bet } from './types'

export interface BetSummaryStats {
  wins: number
  losses: number
  pushes: number
  pending: number
  /** Every logged bet, settled or not. */
  total: number
  /** Average price across all bets (American), or null with no bets. */
  avgOdds: number | null
  winRate: number
  totalStaked: number
  totalReturned: number
  totalProfit: number
  roi: number
  units: number
  streak: { type: 'W' | 'L' | null; count: number }
}

const EMPTY_STATS: BetSummaryStats = {
  wins: 0,
  losses: 0,
  pushes: 0,
  pending: 0,
  total: 0,
  avgOdds: null,
  winRate: 0,
  totalStaked: 0,
  totalReturned: 0,
  totalProfit: 0,
  roi: 0,
  units: 0,
  streak: { type: null, count: 0 },
}

/** Computes record/ROI/streak/units from a user's full bet history. Settled = win/loss/push. */
export function computeBetStats(bets: Bet[]): BetSummaryStats {
  if (bets.length === 0) return EMPTY_STATS

  let wins = 0
  let losses = 0
  let pushes = 0
  let pending = 0
  let totalStaked = 0
  let totalReturned = 0

  for (const b of bets) {
    if (b.result === 'pending') {
      pending++
      continue
    }
    totalStaked += b.stake
    if (b.result === 'win') {
      wins++
      totalReturned += b.stake + (b.profit ?? 0)
    } else if (b.result === 'loss') {
      losses++
    } else if (b.result === 'push') {
      pushes++
      totalReturned += b.stake
    }
  }

  const settled = wins + losses
  const winRate = settled > 0 ? Math.round((wins / settled) * 1000) / 10 : 0
  const totalProfit = Math.round((totalReturned - totalStaked) * 100) / 100
  const roi = totalStaked > 0 ? Math.round((totalProfit / totalStaked) * 1000) / 10 : 0
  // A unit is $10 (UNIT_SIZE), matching the stake box that shows dollars and units side by side.
  const units = Math.round((totalProfit / UNIT_SIZE) * 10) / 10
  const avgDecimal = bets.reduce((s, b) => s + americanToDecimal(b.odds), 0) / bets.length

  const settledSorted = [...bets]
    .filter((b) => b.result === 'win' || b.result === 'loss')
    .sort((a, b) => new Date(b.game_date ?? b.created_at).getTime() - new Date(a.game_date ?? a.created_at).getTime())

  let streakType: 'W' | 'L' | null = null
  let streakCount = 0
  for (const b of settledSorted) {
    const t = b.result === 'win' ? 'W' : 'L'
    if (streakType === null) {
      streakType = t
      streakCount = 1
    } else if (t === streakType) {
      streakCount++
    } else {
      break
    }
  }

  return {
    wins,
    losses,
    pushes,
    pending,
    total: bets.length,
    avgOdds: decimalToAmerican(avgDecimal),
    winRate,
    totalStaked: Math.round(totalStaked * 100) / 100,
    totalReturned: Math.round(totalReturned * 100) / 100,
    totalProfit,
    roi,
    units,
    streak: { type: streakType, count: streakCount },
  }
}
