import type { LeaderRow } from '@/data/leaders/types'
import type { BettingSort } from '@/lib/betting/rank'
import type { BettingLeaderRow } from '@/lib/mlb/bettingLeaders'
import type { Sport } from '@/lib/sport/SportContext'
import type { TrendQuery } from '@/lib/trend/types'
import { parseNumeric } from './theme'

/** A leaderboard row normalised for both game-stat and betting-stat presentation. */
export interface BoardRow {
  rank: number
  name: string
  team: string
  value: string
  numeric: number | null
  hot?: boolean
  hitRate?: number
  wins?: number
  losses?: number
  gamesPlayed?: number
  last5?: boolean[]
  /** Hit rate over the full season, present when a narrower window is selected. */
  seasonHitRate?: number
  /** Profit in dollars from flat $10 betting (Most Profitable sort) — at `price` when known, else -110. */
  profit?: number
  /** The prop's real American price at a sportsbook right now, when one is posted. */
  price?: number
  priceBook?: string
  /** Conviction Score sort: grade against tonight's matchup (null = ungraded) and the 0-1 score behind it. */
  grade?: string | null
  conviction?: number
  /** Why there is no conviction, e.g. "No game today". */
  convictionNote?: string
}

export interface BoardContext {
  sport: Sport
  teamColors: Record<string, string>
  /** Sub-tab (Hitters, QB, Teams, …) — drives the position badge. */
  sub: string
  isTeamRows: boolean
  /** Name of the ranked stat, e.g. "HR" or "1+ Hits". */
  statLabel: string
  betting: boolean
  thresholdLabel?: string
  sportIcon: string
  /** How betting rows are presented: hit-rate %, W-L record, or flat-bet dollars. */
  sortMode?: BettingSort
  /** `${name}|${team}` of the "Best Value" player (highest hit rate that meets the sample minimum). */
  bestValueKey?: string
  /** Players picked in the Team → Player filter; everyone else is dimmed. */
  selectedPlayers?: string[]
  /** Powers the Chart view's trend lines. */
  trend?: TrendQuery
  /** Shown as a small badge/note when a Career window is active. */
  career?: boolean
}

export function boardRowsFromLeaders(rows: LeaderRow[]): BoardRow[] {
  return rows.map((r) => ({ rank: r.rank, name: r.name, team: r.team, value: r.value, numeric: parseNumeric(r.value), hot: r.hot }))
}

export function boardRowsFromBetting(rows: (BettingLeaderRow & { profit?: number; price?: number; priceBook?: string })[]): BoardRow[] {
  return rows.map((r) => ({
    rank: r.rank,
    name: r.name,
    team: r.team,
    value: `${r.hitRate}%`,
    numeric: r.hitRate,
    hitRate: r.hitRate,
    wins: r.wins,
    losses: r.losses,
    gamesPlayed: r.gamesPlayed,
    last5: r.last5,
    seasonHitRate: r.seasonHitRate,
    profit: r.profit,
    price: r.price,
    priceBook: r.priceBook,
  }))
}

export const BOARD_LIMIT = 15
