import type { Edge } from '@/data/breakdown/types'
import {
  getAllNBAPlayerSeasonStats,
  getNBABoxScore,
  getNBAStandings,
  getNBATeamRestInfo,
  getNBATeamStats,
  getTodaysNBAGames,
  type NBABoxScore,
  type NBAPlayerSeasonStats,
  type NBAStandingsTeam,
  type NBATeamStats,
} from './api'
import { NBA_CURRENT_SEASON, NBA_TEAM_NAMES, nbaAbbrFromTeamId } from './divisions'
import { getAnalysisEdges } from '@/lib/edges/analysisEdges'
// ---------------------------------------------------------------------------
// Matchup
// ---------------------------------------------------------------------------

export type NBAGameStatus = 'Pregame' | 'Live' | 'Final'

export interface NBAGameMatchup {
  gameId: string
  status: NBAGameStatus
  statusText: string
  arena: string
  network: string | null
  gameDate: string
  away: { abbr: string; teamId: number; name: string; score: number | null }
  home: { abbr: string; teamId: number; name: string; score: number | null }
}

export async function getNBAGameMatchup(gameId: string): Promise<NBAGameMatchup | null> {
  const box = await getNBABoxScore(gameId)
  if (box && (box.home.players.length > 0 || box.away.players.length > 0 || box.home.score > 0 || box.away.score > 0)) {
    return {
      gameId,
      status: 'Live',
      statusText: 'In Progress',
      arena: '',
      network: null,
      gameDate: new Date().toISOString(),
      away: { abbr: box.away.abbr, teamId: box.away.teamId, name: NBA_TEAM_NAMES[box.away.abbr] ?? box.away.abbr, score: box.away.score },
      home: { abbr: box.home.abbr, teamId: box.home.teamId, name: NBA_TEAM_NAMES[box.home.abbr] ?? box.home.abbr, score: box.home.score },
    }
  }

  // No box score yet (pregame, or gameId not from today) — look it up in today's schedule shell.
  const today = await getTodaysNBAGames()
  const g = today?.find((game) => game.gameId === gameId)
  if (!g) return null

  return {
    gameId,
    status: g.status,
    statusText: g.statusText,
    arena: g.arena,
    network: g.network,
    gameDate: g.gameDate,
    away: { abbr: g.away.abbr, teamId: g.away.teamId, name: NBA_TEAM_NAMES[g.away.abbr] ?? g.away.abbr, score: g.away.score },
    home: { abbr: g.home.abbr, teamId: g.home.teamId, name: NBA_TEAM_NAMES[g.home.abbr] ?? g.home.abbr, score: g.home.score },
  }
}

// ---------------------------------------------------------------------------
// Starting lineups
// ---------------------------------------------------------------------------

export interface NBAStarter {
  playerId: number
  name: string
  position: string
  ppg: number
  rpg: number
  apg: number
}

export async function getNBAStartingLineup(teamId: number, teamAbbr: string, box: NBABoxScore | null, season: string = NBA_CURRENT_SEASON): Promise<NBAStarter[]> {
  const allStats = await getAllNBAPlayerSeasonStats(season)
  const teamPlayers = (allStats ?? []).filter((p) => p.teamId === teamId)

  const boxTeam = box ? (box.home.teamId === teamId ? box.home : box.away.teamId === teamId ? box.away : null) : null
  const starters = boxTeam?.players.filter((p) => p.starter) ?? []

  if (starters.length >= 5) {
    return starters.slice(0, 5).map((s) => {
      const seasonRow = teamPlayers.find((p) => p.playerId === s.personId)
      return {
        playerId: s.personId,
        name: s.name,
        position: s.position || '—',
        ppg: seasonRow?.pts ?? s.pts,
        rpg: seasonRow?.reb ?? s.reb,
        apg: seasonRow?.ast ?? s.ast,
      }
    })
  }

  // Pregame fallback: no official starters posted yet — use the team's top 5 by minutes played,
  // a reasonable proxy for who's likely to start, clearly not an official announced lineup.
  return [...teamPlayers]
    .filter((p) => p.gamesPlayed >= 5)
    .sort((a, b) => b.min - a.min)
    .slice(0, 5)
    .map((p) => ({ playerId: p.playerId, name: p.name, position: '—', ppg: p.pts, rpg: p.reb, apg: p.ast }))
}

// ---------------------------------------------------------------------------
// Analysis-tab aggregator
// ---------------------------------------------------------------------------

export interface NBAAnalysisData {
  matchup: NBAGameMatchup
  awayLineup: NBAStarter[]
  homeLineup: NBAStarter[]
  edges: Edge[]
  contextStats: { label: string; val: string; good: boolean }[]
}

function findStanding(standings: NBAStandingsTeam[] | null, teamId: number): NBAStandingsTeam | null {
  return standings?.find((s) => s.teamId === teamId) ?? null
}

function winPctFromRecord(rec: string | undefined): number | null {
  if (!rec) return null
  const [w, l] = rec.split('-').map(Number)
  return w + l > 0 ? (w / (w + l)) * 100 : null
}

function last10FromRecord(rec: string | undefined): { wins: number; losses: number } {
  if (!rec) return { wins: 0, losses: 0 }
  const [w, l] = rec.split('-').map(Number)
  return { wins: w || 0, losses: l || 0 }
}

export async function getNBAAnalysisData(gameId: string): Promise<NBAAnalysisData | null> {
  const matchup = await getNBAGameMatchup(gameId)
  if (!matchup) return null

  const [awayStats, homeStats, standings, awayRest, homeRest, box] = await Promise.all([
    getNBATeamStats(matchup.away.teamId),
    getNBATeamStats(matchup.home.teamId),
    getNBAStandings(),
    getNBATeamRestInfo(matchup.away.teamId, matchup.gameDate),
    getNBATeamRestInfo(matchup.home.teamId, matchup.gameDate),
    matchup.status !== 'Pregame' ? getNBABoxScore(gameId) : Promise.resolve(null),
  ])

  const [awayLineup, homeLineup] = await Promise.all([
    getNBAStartingLineup(matchup.away.teamId, matchup.away.abbr, box),
    getNBAStartingLineup(matchup.home.teamId, matchup.home.abbr, box),
  ])

  const awayStanding = findStanding(standings, matchup.away.teamId)
  const homeStanding = findStanding(standings, matchup.home.teamId)

  const edges = await getAnalysisEdges('nba', matchup.gameId, matchup.away.abbr, matchup.home.abbr)

  const contextStats = [
    awayStanding ? { label: `${matchup.away.abbr} Record`, val: `${awayStanding.wins}-${awayStanding.losses}`, good: awayStanding.wins >= awayStanding.losses } : null,
    homeStanding ? { label: `${matchup.home.abbr} Record`, val: `${homeStanding.wins}-${homeStanding.losses}`, good: homeStanding.wins >= homeStanding.losses } : null,
    awayStats ? { label: `${matchup.away.abbr} PPG`, val: awayStats.pts.toFixed(1), good: awayStats.pts >= 115 } : null,
    homeStats ? { label: `${matchup.home.abbr} PPG`, val: homeStats.pts.toFixed(1), good: homeStats.pts >= 115 } : null,
  ].filter((s): s is { label: string; val: string; good: boolean } => s !== null)

  return { matchup, awayLineup, homeLineup, edges, contextStats }
}

export { nbaAbbrFromTeamId }
export type { NBAPlayerSeasonStats }
