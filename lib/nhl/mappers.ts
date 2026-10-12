import { generateNHLEdges } from './edgeEngine'
import type { NHLGame, NHLGoalieSeasonStats, NHLStandingsTeam, NHLTeamStats } from './api'

export interface LiveNhlGame {
  id: string
  startTimeUTC: string
  away: { abbr: string; score: number | null; record: string; gpg: number; goalie?: { name: string; savePct: number } }
  home: { abbr: string; score: number | null; record: string; gpg: number; goalie?: { name: string; savePct: number } }
  status: 'Pregame' | 'Live' | 'Final'
  statusText: string
  network: string | null
  venue: string
  hasEdge: boolean
}

/** Picks each team's likely starter — the goalie with the most games started this season, a
 * disclosed proxy since the NHL API only confirms an actual starter once warmups begin. */
function projectedStarter(abbr: string, goalies: NHLGoalieSeasonStats[]): { name: string; savePct: number } | undefined {
  const teamGoalies = goalies.filter((g) => g.teamAbbr === abbr && g.gamesStarted > 0)
  if (teamGoalies.length === 0) return undefined
  const top = [...teamGoalies].sort((a, b) => b.gamesStarted - a.gamesStarted)[0]
  return { name: top.name, savePct: top.savePct }
}

function winPct(w: number, l: number, otl: number): number | null {
  const gp = w + l + otl
  return gp > 0 ? (w / gp) * 100 : null
}

/** Maps today's games + standings + team stats into game-list cards, including a lightweight edge check per game. */
export function mapNhlGamesForList(
  games: NHLGame[],
  standings: NHLStandingsTeam[] | null,
  teamStats: Map<string, NHLTeamStats>,
  goalieStats: NHLGoalieSeasonStats[] = []
): LiveNhlGame[] {
  const standingsByAbbr = new Map((standings ?? []).map((s) => [s.abbr, s]))

  function recordFor(abbr: string): string {
    const st = standingsByAbbr.get(abbr)
    return st ? `${st.wins}-${st.losses}-${st.otLosses}` : '—'
  }

  function gpgFor(abbr: string): number {
    return teamStats.get(abbr)?.goalsForPerGame ?? 0
  }

  return games.map((g): LiveNhlGame => {
    const awayStats = teamStats.get(g.away.abbr)
    const homeStats = teamStats.get(g.home.abbr)
    const awaySt = standingsByAbbr.get(g.away.abbr)
    const homeSt = standingsByAbbr.get(g.home.abbr)

    let hasEdge = false
    if (awayStats && homeStats) {
      const last10 = (rec: string | undefined) => {
        if (!rec) return { wins: 0, losses: 0 }
        const [w, l] = rec.split('-').map(Number)
        return { wins: w || 0, losses: l || 0 }
      }
      const awayL10 = last10(awaySt?.last10)
      const homeL10 = last10(homeSt?.last10)
      const awayHomeAwayParts = (awaySt?.awayRecord ?? '0-0-0').split('-').map(Number)
      const homeHomeAwayParts = (homeSt?.homeRecord ?? '0-0-0').split('-').map(Number)

      const edges = generateNHLEdges({
        away: {
          abbr: g.away.abbr,
          goalsForPerGame: awayStats.goalsForPerGame,
          shootingPct: awayStats.shotsForPerGame > 0 ? awayStats.goalsForPerGame / awayStats.shotsForPerGame : 0,
          ppPct: awayStats.powerPlayPct,
          pkPct: awayStats.penaltyKillPct,
          homeWinPct: null,
          awayWinPct: winPct(awayHomeAwayParts[0] ?? 0, awayHomeAwayParts[1] ?? 0, awayHomeAwayParts[2] ?? 0),
          last10Wins: awayL10.wins,
          last10Losses: awayL10.losses,
          daysRest: null,
          backToBack: false,
          goalieSavePct: null,
          goalieGaa: null,
        },
        home: {
          abbr: g.home.abbr,
          goalsForPerGame: homeStats.goalsForPerGame,
          shootingPct: homeStats.shotsForPerGame > 0 ? homeStats.goalsForPerGame / homeStats.shotsForPerGame : 0,
          ppPct: homeStats.powerPlayPct,
          pkPct: homeStats.penaltyKillPct,
          homeWinPct: winPct(homeHomeAwayParts[0] ?? 0, homeHomeAwayParts[1] ?? 0, homeHomeAwayParts[2] ?? 0),
          awayWinPct: null,
          last10Wins: homeL10.wins,
          last10Losses: homeL10.losses,
          daysRest: null,
          backToBack: false,
          goalieSavePct: null,
          goalieGaa: null,
        },
      })
      hasEdge = edges.length > 0
    }

    return {
      id: g.gameId,
      startTimeUTC: g.startTimeUTC,
      away: {
        abbr: g.away.abbr,
        score: g.away.score,
        record: recordFor(g.away.abbr),
        gpg: gpgFor(g.away.abbr),
        goalie: projectedStarter(g.away.abbr, goalieStats),
      },
      home: {
        abbr: g.home.abbr,
        score: g.home.score,
        record: recordFor(g.home.abbr),
        gpg: gpgFor(g.home.abbr),
        goalie: projectedStarter(g.home.abbr, goalieStats),
      },
      status: g.status,
      statusText: g.statusText,
      network: g.network,
      venue: g.venue,
      hasEdge,
    }
  })
}

export interface NhlStandingsDivisionData {
  [division: string]: {
    abbr: string
    gp: number
    w: number
    l: number
    otl: number
    pts: number
    ptsPct: string
    gf: number
    ga: number
    diff: string
    home: string
    away: string
    last10: string
    streak: string
    hot?: boolean
  }[]
}

/** Groups NHL standings by division, sorted by points within each. */
export function mapNhlStandingsByDivision(teams: NHLStandingsTeam[]): NhlStandingsDivisionData {
  const byDivision: NhlStandingsDivisionData = {}
  for (const t of teams) {
    byDivision[t.division] ??= []
    byDivision[t.division].push({
      abbr: t.abbr,
      gp: t.gamesPlayed,
      w: t.wins,
      l: t.losses,
      otl: t.otLosses,
      pts: t.points,
      ptsPct: t.pointPct.toFixed(3).replace(/^0/, ''),
      gf: t.goalsFor,
      ga: t.goalsAgainst,
      diff: t.diff > 0 ? `+${t.diff}` : `${t.diff}`,
      home: t.homeRecord,
      away: t.awayRecord,
      last10: t.last10,
      streak: t.streak,
    })
  }
  for (const division of Object.keys(byDivision)) {
    byDivision[division].sort((a, b) => b.pts - a.pts)
    if (byDivision[division][0]) byDivision[division][0].hot = true
  }
  return byDivision
}
