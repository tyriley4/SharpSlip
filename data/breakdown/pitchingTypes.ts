export interface StarterDetail {
  name: string
  hot: boolean
  avgIP: string
  qsPct: string
  era: string
  fip: string
  xfip: string
  siera: string
  k9: string
  bb9: string
  whip: string
  csw: string
  kbb: string
  arsenal: Record<string, string>
  contact: { hardHit: string; barrel: string; exitVelo: string; gb: string; strand: string }
  splits: { vsLHH: { era: string; avg: string }; vsRHH: { era: string; avg: string }; homeEra: string; awayEra: string }
  last3: { opp: string; date: string; ip: string; er: number; k: number; bb: number; result: 'W' | 'L' }[]
  vsLineup: { name: string; pos: string; avg: string; ab: number; h: number; hr: number; k: number }[]
  bet: {
    kOver: { rec: string; pct: number; line: string }
    kUnder: { rec: string; pct: number; line: string }
    win: { rec: string; pct: number; line: string }
    nrfi: { rec: string; pct: number; line: string }
    outs: { rec: string; pct: number; line: string }
  }
}

export interface Reliever {
  name: string
  role: string
  hand: 'RHP' | 'LHP'
  status: 'rested' | 'used' | 'taxed'
  lastUsed: string
  rest: string
  era: string
  whip: string
  k9: string
  bb9: string
  hold: string
  last5: ('W' | 'L')[]
  trend: 'up' | 'down' | 'neutral'
}

export interface TeamBullpen {
  health: number
  status: string
  teamStats: {
    era: string
    eraRank: number
    whip: string
    whipRank: number
    k9: string
    k9Rank: number
    sv: string
    hold: string
    blowSv: string
    oppAvg: string
  }
  last5: ('W' | 'L')[]
  pitchers: Reliever[]
}
