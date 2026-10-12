export interface BatterStats {
  name: string
  pos: string
  bats: 'L' | 'R' | 'S'
  hot: boolean
  cold: boolean
  std: { avg: string; obp: string; slg: string; ops: string; hr: number; rbi: number; pa: number }
  adv: {
    woba: string
    wrc: number
    xba: string
    xslg: string
    hard: number
    barrel: number
    sprintSpeed: string
    kpct: number
    bbpct: number
    chase: number
    whiff: number
  }
  splits: {
    vslAvg: string
    vslOps: string
    vsrAvg: string
    vsrOps: string
    homeOps: string
    awayOps: string
  }
  hotcold: {
    l7avg: string
    l7hr: number
    l7rbi: number
    l14avg: string
    l14hr: number
  }
  note: string
}

export interface BatterPropRow {
  label: 'Hot' | 'Cold' | 'Avg'
  rec: Record<string, string>
  pct: Record<string, number>
  streak: Record<string, string>
  targets: string
}

export const propCats = ['anytimeHit', 'totalBases', 'hr', 'rbi'] as const
export const propLabels: Record<string, string> = {
  anytimeHit: 'Anytime Hit',
  totalBases: 'Total Bases',
  hr: 'HR',
  rbi: 'RBI',
}

export interface TeamBatting {
  lineup: BatterStats[]
  props: BatterPropRow[]
}
