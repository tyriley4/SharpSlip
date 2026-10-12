import type { BetTileData } from './summaryTypes'

export interface RushLast3Game {
  opp: string
  date: string
  att: number
  yds: number
  ypc: string
  td: number
}

export interface RusherDetail {
  name: string
  role: string
  hot: boolean
  att: number
  yds: number
  ypc: string
  td: number
  long: number
  last3: RushLast3Game[]
  bet: {
    rushYds: BetTileData
    anytimeTd: BetTileData
  }
}

export interface TeamRushing {
  summary: { att: number; yds: number; ypc: string; td: number; rank: number }
  players: RusherDetail[]
}
