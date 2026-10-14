import { getNHLTeamGameLog, getNHLTeamStats, type NHLTeamGameLogRow } from './api'
import { NHL_TEAM_DIVISIONS } from './divisions'
import { getNHLGameMatchup, getNHLStartingGoalie, nhlAbbrFromTeamId } from './gameBreakdown'

export type NHLTrendCategory = 'Form' | 'Goalie' | 'Special Teams' | 'Situational' | 'H2H'

export interface NHLTrend {
  id: number
  category: NHLTrendCategory
  title: string
  stat: string
  note: string
  hot: boolean
}

function formTrends(abbr: string, log: NHLTeamGameLogRow[]): NHLTrend[] {
  const trends: NHLTrend[] = []
  const sorted = [...log].sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
  const last10 = sorted.slice(0, 10)
  const last5 = sorted.slice(0, 5)

  const wins10 = last10.filter((g) => g.result === 'W').length
  if (last10.length === 10 && wins10 >= 7) {
    trends.push({ id: 0, category: 'Form', title: `${abbr} — Strong Recent Form`, stat: `${wins10}-${10 - wins10} in last 10`, note: 'Playing at a high level heading into this matchup.', hot: wins10 >= 8 })
  }
  if (last10.length === 10 && 10 - wins10 >= 7) {
    trends.push({ id: 0, category: 'Form', title: `${abbr} — Struggling Stretch`, stat: `${wins10}-${10 - wins10} in last 10`, note: 'A trend worth monitoring until they turn it around.', hot: wins10 <= 2 })
  }

  if (last5.length === 5) {
    const avgGf = last5.reduce((s, g) => s + g.goalsFor, 0) / 5
    if (avgGf >= 3.5) {
      trends.push({ id: 0, category: 'Form', title: `${abbr} — Offensive Hot Streak`, stat: `${avgGf.toFixed(1)} GPG over last 5`, note: 'Offense trending well above season norms.', hot: avgGf >= 4.2 })
    }
    const avgGa = last5.reduce((s, g) => s + g.goalsAgainst, 0) / 5
    if (avgGa <= 2) {
      trends.push({ id: 0, category: 'Form', title: `${abbr} — Defensive Shutdown`, stat: `${avgGa.toFixed(1)} goals allowed over last 5`, note: 'Locking teams down defensively — favors unders.', hot: avgGa <= 1.5 })
    }
  }

  return trends
}

function specialTeamsTrends(abbr: string, ppPct: number, pkPct: number): NHLTrend[] {
  const trends: NHLTrend[] = []
  if (ppPct > 0.25) {
    trends.push({ id: 0, category: 'Special Teams', title: `${abbr} — Elite Power Play`, stat: `${(ppPct * 100).toFixed(1)}% PP`, note: 'One of the league\'s most dangerous power plays.', hot: ppPct > 0.28 })
  }
  if (pkPct > 0.85) {
    trends.push({ id: 0, category: 'Special Teams', title: `${abbr} — Elite Penalty Kill`, stat: `${(pkPct * 100).toFixed(1)}% PK`, note: 'Shorthanded situations rarely hurt this team.', hot: pkPct > 0.88 })
  }
  return trends
}

async function goalieTrends(abbr: string): Promise<NHLTrend[]> {
  const trends: NHLTrend[] = []
  const goalie = await getNHLStartingGoalie(abbr, null)
  if (!goalie || goalie.last3.length === 0) return trends

  const last5 = goalie.last3
  const totalSaves = last5.reduce((s, g) => s + g.saves, 0)
  const totalShots = last5.reduce((s, g) => s + g.shotsAgainst, 0)
  const savePct = totalShots > 0 ? totalSaves / totalShots : 0

  if (savePct > 0.93) {
    trends.push({ id: 0, category: 'Goalie', title: `${abbr} — Goalie on Fire`, stat: `${(savePct * 100).toFixed(1)}% SV% last ${last5.length} starts`, note: `${goalie.name} has been elite in net recently.`, hot: savePct > 0.945 })
  }
  if (savePct < 0.88 && totalShots > 0) {
    trends.push({ id: 0, category: 'Goalie', title: `${abbr} — Goalie Struggling`, stat: `${(savePct * 100).toFixed(1)}% SV% last ${last5.length} starts`, note: `${goalie.name} has allowed more than usual — the data supports the opposing offense.`, hot: savePct < 0.86 })
  }

  return trends
}

