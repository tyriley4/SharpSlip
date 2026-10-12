import { getNHLTeamStats } from './api'
import { getNHLGameMatchup } from './gameBreakdown'

export interface NHLSpecialTeamsData {
  abbr: string
  ppPct: number
  pkPct: number
  faceoffWinPct: number
  goalsForPerGame: number
  goalsAgainstPerGame: number
}

/**
 * Free NHL data only exposes season-level PP%/PK%/faceoff% team aggregates — there's no
 * per-game power-play opportunity count, PP/PK time-on-ice split, or 5v5 Corsi data available
 * without parsing raw play-by-play event streams, which is out of scope here. Those specific
 * sub-stats are disclosed as unavailable rather than approximated.
 */
export async function getNHLSpecialTeamsData(gameId: string, team: 'away' | 'home'): Promise<NHLSpecialTeamsData | null> {
  const matchup = await getNHLGameMatchup(gameId)
  if (!matchup) return null
  const abbr = team === 'away' ? matchup.away.abbr : matchup.home.abbr

  const stats = await getNHLTeamStats(abbr)
  if (!stats) return null

  return {
    abbr,
    ppPct: stats.powerPlayPct,
    pkPct: stats.penaltyKillPct,
    faceoffWinPct: stats.faceoffWinPct,
    goalsForPerGame: stats.goalsForPerGame,
    goalsAgainstPerGame: stats.goalsAgainstPerGame,
  }
}
