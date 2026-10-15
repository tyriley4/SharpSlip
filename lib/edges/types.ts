import type { GameOdds } from '@/lib/odds/types'
import type { Sport } from '@/lib/sport/SportContext'
import type { MlbGameInfo } from './data/mlbGame'

export type OutcomeType = 'moneyline' | 'spread' | 'total' | 'player_prop' | 'first_half' | 'first_period'
export type Direction = 'over' | 'under' | 'home' | 'away'
export type EdgeCategory = 'recent_form' | 'hit_rate' | 'matchup' | 'situational' | 'h2h' | 'context' | 'role'

/** The four layers a sharp bettor weighs: opportunity, statistical support, situation, and the market price. */
export type EvidenceLayer = 'opportunity' | 'statistical' | 'situational' | 'market'

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
  layer?: EvidenceLayer
  /** Days since the newest game behind this evidence (null/undefined = season-long or career pattern). */
  ageDays?: number
  /** Whole seasons ago the evidence is from (0 = this season); drives the recency weight. */
  seasonsAgo?: number
  /** Quality sub-scores, each 0-3; set by the module or derived from the other fields. */
  quality?: { specificity: number; causality: number; recency: number; sample: number }
}

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

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
  /** One plain sentence under the grade (no-edge, no live odds, role caps). */
  gradeNote?: string
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
  team?: string
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

/** A teammate who is out or doubtful, with how much he normally plays or touches the ball (null when unmeasured). */
export interface TeammateOut {
  team: string
  player: string
  position: string
  designation: InjuryNote['designation']
  usage: { label: string; value: number } | null
}

export interface SeasonContext {
  isPreseason: boolean
  isPlayoffs: boolean
  isRegularSeason: boolean
  /** First four weeks of the regular season. */
  isEarlySeason: boolean
  playoffRound?: string
  seriesGame?: number
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
  weather: { tempF: number | null; windMph: number | null; windDirection?: string | null; precipitation: boolean; indoor: boolean } | null
  /** Context flags. */
  flags: { divisional: boolean; primetime: boolean; rivalry: string | null }
  /** True when no current-season games exist yet and history is last season. */
  priorSeasonOnly: boolean
  /** Regular season / preseason / playoffs, early-season flag and series info. */
  season: SeasonContext
  /** Injured teammates whose absence is material (current-season usage above a floor). */
  teammatesOut: TeammateOut[]
  /** MLB: lineups, probable starters, roof and game-time weather from the league feed. */
  mlb: MlbGameInfo | null
  /** Season win% for every team in the league (current season), for opponent-quality splits. */
  leagueWinPct: Record<string, number>
  /** College only: each team's conference, for power-conference weighting. */
  conference: Record<string, string>
  /** Opening line vs now, when the line archive has both. */
  lineMove: { total: { open: number; now: number } | null; spread: { open: number; now: number } | null } | null
}