function situationalTrends(abbr: string, log: NHLTeamGameLogRow[]): NHLTrend[] {
  const trends: NHLTrend[] = []
  const division = NHL_TEAM_DIVISIONS[abbr]
  const divisionGames = division ? log.filter((g) => NHL_TEAM_DIVISIONS[g.opponentAbbr] === division) : []
  if (divisionGames.length >= 5) {
    const wins = divisionGames.filter((g) => g.result === 'W').length
    trends.push({
      id: 0,
      category: 'Situational',
      title: `${abbr} — Divisional Record`,
      stat: `${wins}-${divisionGames.length - wins} in division games`,
      note: 'Performance against divisional rivals this season.',
      hot: false,
    })
  }

  const otGames = log.filter((g) => g.wentToOT)
  if (otGames.length >= 3) {
    const otWins = otGames.filter((g) => g.result === 'W').length
    trends.push({
      id: 0,
      category: 'Situational',
      title: `${abbr} — Overtime/Shootout Record`,
      stat: `${otWins}-${otGames.length - otWins} in games that went to OT/SO`,
      note: 'Extra-time performance this season.',
      hot: false,
    })
  }

  const homeGames = log.filter((g) => g.isHome)
  const awayGames = log.filter((g) => !g.isHome)
  if (homeGames.length >= 5 && awayGames.length >= 5) {
    const homeAvg = homeGames.reduce((s, g) => s + g.goalsFor, 0) / homeGames.length
    const awayAvg = awayGames.reduce((s, g) => s + g.goalsFor, 0) / awayGames.length
    if (Math.abs(homeAvg - awayAvg) >= 0.6) {
      const better = homeAvg > awayAvg ? 'home' : 'the road'
      trends.push({
        id: 0,
        category: 'Situational',
        title: `${abbr} — Home/Away Scoring Split`,
        stat: `${homeAvg.toFixed(1)} GPG home vs ${awayAvg.toFixed(1)} GPG away`,
        note: `Scores meaningfully more at ${better}.`,
        hot: Math.abs(homeAvg - awayAvg) >= 1,
      })
    }
  }

  return trends
}

function h2hTrends(awayAbbr: string, homeAbbr: string, awayLog: NHLTeamGameLogRow[]): NHLTrend[] {
  const meetings = awayLog.filter((g) => g.opponentAbbr === homeAbbr)
  if (meetings.length === 0) {
    return [{ id: 0, category: 'H2H', title: 'Season Series', stat: 'No completed meetings yet this season', note: 'First meeting of the season so far.', hot: false }]
  }

  // These rows come from the away team's own game log — a loss for them means the home team won.
  const homeWins = meetings.filter((g) => g.result === 'L').length
  const last5 = meetings.slice(0, 5)
  const avgCombined = last5.length > 0 ? last5.reduce((s, g) => s + g.goalsFor + g.goalsAgainst, 0) / last5.length : meetings.reduce((s, g) => s + g.goalsFor + g.goalsAgainst, 0) / meetings.length

  return [
    {
      id: 0,
      category: 'H2H',
      title: 'Season Series',
      stat: `${homeAbbr} ${homeWins}-${meetings.length - homeWins} ${awayAbbr} this season`,
      note: `${meetings.length} meeting${meetings.length !== 1 ? 's' : ''} so far, avg ${avgCombined.toFixed(1)} combined goals${last5.length > 0 ? ' in the last ' + last5.length : ''}.`,
      hot: false,
    },
  ]
}

export async function getNHLTrendsData(gameId: string): Promise<NHLTrend[] | null> {
  const matchup = await getNHLGameMatchup(gameId)
  if (!matchup) return null

  const [awayLog, homeLog, awayStats, homeStats] = await Promise.all([
    getNHLTeamGameLog(matchup.away.abbr),
    getNHLTeamGameLog(matchup.home.abbr),
    getNHLTeamStats(matchup.away.abbr),
    getNHLTeamStats(matchup.home.abbr),
  ])

  const [awayGoalieTrends, homeGoalieTrends] = await Promise.all([goalieTrends(matchup.away.abbr), goalieTrends(matchup.home.abbr)])

  const h2h = h2hTrends(matchup.away.abbr, matchup.home.abbr, awayLog ?? [])

  const trends: NHLTrend[] = [
    ...formTrends(matchup.away.abbr, awayLog ?? []),
    ...formTrends(matchup.home.abbr, homeLog ?? []),
    ...awayGoalieTrends,
    ...homeGoalieTrends,
    ...(awayStats ? specialTeamsTrends(matchup.away.abbr, awayStats.powerPlayPct, awayStats.penaltyKillPct) : []),
    ...(homeStats ? specialTeamsTrends(matchup.home.abbr, homeStats.powerPlayPct, homeStats.penaltyKillPct) : []),
    ...situationalTrends(matchup.away.abbr, awayLog ?? []),
    ...situationalTrends(matchup.home.abbr, homeLog ?? []),
    ...h2h,
  ]

  return trends.map((t, i) => ({ ...t, id: i + 1 }))
}

export { nhlAbbrFromTeamId }
