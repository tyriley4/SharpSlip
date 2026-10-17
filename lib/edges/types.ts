import type { GameOdds } from '@/lib/odds/types'
import type { Sport } from '@/lib/sport/SportContext'
import type { MlbGameInfo } from './data/mlbGame'
import type { LineFacts } from './data/lines'
import type { MlbGameFacts } from './data/mlb'
import type { NbaGameFacts } from './data/nba'
import type { NflGameFacts } from './data/nfl'
import type { NhlGameFacts } from './data/nhl'

export type OutcomeType = 'moneyline' | 'spread' | 'total' | 'player_prop' | 'first_half' | 'first_period'
export type Direction = 'over' | 'under' | 'home' | 'away'
export type EdgeCategory = 'recent_form' | 'hit_rate' | 'matchup' | 'situational' | 'h2h' | 'context' | 'role'

/** The four layers a sharp bettor weighs: opportunity, statistical support, situation, and the market price. */
/** Which time horizon an evidence item comes from; the written explanation uses it to reason about recency. */
export type Horizon = 'career_vs_opp' | 'season_vs_opp' | 'recent_meetings' | 'season' | 'last30' | 'last15' | 'last7' | 'tonight' | 'career'

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
  horizon?: Horizon
  /** Evidence priority tier, 1 (tonight-specific) to 6 (historical); the card lists items in this order. */
  tier?: number
  /** Games behind the item when that is below the standard minimum: shown as an early-season signal. */
  smallSample?: number
  /** The numbers behind the item, so explanations can compare horizons (a rate is 0-1). */
  metrics?: { rate?: number; avg?: number; n?: number }
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
  /** How many facts pointed against the outcome (their wording never reaches the card; only the count). */
  conflicts?: number
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
  /** Career stage, when age and experience could be read. */
  stage?: CareerStage
}

export interface TeamGameRecord {
  /** True for postseason games (they count as current-season results). */
  playoff?: boolean
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

export interface SeasonPhase {
  current: number
  historical: number
  tonight: number
  label: string
}

export interface CareerStage {
  stage: 'ascending' | 'prime' | 'declining'
  age: number | null
  years: number | null
  /** Plain label for the card, e.g. "ascending player - recent trajectory weighted heavily". */
  label: string
}

export interface SeasonContext {
  isPreseason: boolean
  isPlayoffs: boolean
  isRegularSeason: boolean
  /** First four weeks of the regular season. */
  isEarlySeason: boolean
  playoffRound?: string
  seriesGame?: number
  /** How the case should be split between this season, history and tonight at this point in the season. */
  phase?: SeasonPhase
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
  /** Sport-specific facts loaded once per game (starters, lineups, series and bullpens; snaps, target shares, depth charts; goalies). */
  facts: { lines?: LineFacts | null; mlb?: MlbGameFacts | null; nfl?: NflGameFacts | null; nhl?: NhlGameFacts | null; nba?: NbaGameFacts | null }
  /** Season win% for every team in the league (current season), for opponent-quality splits. */
  leagueWinPct: Record<string, number>
  /** College only: each team's conference, for power-conference weighting. */
  conference: Record<string, string>
  /** Opening line vs now, when the line archive has both. */
  lineMove: { total: { open: number; now: number } | null; spread: { open: number; now: number } | null } | null
}
