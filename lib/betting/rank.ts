export const BETTING_SORTS = ['Hit Rate', 'W-L Record', 'Most Profitable', 'Conviction Score'] as const
export type BettingSort = (typeof BETTING_SORTS)[number]

/** 0 = no minimum. */
export const SAMPLE_OPTIONS = [0, 10, 20, 30, 50] as const
export type SampleMin = (typeof SAMPLE_OPTIONS)[number]
export const DEFAULT_SAMPLE_MIN: SampleMin = 10

/** Flat unit staked on every qualifying game for the Most Profitable sort. */
export const UNIT_STAKE = 10
/** Profit on a $10 win at standard -110 odds. */
export const WIN_PROFIT = Math.round(((UNIT_STAKE * 100) / 110) * 100) / 100
/** The price assumed for a row when no book price is known. */
export const DEFAULT_PRICE = -110
/** Fewer qualifying players than this and the minimum-sample filter relaxes itself rather than showing an empty board. */
const MIN_ROWS_FOR_FILTER = 3

export interface RankableRow {
  hitRate: number
  wins: number
  losses: number
  gamesPlayed: number
  /** American price of the Over at a sportsbook right now, when one is posted for this prop. */
  price?: number
}

export type RankedRow<T> = T & { rank: number; profit: number }

export interface RankResult<T> {
  rows: RankedRow<T>[]
  /** The minimum actually applied (may be lower than requested early in a season). */
  appliedMin: SampleMin
  relaxed: boolean
}

/**
 * Profit in dollars from flat $10 betting on every game. Priced at the book's actual price for the prop when one is
 * known (a -200 prop pays $5 per win, a +150 prop pays $15) and at -110 otherwise; losses always cost $10.
 */
export function flatBetProfit(wins: number, losses: number, price: number = DEFAULT_PRICE): number {
  const perWin = price > 0 ? (UNIT_STAKE * price) / 100 : (UNIT_STAKE * 100) / -price
  return Math.round((wins * perWin - losses * UNIT_STAKE) * 100) / 100
}

/** "+$230" / "-$45" */
export function formatProfit(profit: number): string {
  const rounded = Math.round(profit)
  return `${rounded >= 0 ? '+' : '-'}$${Math.abs(rounded).toLocaleString('en-US')}`
}

/**
 * Re-ranks a betting leaderboard.
 *
 * - Hit Rate: highest percentage first.
 * - W-L Record: most wins first (45-10 beats 15-3); hit rate breaks ties.
 * - Most Profitable: highest flat-bet profit first ($10 on every game at the prop's real price, else -110).
 * - Conviction Score: ordered like Hit Rate here; the board then re-orders the top players by their conviction against tonight's matchup.
 */
export function rankBetting<T extends RankableRow>(rows: T[], sort: BettingSort, requestedMin: SampleMin): RankResult<T> {
  let appliedMin = requestedMin
  let pool = rows.filter((r) => r.gamesPlayed >= appliedMin)
  let relaxed = false
  if (appliedMin > 0 && pool.length < MIN_ROWS_FOR_FILTER && rows.length > pool.length) {
    appliedMin = 0
    pool = rows
    relaxed = true
  }

  const withProfit = pool.map((r) => ({ ...r, profit: flatBetProfit(r.wins, r.losses, r.price) }))

  withProfit.sort((a, b) => {
    if (sort === 'W-L Record') return b.wins - a.wins || b.hitRate - a.hitRate || a.losses - b.losses
    if (sort === 'Most Profitable') return b.profit - a.profit || b.gamesPlayed - a.gamesPlayed
    return b.hitRate - a.hitRate || b.gamesPlayed - a.gamesPlayed
  })

  return { rows: withProfit.map((r, i) => ({ ...r, rank: i + 1 })), appliedMin, relaxed }
}
