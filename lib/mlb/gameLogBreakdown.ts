import { getGameLinescore, getMlbTeamsIndex, getPlayerGameLog, getTeamScheduleResults, type RawGameLogEntry } from './api'
import { getGameMatchup } from './gameBreakdown'

export interface GameLogRow {
  date: string
  opp: string
  result: 'W' | 'L'
  score: string
  sp: string | null
  ip: string | null
  er: number | null
  hr: number | null
  notes: string[]
}

export interface GameLogSummary {
  wins: number
  losses: number
  avgRunsScored: number
  avgRunsAllowed: number
  overWins: number
  overLosses: number
}

export interface TeamGameLogData {
  rows: GameLogRow[]
  summary: GameLogSummary
}

async function buildGameLog(teamId: number, teamAbbrById: Map<number, { abbr: string }> | null): Promise<TeamGameLogData | null> {
  const games = await getTeamScheduleResults(teamId)
  if (!games) return null

  const finalGames = games
    .filter((g) => g.status.abstractGameState === 'Final')
    .sort((a, b) => new Date(b.officialDate).getTime() - new Date(a.officialDate).getTime())
    .slice(0, 10)

  const pitcherLogCache = new Map<number, RawGameLogEntry[] | null>()
  async function getCachedPitcherLog(pitcherId: number): Promise<RawGameLogEntry[] | null> {
    if (!pitcherLogCache.has(pitcherId)) {
      pitcherLogCache.set(pitcherId, await getPlayerGameLog(pitcherId, 'pitching'))
    }
    return pitcherLogCache.get(pitcherId) ?? null
  }

  const rows = await Promise.all(
    finalGames.map(async (g): Promise<GameLogRow> => {
      const isHome = g.teams.home.team.id === teamId
      const mine = isHome ? g.teams.home : g.teams.away
      const opp = isHome ? g.teams.away : g.teams.home
      const runsFor = mine.score ?? 0
      const runsAgainst = opp.score ?? 0

      let ip: string | null = null
      let er: number | null = null
      let hr: number | null = null
      if (mine.probablePitcher) {
        const log = await getCachedPitcherLog(mine.probablePitcher.id)
        const entry = log?.find((l) => l.date === g.officialDate)
        if (entry) {
          ip = String(entry.stat.inningsPitched ?? '0')
          er = Number(entry.stat.earnedRuns ?? 0)
          hr = Number(entry.stat.homeRuns ?? 0)
        }
      }

      const linescore = await getGameLinescore(g.gamePk)
      const totalInnings = linescore?.innings?.length ?? 9
      const notes: string[] = []
      if (runsAgainst === 0) notes.push('SHO')
      if (totalInnings > 9) notes.push('XG')

      return {
        date: g.officialDate,
        opp: teamAbbrById?.get(opp.team.id)?.abbr ?? opp.team.name.slice(0, 3).toUpperCase(),
        result: mine.isWinner ? 'W' : 'L',
        score: `${runsFor}-${runsAgainst}`,
        sp: mine.probablePitcher?.fullName ?? null,
        ip,
        er,
        hr,
        notes,
      }
    })
  )

  const wins = rows.filter((r) => r.result === 'W').length
  const totalScored = finalGames.reduce((s, g) => {
    const isHome = g.teams.home.team.id === teamId
    return s + ((isHome ? g.teams.home.score : g.teams.away.score) ?? 0)
  }, 0)
  const totalAllowed = finalGames.reduce((s, g) => {
    const isHome = g.teams.home.team.id === teamId
    return s + ((isHome ? g.teams.away.score : g.teams.home.score) ?? 0)
  }, 0)
  const leagueAvgTotal = 8.5
  const overWins = rows.filter((r) => {
    const [a, b] = r.score.split('-').map(Number)
    return a + b > leagueAvgTotal
  }).length

  return {
    rows,
    summary: {
      wins,
      losses: rows.length - wins,
      avgRunsScored: rows.length > 0 ? Math.round((totalScored / rows.length) * 100) / 100 : 0,
      avgRunsAllowed: rows.length > 0 ? Math.round((totalAllowed / rows.length) * 100) / 100 : 0,
      overWins,
      overLosses: rows.length - overWins,
    },
  }
}

export interface GameLogTabData {
  away: TeamGameLogData | null
  home: TeamGameLogData | null
}

export async function getGameLogTabData(gamePk: number): Promise<GameLogTabData | null> {
  const matchup = await getGameMatchup(gamePk)
  if (!matchup) return null
  const teams = await getMlbTeamsIndex()

  const [away, home] = await Promise.all([
    buildGameLog(matchup.away.id, teams),
    buildGameLog(matchup.home.id, teams),
  ])

  return { away, home }
}
