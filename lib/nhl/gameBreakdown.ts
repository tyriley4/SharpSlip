import type { Edge } from '@/data/breakdown/types'
import {
  getAllNHLGoalieStats,
  getAllNHLSkaterStats,
  getNHLBoxScore,
  getNHLPlayerGameLog,
  getNHLScheduleForDate,
  getNHLStandings,
  getNHLTeamRestInfo,
  getNHLTeamStats,
  getTodaysNHLGames,
  type NHLBoxScore,
  type NHLStandingsTeam,
  type NHLTeamStats,
} from './api'
import { NHL_TEAM_NAMES, nhlAbbrFromTeamId } from './divisions'
import { getAnalysisEdges } from '@/lib/edges/analysisEdges'
// ---------------------------------------------------------------------------
// Matchup
// ---------------------------------------------------------------------------

export type NHLGameStatus = 'Pregame' | 'Live' | 'Final'

export interface NHLGameMatchup {
  gameId: string
  status: NHLGameStatus
  statusText: string
  venue: string
  network: string | null
  gameDate: string
  startTimeUTC: string
  away: { abbr: string; teamId: number; name: string; score: number | null }
  home: { abbr: string; teamId: number; name: string; score: number | null }
}

/** Resolves a gameId across the last few days' schedules (NHL game IDs don't encode the date). */
async function findScheduledGame(gameId: string) {
  const today = new Date()
  for (let offset = 0; offset <= 2; offset++) {
    const d = new Date(today)
    d.setDate(d.getDate() - offset)
    const dateStr = d.toISOString().slice(0, 10)
    const games = offset === 0 ? await getTodaysNHLGames() : await getNHLScheduleForDate(dateStr)
    const match = games?.find((g) => g.gameId === gameId)
    if (match) return match
  }
  return null
}

export async function getNHLGameMatchup(gameId: string): Promise<NHLGameMatchup | null> {
  const box = await getNHLBoxScore(gameId)
  if (box && (box.away.forwards.length > 0 || box.home.forwards.length > 0 || box.away.score > 0 || box.home.score > 0)) {
    const status: NHLGameStatus = box.gameState === 'LIVE' || box.gameState === 'CRIT' ? 'Live' : 'Final'
    return {
      gameId,
      status,
      statusText: status === 'Live' ? 'In Progress' : 'Final',
      venue: '',
      network: null,
      gameDate: new Date().toISOString(),
      startTimeUTC: new Date().toISOString(),
      away: { abbr: box.away.abbr, teamId: box.away.teamId, name: NHL_TEAM_NAMES[box.away.abbr] ?? box.away.abbr, score: box.away.score },
      home: { abbr: box.home.abbr, teamId: box.home.teamId, name: NHL_TEAM_NAMES[box.home.abbr] ?? box.home.abbr, score: box.home.score },
    }
  }

  const g = await findScheduledGame(gameId)
  if (!g) return null

  return {
    gameId,
    status: g.status,
    statusText: g.statusText,
    venue: g.venue,
    network: g.network,
    gameDate: g.gameDate,
    startTimeUTC: g.startTimeUTC,
    away: { abbr: g.away.abbr, teamId: g.away.teamId, name: NHL_TEAM_NAMES[g.away.abbr] ?? g.away.abbr, score: g.away.score },
    home: { abbr: g.home.abbr, teamId: g.home.teamId, name: NHL_TEAM_NAMES[g.home.abbr] ?? g.home.abbr, score: g.home.score },
  }
}

// ---------------------------------------------------------------------------
// Starting goalie
// ---------------------------------------------------------------------------

export interface NHLStarterGoalie {
  playerId: number
  name: string
  savePct: number
  gaa: number
  wins: number
  losses: number
  otLosses: number
  shutouts: number
  last3: { opp: string; decision: string | null; saves: number; shotsAgainst: number }[]
}

export async function getNHLStartingGoalie(teamAbbr: string, box: NHLBoxScore | null): Promise<NHLStarterGoalie | null> {
  const allGoalies = await getAllNHLGoalieStats()
  const teamGoalies = (allGoalies ?? []).filter((g) => g.teamAbbr === teamAbbr)

  const boxTeam = box ? (box.home.abbr === teamAbbr ? box.home : box.away.abbr === teamAbbr ? box.away : null) : null
  const boxStarter = boxTeam?.goalies.find((g) => g.starter)

  let playerId: number | null = boxStarter?.playerId ?? null
  if (!playerId) {
    // Pregame proxy: the goalie with the most starts this season is the likely starter.
    const top = [...teamGoalies].sort((a, b) => b.gamesStarted - a.gamesStarted)[0]
    playerId = top?.playerId ?? null
  }
  if (!playerId) return null

  const seasonRow = teamGoalies.find((g) => g.playerId === playerId)
  if (!seasonRow) return null

  const log = await getNHLPlayerGameLog(playerId)
  const last3 = (log ?? [])
    .filter((g) => g.decision !== null)
    .sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
    .slice(0, 3)
    .map((g) => ({ opp: g.opponentAbbr, decision: g.decision, saves: g.saves, shotsAgainst: g.shotsAgainst }))

  return {
    playerId,
    name: seasonRow.name,
    savePct: seasonRow.savePct,
    gaa: seasonRow.goalsAgainstAvg,
    wins: seasonRow.wins,
    losses: seasonRow.losses,
    otLosses: seasonRow.otLosses,
    shutouts: seasonRow.shutouts,
    last3,
  }
}

