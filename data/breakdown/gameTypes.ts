import type { ContextStat, Edge } from './types'
import type { TeamSummary, TrendItem } from './summaryTypes'
import type { TeamBatting } from './battingTypes'
import type { StarterDetail, TeamBullpen } from './pitchingTypes'
import type { BallparkData } from './ballparkTypes'
import type { QBPassingDetail } from './passingTypes'
import type { TeamRushing } from './rushingTypes'
import type { TeamReceiving } from './receivingTypes'
import type { TeamDefense } from './defenseTypes'
import type { StadiumData } from './stadiumTypes'

export interface MLBPitcher {
  name: string
  hot: boolean
  era: string
  eraGood: boolean
  fip: string
  fipGood: boolean
  k9: string
  k9Good: boolean
  xfip: string
  xfipGood: boolean
  whip: string
  csw: string
  bb9: string
}

export interface NFLQuarterback {
  name: string
  hot: boolean
  rating: string
  ratingGood: boolean
  passYds: string
  passYdsGood: boolean
  compPct: string
  compPctGood: boolean
  td: string
  tdGood: boolean
  int: string
  sacksTaken: string
  rushYds: string
}

export interface MLBGameBreakdown {
  pitcherMatchup: { away: MLBPitcher; home: MLBPitcher }
  contextStats: ContextStat[]
  edges: Edge[]
  trends: TrendItem[]
  summary: { away: TeamSummary; home: TeamSummary }
  batting: { away: TeamBatting; home: TeamBatting }
  starters: { away: StarterDetail; home: StarterDetail }
  bullpen: { away: TeamBullpen; home: TeamBullpen }
  ballpark: BallparkData
}

export interface NFLGameBreakdown {
  qbMatchup: { away: NFLQuarterback; home: NFLQuarterback }
  contextStats: ContextStat[]
  edges: Edge[]
  trends: TrendItem[]
  summary: { away: TeamSummary; home: TeamSummary }
  passing: { away: QBPassingDetail; home: QBPassingDetail }
  rushing: { away: TeamRushing; home: TeamRushing }
  receiving: { away: TeamReceiving; home: TeamReceiving }
  defense: { away: TeamDefense; home: TeamDefense }
  stadium: StadiumData
}
