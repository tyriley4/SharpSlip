/** Sports a bet can be logged against. College bets arrive from the parlay builder; the manual entry form lists the pro leagues. */
export type BetSport = 'mlb' | 'nfl' | 'cfb' | 'nba' | 'cbb' | 'nhl'
export const BET_SPORTS: BetSport[] = ['mlb', 'nfl', 'nba', 'nhl']

export const BET_TYPES = ['Moneyline', 'Spread', 'Total', 'Player Prop', 'Parlay', 'Teaser'] as const
export type BetType = (typeof BET_TYPES)[number]

export const BET_RESULTS = ['pending', 'win', 'loss', 'push'] as const
export type BetResult = (typeof BET_RESULTS)[number]

/** One selection inside a bet. A single bet has exactly one leg; parlays and teasers have several. */
export interface BetLeg {
  sport: BetSport
  /** 'Moneyline' | 'Spread' | 'Total' | 'Player Prop' — the market this leg is on. */
  market: Exclude<BetType, 'Parlay' | 'Teaser'>
  away: string
  home: string
  gameDate: string | null
  gameId?: string
  /** Short readable pick, e.g. "NYY ML", "Over 8.5", "Cole Over 6.5 Strikeouts". */
  pick: string
  odds: number
  result: BetResult
  team?: string
  side?: 'over' | 'under'
  line?: number
  player?: string
  category?: string
  /** Player-prop role (hitter/pitcher, skater/goalie) so the form can reopen with the right categories. */
  role?: string
}

export interface BetDetails {
  legs: BetLeg[]
  /** Teaser only: points each spread/total is moved (6, 6.5 or 7). */
  teaserPoints?: number
  /** How the stake was entered, so the form reopens the way it was logged. */
  stakeMode?: 'dollars' | 'units'
}

/** One betting unit, in dollars — used wherever the app converts between $ and units. */
export const UNIT_SIZE = 10

export interface Bet {
  id: string
  user_id: string
  sport: BetSport
  bet_type: BetType
  description: string
  odds: number
  stake: number
  game_date: string | null
  result: BetResult
  profit: number | null
  notes: string | null
  /** Structured legs; null for bets logged before this existed (or before migration 0006 was run). */
  details?: BetDetails | null
  created_at: string
  updated_at: string
}

export interface NewBetInput {
  sport: BetSport
  bet_type: BetType
  description: string
  odds: number
  stake: number
  game_date: string | null
  result: BetResult
  notes?: string | null
  details?: BetDetails | null
}

export interface FavoriteTeam {
  sport: BetSport
  abbr: string
}

export interface FavoritePlayer {
  sport: BetSport
  slug: string
  name: string
}

export interface Favorites {
  teams: FavoriteTeam[]
  players: FavoritePlayer[]
}

export const DEFAULT_FAVORITES: Favorites = { teams: [], players: [] }

export interface NotificationPrefs {
  edgeAlerts: boolean
  gameReminders: boolean
  resultUpdates: boolean
}

export const ODDS_FORMATS = ['American', 'Decimal', 'Fractional'] as const
export type OddsFormat = (typeof ODDS_FORMATS)[number]

export const SPORTSBOOKS = ['DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'PointsBet'] as const
export const EDGE_THRESHOLDS = [60, 65, 70, 75, 80] as const

/** Bet types a user can pick as preferences (multi-select) to personalize "Best Bets for You". */
export const BET_TYPE_PREFERENCES = ['Moneyline', 'Spread', 'Total', 'Player Props', 'Parlays', 'Teasers', 'Round Robin'] as const
export type BetTypePreference = (typeof BET_TYPE_PREFERENCES)[number]

export const RISK_TOLERANCES = ['conservative', 'moderate', 'aggressive'] as const
export type RiskTolerance = (typeof RISK_TOLERANCES)[number] | 'none'

export interface UserSettings {
  sportsbook: string
  oddsFormat: OddsFormat
  edgeThreshold: number
  notifications: NotificationPrefs
  betTypePreferences: BetTypePreference[]
  riskTolerance: RiskTolerance
}

export const DEFAULT_SETTINGS: UserSettings = {
  sportsbook: 'DraftKings',
  oddsFormat: 'American',
  edgeThreshold: 60,
  notifications: { edgeAlerts: true, gameReminders: true, resultUpdates: true },
  betTypePreferences: [],
  riskTolerance: 'none',
}
