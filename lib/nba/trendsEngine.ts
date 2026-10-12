import { getNBAGameMatchup, nbaAbbrFromTeamId } from './gameBreakdown'
import { getNBATeamGameLog, getNBATeamStats, type NBATeamGameLogRow } from './api'
import { NBA_CURRENT_SEASON } from './divisions'

export type NBATrendCategory = 'Form' | 'Offensive' | 'Situational' | 'H2H'

export interface NBATrend {
  id: number
  category: NBATrendCategory
  title: string
  stat: string
  note: string
  hot: boolean
}

function formTrends(abbr: string, log: NBATeamGameLogRow[]): NBATrend[] {
  const trends: NBATrend[] = []
  const sorted = [...log].sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
  const last10 = sorted.slice(0, 10)
  const last5 = sorted.slice(0, 5)

  const wins10 = last10.filter((g) => g.wl === 'W').length
  if (last10.length === 10 && wins10 >= 7) {
    trends.push({ id: 0, category: 'Form', title: `${abbr} — Strong Recent Form`, stat: `${wins10}-${10 - wins10} in last 10`, note: 'Playing at a high level heading into this matchup.', hot: wins10 >= 8 })
  }
  if (last10.length === 10 && 10 - wins10 >= 7) {
    trends.push({ id: 0, category: 'Form', title: `${abbr} — Struggling Stretch`, stat: `${wins10}-${10 - wins10} in last 10`, note: 'A trend worth monitoring until they turn it around.', hot: wins10 <= 2 })
  }

  if (last5.length === 5) {
    const avgPts = last5.reduce((s, g) => s + g.pts, 0) / 5
    if (avgPts >= 120) {
      trends.push({ id: 0, category: 'Form', title: `${abbr} — Offensive Hot Streak`, stat: `${avgPts.toFixed(1)} PPG over last 5`, note: 'Offense trending well above season norms.', hot: avgPts >= 128 })
    }
    const avgOppPts = last5.reduce((s, g) => s + g.oppPts, 0) / 5
    if (avgOppPts <= 105) {
      trends.push({ id: 0, category: 'Form', title: `${abbr} — Defensive Excellence`, stat: `${avgOppPts.toFixed(1)} opp PPG over last 5`, note: 'Defense locking teams down — favors unders.', hot: avgOppPts <= 100 })
    }
  }

  return trends
}

function offensiveTrends(abbr: string, fg3Pct: number, pace: number | null): NBATrend[] {
  const trends: NBATrend[] = []
  if (fg3Pct > 0.38) {
    trends.push({ id: 0, category: 'Offensive', title: `${abbr} — Elite Three Point Shooting`, stat: `${(fg3Pct * 100).toFixed(1)}% from three`, note: 'Live three-point shooting favors the over when shots are falling.', hot: fg3Pct > 0.4 })
  }
  if (pace !== null && pace > 100) {
    trends.push({ id: 0, category: 'Offensive', title: `${abbr} — Fast Pace, Favors Over`, stat: `${pace.toFixed(1)} possessions/g`, note: 'More possessions mean more scoring opportunities for both teams.', hot: pace > 103 })
  }
  return trends
}

