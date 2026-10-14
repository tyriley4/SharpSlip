export interface Edge {
  id: number
  icon: string
  bet: string
  team?: string
  type: string
  typeLabel: string
  grade: string
  conf: number
  supporting: number
  line: string
  altPlay: string
  analysis: string
  bullets: string[]
  /** Real price / parlay line for this edge when it comes from a posted market. */
  market?: EdgeMarket
}

export interface ContextStat {
  label: string
  val: string
  good: boolean
}

/** Extra detail the edge engine attaches so cards can add a real-priced leg to the parlay. */
export interface EdgeMarket {
  oddsAmerican?: number
  book?: string
  prob?: number
  lineId?: string
  matchup?: string
}
