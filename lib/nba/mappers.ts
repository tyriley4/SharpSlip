import { generateNBAEdges } from './edgeEngine'
import type { NBAGame, NBAStandingsTeam, NBATeamStats } from './api'

export interface LiveNbaGame {
  id: string
  away: { abbr: string; score: number | null; record: string; ppg: number }
  home: { abbr: string; score: number | null; record: string; ppg: number }
  status: 'Pregame' | 'Live' | 'Final'
  statusText: string
  network: string | null
  hasEdge: boolean
}

/** Maps today's games + standings + team stats into game-list cards, including a lightweight edge check per game. */
export function mapNbaGamesForList(
  games: NBAGame[],
  standings: NBAStandingsTeam[] | null,
  teamStats: Map<number, NBATeamStats>
): LiveNbaGame[] {
  const standingsByTeam = new Map((standings ?? []).map((s) => [s.teamId, s]))

  function recordFor(teamId: number): string {
    const st = standingsByTeam.get(teamId)
    return st ? `${st.wins}-${st.losses}` : '—'
  }

  function ppgFor(teamId: number): number {
    return teamStats.get(teamId)?.pts ?? 0
  }

  return games.map((g): LiveNbaGame => {
    const awayStats = teamStats.get(g.away.teamId)
    const homeStats = teamStats.get(g.home.teamId)
    const awaySt = standingsByTeam.get(g.away.teamId)
    const homeSt = standingsByTeam.get(g.home.teamId)

    let hasEdge = false
    if (awayStats && homeStats) {
      const winPct = (rec: string | undefined) => {
        if (!rec) return null
        const [w, l] = rec.split('-').map(Number)
        return w + l > 0 ? (w / (w + l)) * 100 : null
      }
      const last10 = (rec: string | undefined) => {
        if (!rec) return { wins: 0, losses: 0 }
        const [w, l] = rec.split('-').map(Number)
        return { wins: w || 0, losses: l || 0 }
      }
      const awayL10 = last10(awaySt?.last10)
      const homeL10 = last10(homeSt?.last10)

      const edges = generateNBAEdges({
        away: {
          abbr: g.away.abbr,
          pts: awayStats.pts,
          oppPts: awayStats.oppPts,
          fg3Pct: awayStats.fg3Pct,
          tov: awayStats.tov,
          oppTov: awayStats.oppTov,
          homeWinPct: null,
          awayWinPct: winPct(awaySt?.away),
          last10Wins: awayL10.wins,
          last10Losses: awayL10.losses,
          daysRest: null,
          backToBack: false,
        },
        home: {
          abbr: g.home.abbr,
          pts: homeStats.pts,
          oppPts: homeStats.oppPts,
          fg3Pct: homeStats.fg3Pct,
          tov: homeStats.tov,
          oppTov: homeStats.oppTov,
          homeWinPct: winPct(homeSt?.home),
          awayWinPct: null,
          last10Wins: homeL10.wins,
          last10Losses: homeL10.losses,
          daysRest: null,
          backToBack: false,
        },
      })
      hasEdge = edges.length > 0
    }

    return {
      id: g.gameId,
      away: { abbr: g.away.abbr, score: g.away.score, record: recordFor(g.away.teamId), ppg: ppgFor(g.away.teamId) },
      home: { abbr: g.home.abbr, score: g.home.score, record: recordFor(g.home.teamId), ppg: ppgFor(g.home.teamId) },
      status: g.status,
      statusText: g.statusText,
      network: g.network,
      hasEdge,
    }
  })
}

export interface NbaStandingsDivisionData {
  [division: string]: {
    abbr: string
    w: number
    l: number
    pct: string
    gb: string
    home: string
    away: string
    last10: string
    streak: string
    hot?: boolean
  }[]
}

/** Groups NBA standings by division, sorted by win% within each. */
export function mapNbaStandingsByDivision(teams: NBAStandingsTeam[]): NbaStandingsDivisionData {
  const byDivision: NbaStandingsDivisionData = {}
  for (const t of teams) {
    byDivision[t.division] ??= []
    byDivision[t.division].push({
      abbr: t.abbr,
      w: t.wins,
      l: t.losses,
      pct: t.winPct.toFixed(3).replace(/^0/, ''),
      gb: t.gamesBack,
      home: t.home,
      away: t.away,
      last10: t.last10,
      streak: t.streak,
    })
  }
  for (const division of Object.keys(byDivision)) {
    byDivision[division].sort((a, b) => parseFloat(b.pct || '0') - parseFloat(a.pct || '0'))
    if (byDivision[division][0]) byDivision[division][0].hot = true
  }
  return byDivision
}
