import type { GameOdds } from '@/lib/odds/types'
import type { Sport } from '@/lib/sport/SportContext'

export type OutcomeType = 'moneyline' | 'spread' | 'total' | 'player_prop' | 'first_half' | 'first_period'
export type Direction = 'over' | 'under' | 'home' | 'away'
export type EdgeCategory = 'recent_form' | 'hit_rate' | 'matchup' | 'situational' | 'h2h' | 'context'

export interface PlayerContext {
  name: string
  team: string
  position?: string
}

export interface TeamContext {
  abbr: string
  opponent: string
  home: boolean
}

/** One specific thing a bettor could bet on. Everything the engine says is about this outcome. */
export interface BettingOutcome {
  type: OutcomeType
  sport: Sport
  gameId: string
  player?: PlayerContext
  team?: TeamContext
  /** The line: stat threshold, spread (the team own number, e.g. -3.5) or game total. */
  threshold?: number
  /** For props: the stat category label (Hits, Points, Passing Yards ...). */
  category?: string
  direction?: Direction
  /** American odds when a real price exists. */
  odds?: number
  /** Probability implied by the odds, 0-1 (no-vig when both sides are priced). */
  impliedProbability?: number
  /** Opponent abbreviation for props (the other team in the game). */
  opponent?: string
  homeAway?: 'home' | 'away'
}

export interface Edge {
  description: string
  category: EdgeCategory
  /** 0-1: how directly this fact bears on this outcome. */
  relevanceScore: number
  supportingData: string
  /** 0-1: how much weight this kind of evidence carries. */
  weight: number
  /** Optional multipliers the conviction score applies (module 1 recency, module 3 opposition quality). */
  recencyMultiplier?: number
  oppositionMultiplier?: number
  /** Games the evidence rests on (used for the sample-size cap). */
  sample?: number
}

export type Grade = 'A' | 'B' | 'C'

export interface EdgeResult {
  grade: Grade | null
  /** 0-1 */
  convictionScore: number
  /** 0-100 percentage; recency-weighted history of this exact outcome. */
  historicalHitRate: number | null
  edges: Edge[]
  isSharpFind: boolean
  sampleSize: number
  /** Primary evidence rests on fewer than 10 games, so the grade is capped at C. */
  limitedSample: boolean
  /** Why there is no grade, in plain words. */
  ungradedReason?: string
}

/** What one evidence module returns: supporting edges, plus how many facts point the other way (never shown). */
export interface ModuleOutput {
  edges: Edge[]
  conflicts: number
}

export interface PlayerGameRecord {
  season: string
  date: string
  home?: boolean
  opp?: string
  values: Record<string, number>
}

export interface PlayerHistory {
  playerId: string
  name: string
  team: string
  position: string
  /** Newest first. */
  games: PlayerGameRecord[]
}

export interface TeamGameRecord {
  season: number
  date: string
  opp: string
  home: boolean
  us: number
  them: number
}

export interface InjuryNote {
  team: string
  player: string
  position: string
  designation: 'out' | 'doubtful' | 'questionable' | 'gtd' | 'probable' | 'ir'
  injury: string
}

export interface DefenseRank {
  rank: number
  of: number
  /** Per-game value the rank is based on (e.g. pass yards allowed). */
  value: number
  label: string
}

/** Everything about the game itself, loaded once and shared by every outcome in it. */
export interface GameContext {
  sport: Sport
  gameId: string
  away: string
  home: string
  startTime: string | null
  neutral: boolean
  odds: GameOdds | null
  /** Finished games, newest first, per team (current season then prior seasons). */
  results: Record<string, TeamGameRecord[]>
  injuries: InjuryNote[]
  /** Defensive ranks by stat category for each team (what that team defense allows). */
  defense: Record<string, Record<string, DefenseRank>>
  /** Days since each team previous game (null = first game or unknown). */
  rest: Record<string, number | null>
  /** Season win% by team abbreviation for opponent-quality weighting. */
  winPct: Record<string, number>
  weather: { tempF: number | null; windMph: number | null; precipitation: boolean; indoor: boolean } | null
  /** Context flags. */
  flags: { divisional: boolean; primetime: boolean; rivalry: string | null }
  /** True when no current-season games exist yet and history is last season. */
  priorSeasonOnly: boolean
  /** Opening line vs now, when the line archive has both. */
  lineMove: { total: { open: number; now: number } | null; spread: { open: number; now: number } | null } | null
}
