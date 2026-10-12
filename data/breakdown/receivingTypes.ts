import type { BetTileData } from './summaryTypes'

export interface RecLast3Game {
  opp: string
  date: string
  tgt: number
  rec: number
  yds: number
  td: number
}

export interface ReceiverDetail {
  name: string
  role: string
  hot: boolean
  tgt: number
  rec: number
  yds: number
  td: number
  ypr: string
  last3: RecLast3Game[]
  bet: {
    recYds: BetTileData
    receptions: BetTileData
    anytimeTd: BetTileData
  }
}

export interface TeamReceiving {
  summary: { targets: number; rec: number; yds: number; drops: number; rank: number }
  players: ReceiverDetail[]
}
