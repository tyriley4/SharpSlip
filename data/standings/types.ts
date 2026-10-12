export interface StandingsTeam {
  abbr: string
  w: number
  l: number
  pct: string
  gb: string
  hot?: boolean
}

export type StandingsData = Record<string, StandingsTeam[]>
