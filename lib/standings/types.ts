import type { Sport } from '@/lib/sport/SportContext'

export interface StandingsExtra {
  key: string
  label: string
  value: string
}

/** One team, normalised across all four sports. */
export interface StandingsRow {
  abbr: string
  name: string
  city: string
  conference: string
  division: string
  /** 1-based rank within the division. */
  divRank: number
  gp: number
  w: number
  l: number
  /** Ties (NFL) or overtime losses (NHL). */
  t: number
  /** NHL points; null elsewhere. */
  pts: number | null
  pct: string
  pctNum: number
  /** Games behind the division leader ("—" for the leader); empty for points-based sports. */
  gb: string
  home: string
  away: string
  last10: string
  /** W-L over the last five games, when the source's results allow it (NFL). */
  last5?: string
  /** Against the spread over the last five games with a closing line (NFL). */
  atsLast5?: string | null
  /** Normalised streak, e.g. "W3", "L4", "OTL1" — "" when unknown. */
  streak: string
  /** Extra stat columns shown on tablet/desktop (e.g. run differential). */
  extras: StandingsExtra[]
  /** Secondary stats shown on the sub-line under the row on wide screens (e.g. DIV, CONF, ERA). */
  subline: StandingsExtra[]
  ats: string | null
  ou: string | null
}

export type PlayoffFormat =
  | { kind: 'divWc'; wildCards: number }
  | { kind: 'nhl'; wildCards: number }
  | { kind: 'seeds'; direct: number; playIn: number }

export interface SportStandings {
  sport: Sport
  conferences: { id: string; label: string; divisions: string[] }[]
  rows: StandingsRow[]
  /** Regular-season length in games. */
  totalGames: number
  /** Score per win: 1 for win-based sports, 2 for NHL points. */
  unit: 1 | 2
  /** Label for the third record column, or null when the sport has none. */
  tColumn: 'T' | 'OTL' | null
  playoff: PlayoffFormat
}
