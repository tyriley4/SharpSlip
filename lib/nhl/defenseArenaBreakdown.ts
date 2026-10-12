import { getAllNHLSkaterStats, getAllNHLTeamStats, getNHLStandings, getNHLTeamGameLog, getNHLTeamStats, type NHLTeamStats } from './api'
import { NHL_ARENAS } from './divisions'
import { getNHLGameMatchup } from './gameBreakdown'

// ---------------------------------------------------------------------------
// Defense section
// ---------------------------------------------------------------------------

export interface NHLDefenseRank {
  value: number
  rank: number
}

export interface NHLDefenseData {
  stats: NHLTeamStats | null
  gaaRank: NHLDefenseRank | null
  last5: { opp: string; oppGoals: number; date: string }[]
  keyDefenders: { playerId: number; name: string; plusMinus: number }[]
}

export async function getNHLDefenseData(gameId: string, team: 'away' | 'home'): Promise<NHLDefenseData | null> {
  const matchup = await getNHLGameMatchup(gameId)
  if (!matchup) return null
  const abbr = team === 'away' ? matchup.away.abbr : matchup.home.abbr

  const [stats, allTeams, log, allSkaters] = await Promise.all([
    getNHLTeamStats(abbr),
    getAllNHLTeamStats(),
    getNHLTeamGameLog(abbr),
    getAllNHLSkaterStats(),
  ])

  let gaaRank: NHLDefenseRank | null = null
  if (stats && allTeams) {
    // Lower goals-allowed-per-game ranks better (rank 1 = stingiest defense).
    const ranked = [...allTeams].sort((a, b) => a.goalsAgainstPerGame - b.goalsAgainstPerGame)
    const idx = ranked.findIndex((t) => t.abbr === abbr)
    if (idx !== -1) gaaRank = { value: stats.goalsAgainstPerGame, rank: idx + 1 }
  }

  const sortedLog = [...(log ?? [])].sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
  const last5 = sortedLog.slice(0, 5).map((g) => ({ opp: g.opponentAbbr, oppGoals: g.goalsAgainst, date: g.gameDate }))

  const keyDefenders = (allSkaters ?? [])
    .filter((p) => p.teamAbbr === abbr && p.position === 'D' && p.gamesPlayed >= 1)
    .sort((a, b) => b.plusMinus - a.plusMinus)
    .slice(0, 2)
    .map((p) => ({ playerId: p.playerId, name: p.name, plusMinus: p.plusMinus }))

  return { stats, gaaRank, last5, keyDefenders }
}

// ---------------------------------------------------------------------------
// Arena section
// ---------------------------------------------------------------------------

export interface NHLArenaData {
  arena: { name: string; city: string; capacity: number } | null
  homeIceRating: number | null
  homePuckLine: { wins: number; losses: number; pct: number } | null
  overUnderAtArena: { wins: number; losses: number; pct: number } | null
}

const PUCK_LINE_PROXY_MARGIN = 1.5

export async function getNHLArenaData(gameId: string): Promise<NHLArenaData | null> {
  const matchup = await getNHLGameMatchup(gameId)
  if (!matchup) return null

  const [standing, log, awayStats, homeStats] = await Promise.all([
    getNHLStandings().then((s) => s?.find((t) => t.abbr === matchup.home.abbr) ?? null),
    getNHLTeamGameLog(matchup.home.abbr),
    getNHLTeamStats(matchup.away.abbr),
    getNHLTeamStats(matchup.home.abbr),
  ])

  const homeGames = (log ?? []).filter((g) => g.isHome)
  let plW = 0
  let overW = 0
  const leagueAvgTotal = (awayStats?.goalsForPerGame ?? 3) + (homeStats?.goalsForPerGame ?? 3)
  for (const g of homeGames) {
    if (g.goalsFor - g.goalsAgainst >= PUCK_LINE_PROXY_MARGIN) plW++
    if (g.goalsFor + g.goalsAgainst > leagueAvgTotal) overW++
  }

  const homeWinPct = standing
    ? (() => {
        const [w, l, otl] = standing.homeRecord.split('-').map(Number)
        const gp = w + l + (otl || 0)
        return gp > 0 ? Math.round((w / gp) * 1000) / 10 : null
      })()
    : null

  return {
    arena: NHL_ARENAS[matchup.home.abbr] ?? null,
    homeIceRating: homeWinPct,
    homePuckLine: homeGames.length > 0 ? { wins: plW, losses: homeGames.length - plW, pct: Math.round((plW / homeGames.length) * 1000) / 10 } : null,
    overUnderAtArena: homeGames.length > 0 ? { wins: overW, losses: homeGames.length - overW, pct: Math.round((overW / homeGames.length) * 1000) / 10 } : null,
  }
}

export interface NHLDefenseArenaTabData {
  defense: NHLDefenseData | null
  arena: NHLArenaData | null
}

export async function getNHLDefenseArenaTabData(gameId: string, team: 'away' | 'home'): Promise<NHLDefenseArenaTabData> {
  const [defense, arena] = await Promise.all([getNHLDefenseData(gameId, team), getNHLArenaData(gameId)])
  return { defense, arena }
}
