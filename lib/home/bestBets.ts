import type { BetTypePreference, UserSettings } from '@/lib/account/types'
import type { TodayBet } from '@/lib/edges/todaysBets'

const SINGLE_TYPES = ['Moneyline', 'Spread', 'Total', 'Player Props'] as const

function matchesBetType(bet: TodayBet['bet'], pref: BetTypePreference): boolean {
  switch (pref) {
    case 'Moneyline':
      return bet.market === 'Moneyline'
    case 'Spread':
      return bet.section === 'game' && ['Spread', 'Run Line', 'Puck Line'].includes(bet.market)
    case 'Total':
      return bet.market === 'Total'
    case 'Player Props':
      return bet.section === 'prop'
    default:
      return true
  }
}

export interface BestBetsResult {
  results: TodayBet[]
  personalized: boolean
  /** Grades included by the user's risk tolerance. */
  grades: string[]
}

/**
 * Today graded bets filtered to the user's preferences. Risk tolerance picks the grades (conservative A, moderate A and B,
 * aggressive A, B and C); with none set the drawer shows A and B. Bet-type preferences narrow single bets; parlay-style
 * preferences are not single-bet types and do not filter.
 */
export function filterBestBets(bets: TodayBet[], settings: UserSettings): BestBetsResult {
  const personalized = settings.betTypePreferences.length > 0 || settings.riskTolerance !== 'none'
  const grades = settings.riskTolerance === 'conservative' ? ['A'] : settings.riskTolerance === 'aggressive' ? ['A', 'B', 'C'] : ['A', 'B']
  let pool = bets.filter((b) => b.bet.grade && grades.includes(b.bet.grade))
  const singles = settings.betTypePreferences.filter((t) => (SINGLE_TYPES as readonly string[]).includes(t))
  if (singles.length > 0) pool = pool.filter((b) => singles.some((t) => matchesBetType(b.bet, t)))
  return { results: pool, personalized, grades }
}
