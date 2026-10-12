import type { Sport } from '@/lib/sport/SportContext'

export type GameResult = 'W' | 'L' | 'OTL' | 'T'
export type GameState = 'Final' | 'Live' | 'Upcoming' | 'Postponed'

/** One game on a team's schedule, normalised across sports. */
export interface TeamGame {
  id: string
  /** YYYY-MM-DD (local date of the game). */
  date: string
  startTime: string | null
  oppAbbr: string
  home: boolean
  state: GameState
  us: number | null
  them: number | null
  result: GameResult | null
  tv: string | null
  venue: string | null
  /** Breakdown page for this game. */
  href: string
  /** The team's closing spread (negative = favorite). Real for NFL; null elsewhere (no odds feed). */
  spread: number | null
  /** Game total line. Real for NFL; for other sports a league-average proxy (see `totalIsProxy`). */
  total: number | null
  totalIsProxy: boolean
  divisional: boolean | null
  /** Played in daylight (MLB). */
  day: boolean | null
  primetime: boolean
  /** Handedness of the opposing starter (MLB). */
  oppHand: 'L' | 'R' | null
  /** Overtime / extra innings / shootout. */
  extra: boolean
  /** Rest days since the team's previous game (null for the first). */
  rest: number | null
  /** MLB: runs scored by both sides in innings 1–5 and in the 1st. */
  f5Total: number | null
  firstInningTotal: number | null
  keyStat: string | null
}

export type Tone = 'good' | 'bad' | 'neutral'

export interface SummaryCard {
  label: string
  value: string
  tone: Tone
  sub?: string
}

export interface RosterPlayer {
  name: string
  position: string
  jersey: string | null
  /** Three position-specific stats, e.g. [{label:'AVG', value:'.301'}, …]. */
  stats: { label: string; value: string }[]
  hot: boolean
}

export interface RosterGroup {
  title: string
  players: RosterPlayer[]
}

export interface StatLine {
  label: string
  value: string
  /** 1-based rank among all teams (1 = best), or null when unranked. */
  rank: number | null
  total: number
  leagueAvg: string
  /** Position of the team relative to the league average, 0..1 for the comparison bar. */
  barPct: number
  better: boolean | null
}

export interface StatSection {
  title: string
  stats: StatLine[]
  /** Stats the feeds don't provide, named instead of faked. */
  note?: string
}

export interface LineRecord {
  label: string
  wins: number
  losses: number
  pushes: number
  /** Win / cover / hit percentage, or null with no decisions. */
  pct: number | null
  last10: string
  streak: string | null
  /** Short footnote, e.g. when the line is a league-average proxy. */
  note?: string
}

export interface SituationRecord {
  label: string
  record: string
  pct: number | null
  /** ATS in this spot, when real spreads exist. */
  ats: string | null
}

export interface TrendCard {
  icon: string
  headline: string
  detail: string
  tone: Tone
}

export interface BettingData {
  lines: LineRecord[]
  situational: SituationRecord[]
  trends: TrendCard[]
  /** Things that can't be computed from the feeds we have, shown plainly instead of invented. */
  notes: string[]
}

export interface OverviewRow {
  game: TeamGame
}

export interface TeamPageData {
  sport: Sport
  abbr: string
  name: string
  city: string
  color: string
  record: string
  standing: string
  conferenceDivision: string
  streak: string | null
  /** Most recent 10 results, newest first. */
  form: GameResult[]
  summary: SummaryCard[]
  games: TeamGame[]
  roster: RosterGroup[]
  betting: BettingData
  stats: StatSection[]
  /** Subset of stats for the Overview "vs league average" panel. */
  keyStats: StatLine[]
  /** What the "Key Stat" column of the last-5 table shows. */
  keyStatLabel: string
  /** Average points/runs/goals scored and allowed, for the schedule footer. */
  avgFor: number | null
  avgAgainst: number | null
  /** College: current poll rank (AP, else Coaches / CFP) and how the team has been ranked game by game. */
  rank?: { value: number; poll: string } | null
  rankHistory?: { label: string; rank: number | null }[]
  /** College: honest notes about what the feeds don't carry (e.g. recruiting classes). */
  notes?: string[]
  /** Sections that failed to load, so the UI can say so instead of showing empty tables. */
  unavailable: string[]
}