// ---------------------------------------------------------------------------
// Top skaters (starting-lineup proxy)
// ---------------------------------------------------------------------------

export interface NHLTopSkater {
  playerId: number
  name: string
  position: string
  goals: number
  assists: number
  points: number
}

export async function getNHLTopSkaters(teamAbbr: string, count = 5): Promise<NHLTopSkater[]> {
  const all = await getAllNHLSkaterStats()
  const teamPlayers = (all ?? []).filter((p) => p.teamAbbr === teamAbbr)
  return [...teamPlayers]
    .sort((a, b) => b.points - a.points)
    .slice(0, count)
    .map((p) => ({ playerId: p.playerId, name: p.name, position: p.position, goals: p.goals, assists: p.assists, points: p.points }))
}

// ---------------------------------------------------------------------------
// Analysis-tab aggregator
// ---------------------------------------------------------------------------

export interface NHLAnalysisData {
  matchup: NHLGameMatchup
  awayGoalie: NHLStarterGoalie | null
  homeGoalie: NHLStarterGoalie | null
  awayTopSkaters: NHLTopSkater[]
  homeTopSkaters: NHLTopSkater[]
  edges: Edge[]
  contextStats: { label: string; val: string; good: boolean }[]
}

function findStanding(standings: NHLStandingsTeam[] | null, abbr: string): NHLStandingsTeam | null {
  return standings?.find((s) => s.abbr === abbr) ?? null
}

function winPctFromParts(rec: string | undefined): number | null {
  if (!rec) return null
  const [w, l, otl] = rec.split('-').map(Number)
  const gp = w + l + (otl || 0)
  return gp > 0 ? (w / gp) * 100 : null
}

function last10FromRecord(rec: string | undefined): { wins: number; losses: number } {
  if (!rec) return { wins: 0, losses: 0 }
  const [w, l] = rec.split('-').map(Number)
  return { wins: w || 0, losses: l || 0 }
}

export async function getNHLAnalysisData(gameId: string): Promise<NHLAnalysisData | null> {
  const matchup = await getNHLGameMatchup(gameId)
  if (!matchup) return null

  const [awayStats, homeStats, standings, awayRest, homeRest, box] = await Promise.all([
    getNHLTeamStats(matchup.away.abbr),
    getNHLTeamStats(matchup.home.abbr),
    getNHLStandings(),
    getNHLTeamRestInfo(matchup.away.abbr, matchup.gameDate),
    getNHLTeamRestInfo(matchup.home.abbr, matchup.gameDate),
    matchup.status !== 'Pregame' ? getNHLBoxScore(gameId) : Promise.resolve(null),
  ])

  const [awayGoalie, homeGoalie, awayTopSkaters, homeTopSkaters] = await Promise.all([
    getNHLStartingGoalie(matchup.away.abbr, box),
    getNHLStartingGoalie(matchup.home.abbr, box),
    getNHLTopSkaters(matchup.away.abbr),
    getNHLTopSkaters(matchup.home.abbr),
  ])

  const awayStanding = findStanding(standings, matchup.away.abbr)
  const homeStanding = findStanding(standings, matchup.home.abbr)

  const edges = await getAnalysisEdges('nhl', matchup.gameId, matchup.away.abbr, matchup.home.abbr)

  const contextStats = [
    awayStanding ? { label: `${matchup.away.abbr} Record`, val: `${awayStanding.wins}-${awayStanding.losses}-${awayStanding.otLosses}`, good: awayStanding.points >= 0 } : null,
    homeStanding ? { label: `${matchup.home.abbr} Record`, val: `${homeStanding.wins}-${homeStanding.losses}-${homeStanding.otLosses}`, good: homeStanding.points >= 0 } : null,
    awayStats ? { label: `${matchup.away.abbr} GPG`, val: awayStats.goalsForPerGame.toFixed(1), good: awayStats.goalsForPerGame >= 3.2 } : null,
    homeStats ? { label: `${matchup.home.abbr} GPG`, val: homeStats.goalsForPerGame.toFixed(1), good: homeStats.goalsForPerGame >= 3.2 } : null,
  ].filter((s): s is { label: string; val: string; good: boolean } => s !== null)

  return { matchup, awayGoalie, homeGoalie, awayTopSkaters, homeTopSkaters, edges, contextStats }
}

export { nhlAbbrFromTeamId }
