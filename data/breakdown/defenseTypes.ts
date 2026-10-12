import type { BetTileData } from './summaryTypes'

export interface DefenseUnit {
  label: string
  value: string
  rank: number
  good: boolean
}

export interface DefenseLast3Game {
  opp: string
  date: string
  pts: number
  pass: number
  rush: number
  sacks: number
  to: number
}

export interface KeyDefender {
  name: string
  pos: string
  note: string
}

export interface TeamDefense {
  units: DefenseUnit[]
  last3: DefenseLast3Game[]
  keyMatchup: string
  defenders: KeyDefender[]
  bet: {
    sacks: BetTileData
    ptsAllowed: BetTileData
    turnovers: BetTileData
    ats: BetTileData
  }
}
