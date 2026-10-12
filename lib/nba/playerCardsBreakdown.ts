import { getAllNBAPlayerSeasonStats, getNBAPlayerGameLog, getNBATeamStats, type NBAPlayerGameLogRow, type NBAPlayerSeasonStats } from './api'
import { buildNBAGameDots, hitRatesForThresholds, type NBAGameDot, type NBAThresholdHitRate } from './bettingStats'
import { getNBAGameMatchup } from './gameBreakdown'
import { NBA_CURRENT_SEASON } from './divisions'

const POINTS_THRESHOLDS = [9.5, 14.5, 19.5, 24.5, 29.5, 34.5, 39.5]
const REBOUNDS_THRESHOLDS = [3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5]
const ASSISTS_THRESHOLDS = [2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5]
const PRA_THRESHOLDS = [19.5, 24.5, 29.5, 34.5, 39.5, 44.5, 49.5]

async function last5Dots(playerId: number, key: 'pts' | 'reb' | 'ast' | 'pra', threshold: number): Promise<NBAGameDot[]> {
  const log = await getNBAPlayerGameLog(playerId, NBA_CURRENT_SEASON)
  if (!log) return []
  return buildNBAGameDots(log, key, threshold, 5)
}

// ---------------------------------------------------------------------------
// Scoring tab
// ---------------------------------------------------------------------------

export interface NBAScoringPlayerCard {
  playerId: number
  name: string
  ppg: number
  fgPct: number
  fg3Pct: number
  ftPct: number
  min: number
  last5: NBAGameDot[]
  betting: NBAThresholdHitRate[]
}

export interface NBAScoringTabData {
  players: NBAScoringPlayerCard[]
}

export async function getNBAScoringTabData(gameId: string, team: 'away' | 'home'): Promise<NBAScoringTabData | null> {
  const matchup = await getNBAGameMatchup(gameId)
  if (!matchup) return null
  const teamId = team === 'away' ? matchup.away.teamId : matchup.home.teamId

  const all = await getAllNBAPlayerSeasonStats(NBA_CURRENT_SEASON)
  if (!all) return { players: [] }

  const top8 = all
    .filter((p) => p.teamId === teamId && p.gamesPlayed >= 5)
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 8)

  const players = await Promise.all(
    top8.map(async (p): Promise<NBAScoringPlayerCard> => {
      const log = await getNBAPlayerGameLog(p.playerId, NBA_CURRENT_SEASON)
      const defaultThreshold = nearestThreshold(POINTS_THRESHOLDS, p.pts)
      return {
        playerId: p.playerId,
        name: p.name,
        ppg: p.pts,
        fgPct: p.fgPct,
        fg3Pct: p.fg3Pct,
        ftPct: p.ftPct,
        min: p.min,
        last5: log ? buildNBAGameDots(log, 'pts', defaultThreshold, 5) : [],
        betting: log ? hitRatesForThresholds(log, 'pts', POINTS_THRESHOLDS) : [],
      }
    })
  )

  return { players }
}

function nearestThreshold(thresholds: number[], value: number): number {
  return thresholds.reduce((closest, t) => (Math.abs(t - value) < Math.abs(closest - value) ? t : closest), thresholds[0])
}

// ---------------------------------------------------------------------------
// Rebounding tab
// ---------------------------------------------------------------------------

export interface NBARebounder {
  playerId: number
  name: string
  rpg: number
  oreb: number
  dreb: number
  last5: NBAGameDot[]
  betting: NBAThresholdHitRate[]
}

export interface NBAReboundingTabData {
  teamSummary: { oreb: number; dreb: number; reb: number; rank: number } | null
  players: NBARebounder[]
}

export async function getNBAReboundingTabData(gameId: string, team: 'away' | 'home'): Promise<NBAReboundingTabData | null> {
  const matchup = await getNBAGameMatchup(gameId)
  if (!matchup) return null
  const teamId = team === 'away' ? matchup.away.teamId : matchup.home.teamId

  const [all, stats] = await Promise.all([getAllNBAPlayerSeasonStats(NBA_CURRENT_SEASON), getNBATeamStats(teamId)])
  if (!all) return { teamSummary: null, players: [] }

  const topRebounders = all
    .filter((p) => p.teamId === teamId && p.gamesPlayed >= 5)
    .sort((a, b) => b.reb - a.reb)
    .slice(0, 5)

  const players = await Promise.all(
    topRebounders.map(async (p): Promise<NBARebounder> => {
      const log = await getNBAPlayerGameLog(p.playerId, NBA_CURRENT_SEASON)
      const defaultThreshold = nearestThreshold(REBOUNDS_THRESHOLDS, p.reb)
      return {
        playerId: p.playerId,
        name: p.name,
        rpg: p.reb,
        oreb: p.oreb,
        dreb: p.dreb,
        last5: log ? buildNBAGameDots(log, 'reb', defaultThreshold, 5) : [],
        betting: log ? hitRatesForThresholds(log, 'reb', REBOUNDS_THRESHOLDS) : [],
      }
    })
  )

  return {
    teamSummary: stats ? { oreb: 0, dreb: 0, reb: stats.reb, rank: 0 } : null,
    players,
  }
}

// ---------------------------------------------------------------------------
// Assists / Playmaking tab
// ---------------------------------------------------------------------------

export interface NBAPlaymaker {
  playerId: number
  name: string
  apg: number
  tov: number
  astToRatio: number
  min: number
  betting: { assists: NBAThresholdHitRate[]; pra: NBAThresholdHitRate[] }
}

export interface NBAAssistsTabData {
  pace: number | null
  players: NBAPlaymaker[]
}

export async function getNBAAssistsTabData(gameId: string, team: 'away' | 'home'): Promise<NBAAssistsTabData | null> {
  const matchup = await getNBAGameMatchup(gameId)
  if (!matchup) return null
  const teamId = team === 'away' ? matchup.away.teamId : matchup.home.teamId

  const [all, stats] = await Promise.all([getAllNBAPlayerSeasonStats(NBA_CURRENT_SEASON), getNBATeamStats(teamId)])
  if (!all) return { pace: null, players: [] }

  const topPlaymakers = all
    .filter((p) => p.teamId === teamId && p.gamesPlayed >= 5)
    .sort((a, b) => b.ast - a.ast)
    .slice(0, 5)

  const players = await Promise.all(
    topPlaymakers.map(async (p): Promise<NBAPlaymaker> => {
      const log = await getNBAPlayerGameLog(p.playerId, NBA_CURRENT_SEASON)
      const praLog: NBAPlayerGameLogRow[] = log ?? []
      return {
        playerId: p.playerId,
        name: p.name,
        apg: p.ast,
        tov: p.tov,
        astToRatio: p.tov > 0 ? Math.round((p.ast / p.tov) * 100) / 100 : p.ast,
        min: p.min,
        betting: {
          assists: log ? hitRatesForThresholds(log, 'ast', ASSISTS_THRESHOLDS) : [],
          pra: praLog.length > 0 ? hitRatesForThresholds(praLog, 'pra', PRA_THRESHOLDS) : [],
        },
      }
    })
  )

  return { pace: stats?.pace ?? null, players }
}

export { last5Dots }
export type { NBAPlayerSeasonStats }
