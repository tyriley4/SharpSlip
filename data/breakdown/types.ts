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
}

export interface ContextStat {
  label: string
  val: string
  good: boolean
}
