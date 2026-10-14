import type { ThresholdConviction } from '@/lib/edges/playerEdge'
export type PlayerSport = 'mlb' | 'nfl' | 'cfb' | 'nba' | 'cbb' | 'nhl'

export type StatLine = Record<string, string | number>

export interface RecentFormGame {
  opp: string
  date: string
  result: 'W' | 'L'
  /** Position-specific box score fields, e.g. { ip, h, er, k, bb } or { comp, yds, td, int, rating } */
  stats: StatLine
}

export interface PropRecord {
  label: string
  line: string
  record: string
  hitRate: number
}

export interface MatchupSplit {
  name: string
  games: number
  stat: string
  note?: string
}

export interface TonightEdge {
  oppDefenseRank?: string
  propLine?: string
  propRecord?: string
  hitRate?: number
  lean?: string
  risk?: string
  last10?: boolean[]
  /** The prop this edge is about, so the card can look up its career hit rate. */
  prop?: { category: string; threshold: number }
  /** Conviction for that prop against tonight's game (server-filled), or why there is none. */
  conviction?: { matchup?: string; href?: string; row: ThresholdConviction } | { unavailable: string }
}

export interface CareerVsOpponentSeason {
  season: string
  games: number
  stats: StatLine
  tone?: 'positive' | 'negative' | 'neutral'
}

export interface CareerVsOpponent {
  opponent?: string
  record?: string
  overall?: StatLine
  seasons?: CareerVsOpponentSeason[]
}

export interface PlayerRow {
  id: string
  slug: string
  name: string
  team: string
  sport: PlayerSport
  position: string
  is_hot: boolean
  headline_stat: string | null
  season_stats: StatLine
  recent_form: RecentFormGame[]
  prop_records: PropRecord[]
  best_opponents: MatchupSplit[]
  worst_opponents: MatchupSplit[]
  best_venues: MatchupSplit[]
  worst_venues: MatchupSplit[]
  career_vs_opponents: CareerVsOpponent
  tonight_edge: TonightEdge
  created_at: string
  updated_at: string
}
