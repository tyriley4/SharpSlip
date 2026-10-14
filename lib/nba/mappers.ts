import type { NBAGame, NBAStandingsTeam, NBATeamStats } from './api'

export interface LiveNbaGame {
  id: string
  away: { abbr: string; score: number | null; record: string; ppg: number }
  home: { abbr: string; score: number | null; record: string; ppg: number }
  status: 'Pregame' | 'Live' | 'Final'
  statusText: string
  network: string | null
}

/** Maps today's games + standings + team stats into game-list cards. */
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

    return {
      id: g.gameId,
      away: { abbr: g.away.abbr, score: g.away.score, record: recordFor(g.away.teamId), ppg: ppgFor(g.away.teamId) },
      home: { abbr: g.home.abbr, score: g.home.score, record: recordFor(g.home.teamId), ppg: ppgFor(g.home.teamId) },
      status: g.status,
      statusText: g.statusText,
      network: g.network,
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
