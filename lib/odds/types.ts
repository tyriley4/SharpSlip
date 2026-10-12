import type { Sport } from '@/lib/sport/SportContext'

export type OddsSource = 'the-odds-api' | 'oddspapi' | 'espn'

/** One side of a market at a specific book. `point` is the spread/total line for that side. */
export interface Side {
  price: number
  point: number | null
  book: string
}

export interface BookLine {
  bookKey: string
  book: string
  awayMl: number | null
  homeMl: number | null
  /** Away team's spread. */
  awaySpread: { point: number; price: number } | null
  homeSpread: { point: number; price: number } | null
  total: { point: number; over: number | null; under: number | null } | null
}

export interface GameOdds {
  sport: Sport
  gameId: string
  /** Provider event id, needed to fetch player props. */
  eventId: string | null
  source: OddsSource
  fetchedAt: string
  commenceTime: string | null
  live: boolean
  away: string
  home: string
  /** Sportsbook the headline lines come from. */
  book: string
  moneyline: { away: Side | null; home: Side | null }
  /** Spread offered on each team; `point` is that team's own line (e.g. away -1.5 / home +1.5). */
  spread: { away: Side | null; home: Side | null }
  total: { line: number | null; over: Side | null; under: Side | null }
  /** Every book that posted this game (headline book first), for the compare table. */
  books: BookLine[]
}

export interface OddsBoard {
  sport: Sport
  source: OddsSource
  fetchedAt: string
  games: GameOdds[]
}

export type OddsFailure = 'unavailable'

export interface PropOffer {
  /** Provider market key, e.g. "player_points". */
  market: string
  marketLabel: string
  player: string
  line: number
  over: Side | null
  under: Side | null
}

export interface GamePropsResult {
  sport: Sport
  gameId: string
  source: 'the-odds-api'
  fetchedAt: string
  props: PropOffer[]
}

/** Remaining-credit bookkeeping for The Odds API. */
export interface CreditState {
  remaining: number | null
  used: number | null
  lastCost: number | null
  exhausted: boolean
  updatedAt: string | null
  month: string
  /** YYYY-MM-DD the daily spend counter below belongs to. */
  day?: string
  /** Monthly `used` figure at the start of `day`, so credits spent today = used - usedAtDayStart. */
  usedAtDayStart?: number | null
}
