import { getAllNBAPlayerSeasonStats, getAllNBATeamStats, getNBAStandings, getNBATeamGameLog, getNBATeamStats, type NBATeamStats } from './api'
import { NBA_ARENAS, NBA_CURRENT_SEASON } from './divisions'
import { getNBAGameMatchup } from './gameBreakdown'

// ---------------------------------------------------------------------------
// Defense section
// ---------------------------------------------------------------------------

export interface NBADefenseRank {
  value: number
  rank: number
}

export interface NBADefenseData {
  stats: NBATeamStats | null
  defRtgRank: NBADefenseRank | null
  last5: { opp: string; oppPts: number; date: string }[]
  keyDefenders: { playerId: number; name: string; stl: number; blk: number }[]
}

export async function getNBADefenseData(gameId: string, team: 'away' | 'home'): Promise<NBADefenseData | null> {
  const matchup = await getNBAGameMatchup(gameId)
  if (!matchup) return null
  const teamId = team === 'away' ? matchup.away.teamId : matchup.home.teamId

  const [stats, allTeams, log, allPlayers] = await Promise.all([
    getNBATeamStats(teamId),
    getAllNBATeamStats(NBA_CURRENT_SEASON),
    getNBATeamGameLog(teamId, NBA_CURRENT_SEASON),
    getAllNBAPlayerSeasonStats(NBA_CURRENT_SEASON),
  ])

  let defRtgRank: NBADefenseRank | null = null
  if (stats?.defRtg !== null && stats?.defRtg !== undefined && allTeams) {
    const ranked = [...allTeams].filter((t) => t.defRtg !== null).sort((a, b) => (a.defRtg ?? 999) - (b.defRtg ?? 999))
    const idx = ranked.findIndex((t) => t.teamId === teamId)
    if (idx !== -1) defRtgRank = { value: stats.defRtg, rank: idx + 1 }
  }

  const sortedLog = [...(log ?? [])].sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
  const last5 = sortedLog.slice(0, 5).map((g) => ({ opp: g.opponentAbbr, oppPts: g.oppPts, date: g.gameDate }))

  const keyDefenders = (allPlayers ?? [])
    .filter((p) => p.teamId === teamId && p.gamesPlayed >= 5)
    .sort((a, b) => b.stl + b.blk - (a.stl + a.blk))
    .slice(0, 3)
    .map((p) => ({ playerId: p.playerId, name: p.name, stl: p.stl, blk: p.blk }))

  return { stats, defRtgRank, last5, keyDefenders }
}

// ---------------------------------------------------------------------------
// Stadium section
// ---------------------------------------------------------------------------

export interface NBAStadiumData {
  arena: { name: string; city: string; capacity: number } | null
  homeCourtRating: number | null
  homeAts: { wins: number; losses: number; pct: number } | null
  overUnderAtArena: { wins: number; losses: number; pct: number } | null
}

const ATS_PROXY_MARGIN = 5.5

export async function getNBAStadiumData(gameId: string): Promise<NBAStadiumData | null> {
  const matchup = await getNBAGameMatchup(gameId)
  if (!matchup) return null

  const [standing, log, awayStats, homeStats] = await Promise.all([
    getNBAStandings().then((s) => s?.find((t) => t.teamId === matchup.home.teamId) ?? null),
    getNBATeamGameLog(matchup.home.teamId, NBA_CURRENT_SEASON),
    getNBATeamStats(matchup.away.teamId),
    getNBATeamStats(matchup.home.teamId),
  ])

  const homeGames = (log ?? []).filter((g) => g.isHome)
  let atsW = 0
  let overW = 0
  const leagueAvgTotal = (awayStats?.pts ?? 112) + (homeStats?.pts ?? 112)
  for (const g of homeGames) {
    if (g.pts - g.oppPts >= ATS_PROXY_MARGIN) atsW++
    if (g.pts + g.oppPts > leagueAvgTotal) overW++
  }

  const homeWinPct = standing ? (() => {
    const [w, l] = standing.home.split('-').map(Number)
    return w + l > 0 ? Math.round((w / (w + l)) * 1000) / 10 : null
  })() : null

  return {
    arena: NBA_ARENAS[matchup.home.abbr] ?? null,
    homeCourtRating: homeWinPct,
    homeAts: homeGames.length > 0 ? { wins: atsW, losses: homeGames.length - atsW, pct: Math.round((atsW / homeGames.length) * 1000) / 10 } : null,
    overUnderAtArena: homeGames.length > 0 ? { wins: overW, losses: homeGames.length - overW, pct: Math.round((overW / homeGames.length) * 1000) / 10 } : null,
  }
}

export interface NBADefenseStadiumTabData {
  defense: NBADefenseData | null
  stadium: NBAStadiumData | null
}

export async function getNBADefenseStadiumTabData(gameId: string, team: 'away' | 'home'): Promise<NBADefenseStadiumTabData> {
  const [defense, stadium] = await Promise.all([getNBADefenseData(gameId, team), getNBAStadiumData(gameId)])
  return { defense, stadium }
}
