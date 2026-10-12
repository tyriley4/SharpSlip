export interface TrendItem {
  title: string
  body: string
  cat: string
  hot: boolean
  team?: string
}

export interface BetTileData {
  rec: string
  pct: number
  label: string
}

export interface BetSection {
  title: string
  tiles: BetTileData[]
}

export interface StatTile {
  label: string
  value: string
}

export interface LogColumn {
  key: string
  label: string
}

export type LogTone = 'positive' | 'negative' | 'warning' | 'accent' | 'neutral'

export interface LogCell {
  value: string
  tone?: LogTone
}

export interface LogRow {
  cells: LogCell[]
}

export interface TeamSummary {
  abbr: string
  side: 'Road' | 'Home'
  record: string
  winPct: number
  form: ('W' | 'L' | 'P')[]
  offense: StatTile[]
  defense: StatTile[]
  betSections: BetSection[]
  logColumns: LogColumn[]
  log: LogRow[]
}
