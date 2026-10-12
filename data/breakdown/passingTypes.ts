import type { BetTileData } from './summaryTypes'

export interface QBLast3Game {
  opp: string
  date: string
  comp: string
  yds: number
  td: number
  int: number
  rating: string
  result: 'W' | 'L'
}

export interface QBPassingDetail {
  name: string
  hot: boolean
  overview: {
    passYds: string
    td: string
    int: string
    compPct: string
    rating: string
    sacks: string
  }
  advanced: {
    airYards: string
    yac: string
    aDot: string
    pressurePct: string
    cpoe: string
    badThrowPct: string
  }
  last3: QBLast3Game[]
  bet: {
    passYds: BetTileData
    completions: BetTileData
    tdOver: BetTileData
    interceptions: BetTileData
  }
}