function situationalTrends(abbr: string, log: NBATeamGameLogRow[]): NBATrend[] {
  const trends: NBATrend[] = []
  const homeGames = log.filter((g) => g.isHome)
  const awayGames = log.filter((g) => !g.isHome)
  if (homeGames.length >= 5 && awayGames.length >= 5) {
    const homeAvg = homeGames.reduce((s, g) => s + g.pts, 0) / homeGames.length
    const awayAvg = awayGames.reduce((s, g) => s + g.pts, 0) / awayGames.length
    if (Math.abs(homeAvg - awayAvg) >= 5) {
      const better = homeAvg > awayAvg ? 'home' : 'road'
      trends.push({
        id: 0,
        category: 'Situational',
        title: `${abbr} — Home/Away Scoring Split`,
        stat: `${homeAvg.toFixed(1)} PPG home vs ${awayAvg.toFixed(1)} PPG away`,
        note: `Scores meaningfully more at ${better}.`,
        hot: Math.abs(homeAvg - awayAvg) >= 8,
      })
    }
  }

  const sorted = [...log].sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime())
  let b2bWins = 0
  let b2bTotal = 0
  for (let i = 1; i < sorted.length; i++) {
    const gap = Math.round((new Date(sorted[i].gameDate).getTime() - new Date(sorted[i - 1].gameDate).getTime()) / (24 * 60 * 60 * 1000))
    if (gap <= 1) {
      b2bTotal++
      if (sorted[i].wl === 'W') b2bWins++
    }
  }
  if (b2bTotal >= 5) {
    trends.push({
      id: 0,
      category: 'Situational',
      title: `${abbr} — Back-to-Back Record`,
      stat: `${b2bWins}-${b2bTotal - b2bWins} on the second night of back-to-backs`,
      note: 'Fatigue factor on short rest.',
      hot: false,
    })
  }

  return trends
}

async function h2hTrends(awayAbbr: string, homeAbbr: string, homeTeamId: number, awayLog: NBATeamGameLogRow[]): Promise<NBATrend[]> {
  const meetings = awayLog.filter((g) => g.opponentAbbr === homeAbbr)
  if (meetings.length === 0) {
    return [{ id: 0, category: 'H2H', title: 'Season Series', stat: 'No completed meetings yet this season', note: 'First meeting of the season so far.', hot: false }]
  }

  let homeWins = 0
  let totalCombined = 0
  for (const g of meetings) {
    totalCombined += g.pts + g.oppPts
    // These rows come from the away team's own game log — a loss for them means the home team won that meeting.
    if (g.wl === 'L') homeWins++
  }
  const last5 = meetings.slice(0, 5)
  const avgCombined = last5.length > 0 ? last5.reduce((s, g) => s + g.pts + g.oppPts, 0) / last5.length : totalCombined / meetings.length

  return [
    {
      id: 0,
      category: 'H2H',
      title: 'Season Series',
      stat: `${homeAbbr} ${homeWins}-${meetings.length - homeWins} ${awayAbbr} this season`,
      note: `${meetings.length} meeting${meetings.length !== 1 ? 's' : ''} so far, avg ${avgCombined.toFixed(1)} combined points.`,
      hot: false,
    },
  ]
}

export async function getNBATrendsData(gameId: string): Promise<NBATrend[] | null> {
  const matchup = await getNBAGameMatchup(gameId)
  if (!matchup) return null

  const [awayLog, homeLog, awayStats, homeStats] = await Promise.all([
    getNBATeamGameLog(matchup.away.teamId, NBA_CURRENT_SEASON),
    getNBATeamGameLog(matchup.home.teamId, NBA_CURRENT_SEASON),
    getNBATeamStats(matchup.away.teamId),
    getNBATeamStats(matchup.home.teamId),
  ])

  const h2h = await h2hTrends(matchup.away.abbr, matchup.home.abbr, matchup.home.teamId, awayLog ?? [])

  const trends: NBATrend[] = [
    ...formTrends(matchup.away.abbr, awayLog ?? []),
    ...formTrends(matchup.home.abbr, homeLog ?? []),
    ...(awayStats ? offensiveTrends(matchup.away.abbr, awayStats.fg3Pct, awayStats.pace) : []),
    ...(homeStats ? offensiveTrends(matchup.home.abbr, homeStats.fg3Pct, homeStats.pace) : []),
    ...situationalTrends(matchup.away.abbr, awayLog ?? []),
    ...situationalTrends(matchup.home.abbr, homeLog ?? []),
    ...h2h,
  ]

  return trends.map((t, i) => ({ ...t, id: i + 1 }))
}

export { nbaAbbrFromTeamId }
