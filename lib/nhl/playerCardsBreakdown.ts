import { getAllNHLSkaterStats, getNHLPlayerGameLog, type NHLPlayerGameLogRow } from './api'
import { buildNHLGameDots, hitRatesForThresholds, type NHLGameDot, type NHLThresholdHitRate } from './bettingStats'
import { getNHLGameMatchup, getNHLStartingGoalie } from './gameBreakdown'
import { NHL_SKATER_BETTING_THRESHOLDS } from './leaderCategories'

const POINTS_THRESHOLDS = NHL_SKATER_BETTING_THRESHOLDS.Points
const GOALS_THRESHOLDS = NHL_SKATER_BETTING_THRESHOLDS.Goals
const ASSISTS_THRESHOLDS = NHL_SKATER_BETTING_THRESHOLDS.Assists
const SAVES_THRESHOLDS = [19.5, 24.5, 29.5, 34.5]

function nearestThreshold(thresholds: number[], value: number): number {
  return thresholds.reduce((closest, t) => (Math.abs(t - value) < Math.abs(closest - value) ? t : closest), thresholds[0])
}

// ---------------------------------------------------------------------------
// Scoring tab
// ---------------------------------------------------------------------------

export interface NHLScoringPlayerCard {
  playerId: number
  name: string
  goals: number
  assists: number
  points: number
  plusMinus: number
  shots: number
  avgToiSeconds: number
  last5: NHLGameDot[]
  betting: { points: NHLThresholdHitRate[]; goals: NHLThresholdHitRate[]; assists: NHLThresholdHitRate[] }
}

export interface NHLScoringTabData {
  players: NHLScoringPlayerCard[]
}

export async function getNHLScoringTabData(gameId: string, team: 'away' | 'home'): Promise<NHLScoringTabData | null> {
  const matchup = await getNHLGameMatchup(gameId)
  if (!matchup) return null
  const abbr = team === 'away' ? matchup.away.abbr : matchup.home.abbr

  const all = await getAllNHLSkaterStats()
  if (!all) return { players: [] }

  const top8 = all
    .filter((p) => p.teamAbbr === abbr && p.gamesPlayed >= 1)
    .sort((a, b) => b.points - a.points)
    .slice(0, 8)

  const players = await Promise.all(
    top8.map(async (p): Promise<NHLScoringPlayerCard> => {
      const log = await getNHLPlayerGameLog(p.playerId)
      const defaultThreshold = nearestThreshold(POINTS_THRESHOLDS, p.points)
      return {
        playerId: p.playerId,
        name: p.name,
        goals: p.goals,
        assists: p.assists,
        points: p.points,
        plusMinus: p.plusMinus,
        shots: p.shots,
        avgToiSeconds: p.avgToiSeconds,
        last5: log ? buildNHLGameDots(log, 'points', defaultThreshold, 5) : [],
        betting: {
          points: log ? hitRatesForThresholds(log, 'points', POINTS_THRESHOLDS) : [],
          goals: log ? hitRatesForThresholds(log, 'goals', GOALS_THRESHOLDS) : [],
          assists: log ? hitRatesForThresholds(log, 'assists', ASSISTS_THRESHOLDS) : [],
        },
      }
    })
  )

  return { players }
}

// ---------------------------------------------------------------------------
// Goalie tab
// ---------------------------------------------------------------------------

export interface NHLGoalieLastStart {
  date: string
  opp: string
  decision: string | null
  shotsAgainst: number
  saves: number
  goalsAgainst: number
  savePct: number
}

export interface NHLGoalieCard {
  playerId: number
  name: string
  wins: number
  losses: number
  otLosses: number
  savePct: number
  gaa: number
  shutouts: number
  min: number
  last5: NHLGoalieLastStart[]
  betting: NHLThresholdHitRate[]
}

export interface NHLGoalieTabData {
  goalie: NHLGoalieCard | null
}

export async function getNHLGoalieTabData(gameId: string, team: 'away' | 'home'): Promise<NHLGoalieTabData | null> {
  const matchup = await getNHLGameMatchup(gameId)
  if (!matchup) return null
  const abbr = team === 'away' ? matchup.away.abbr : matchup.home.abbr

  const starter = await getNHLStartingGoalie(abbr, null)
  if (!starter) return { goalie: null }

  const log = await getNHLPlayerGameLog(starter.playerId)
  const starts = (log ?? []).filter((g) => g.decision !== null).sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
  const last5: NHLGoalieLastStart[] = starts.slice(0, 5).map((g) => ({
    date: g.gameDate,
    opp: g.opponentAbbr,
    decision: g.decision,
    shotsAgainst: g.shotsAgainst,
    saves: g.saves,
    goalsAgainst: g.goalsAgainst,
    savePct: g.savePct,
  }))

  const totalMinutes = starts.reduce((s, g) => {
    const [m, sec] = g.toi.split(':').map(Number)
    return s + (m || 0) + (sec || 0) / 60
  }, 0)

  return {
    goalie: {
      playerId: starter.playerId,
      name: starter.name,
      wins: starter.wins,
      losses: starter.losses,
      otLosses: starter.otLosses,
      savePct: starter.savePct,
      gaa: starter.gaa,
      shutouts: starter.shutouts,
      min: Math.round(totalMinutes),
      last5,
      betting: starts.length > 0 ? hitRatesForThresholds(starts, 'saves', SAVES_THRESHOLDS) : [],
    },
  }
}

export type { NHLPlayerGameLogRow }
