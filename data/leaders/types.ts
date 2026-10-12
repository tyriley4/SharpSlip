export interface LeaderRow {
  rank: number
  name: string
  team: string
  hot?: boolean
  value: string
  record: string
  hitPct: number
}

export type LeaderSub = string

export interface LeaderGroup {
  subs: LeaderSub[]
  cats: Record<LeaderSub, string[]>
  /** sub -> category label -> ranked rows for that category */
  rows: Record<LeaderSub, Record<string, LeaderRow[]>>
}
