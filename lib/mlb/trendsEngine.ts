import { getPlayerGameLog, getStandings, getTeamScheduleResults, type RawScheduleResultGame } from './api'
import { getGameMatchup, getTeamHittingContext } from './gameBreakdown'

export type TrendCategory = 'Form' | 'Pitching' | 'Bullpen' | 'Offense' | 'Betting' | 'H2H' | 'Situational'

export interface Trend {
  id: number
  category: TrendCategory
  title: string
  stat: string
  note: string
  hot: boolean
}

// ---------------------------------------------------------------------------
// Real schedule-derived helpers
// ---------------------------------------------------------------------------

interface TeamGameResult {
  date: string
  runsFor: number
  runsAgainst: number
  win: boolean
  opponentId: number
}

function resultsForTeam(teamId: number, games: RawScheduleResultGame[]): TeamGameResult[] {
  return games
    .filter((g) => g.status.abstractGameState === 'Final')
    .map((g) => {
      const isHome = g.teams.home.team.id === teamId
      const mine = isHome ? g.teams.home : g.teams.away
      const opp = isHome ? g.teams.away : g.teams.home
      return {
        date: g.officialDate,
        runsFor: mine.score ?? 0,
        runsAgainst: opp.score ?? 0,
        win: Boolean(mine.isWinner),
        opponentId: opp.team.id,
      }
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

async function getRawSplitRecords(teamId: number): Promise<Map<string, { wins: number; losses: number }>> {
  const groups = await getStandings()
  const record = groups?.flatMap((g) => g.teamRecords).find((r) => r.team.id === teamId)
  const map = new Map<string, { wins: number; losses: number }>()
  for (const s of record?.records?.splitRecords ?? []) {
    map.set(s.type, { wins: s.wins, losses: s.losses })
  }
  return map
}

// ---------------------------------------------------------------------------
// Trend rules — Form
// ---------------------------------------------------------------------------

function formTrends(abbr: string, last10: TeamGameResult[], last3: TeamGameResult[]): Trend[] {
  const trends: Trend[] = []
  const wins10 = last10.filter((g) => g.win).length
  const losses10 = last10.length - wins10

  if (wins10 >= 7) {
    trends.push({
      id: 0,
      category: 'Form',
      title: `${abbr} — Strong Recent Form`,
      stat: `${wins10}-${losses10} in last 10`,
      note: 'A team playing at this level is a live favorite even against tougher matchups.',
      hot: wins10 >= 8,
    })
  }
  if (losses10 >= 6) {
    trends.push({
      id: 0,
      category: 'Form',
      title: `${abbr} — Struggling Stretch`,
      stat: `${wins10}-${losses10} in last 10`,
      note: 'A trend worth monitoring until the club shows signs of turning it around.',
      hot: losses10 >= 8,
    })
  }

  if (last10.length > 0) {
    const rpg10 = last10.reduce((s, g) => s + g.runsFor, 0) / last10.length
    if (rpg10 >= 5) {
      trends.push({
        id: 0,
        category: 'Offense',
        title: `${abbr} — Offensive Hot Streak`,
        stat: `${rpg10.toFixed(1)} runs/game over last 10`,
        note: 'Offense trending well above season norms — relevant for team totals and player props.',
        hot: rpg10 >= 6,
      })
    }
  }

  if (last3.length >= 3) {
    const runsAllowed3 = last3.reduce((s, g) => s + g.runsAgainst, 0)
    if (runsAllowed3 / last3.length <= 2) {
      trends.push({
        id: 0,
        category: 'Pitching',
        title: `${abbr} — Shutdown Pitching`,
        stat: `${runsAllowed3} runs allowed in last 3 games`,
        note: 'Pitching staff has locked opponents down — favors unders when this club is on the mound.',
        hot: runsAllowed3 <= 3,
      })
    }
  }

  return trends
}

// ---------------------------------------------------------------------------
// Trend rules — Pitching (starter)
// ---------------------------------------------------------------------------

async function pitcherTrends(abbr: string, pitcherId: number, pitcherName: string): Promise<Trend[]> {
  const log = await getPlayerGameLog(pitcherId, 'pitching')
  if (!log || log.length === 0) return []

  const sorted = [...log].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const trends: Trend[] = []

  const last3 = sorted.slice(0, 3)
  const last3Er = last3.reduce((s, g) => s + Number(g.stat.earnedRuns ?? 0), 0)
  const last3Outs = last3.reduce((s, g) => s + Number(g.stat.outs ?? 0), 0)
  const last3Era = last3Outs > 0 ? (9 * last3Er) / (last3Outs / 3) : null
  if (last3Era !== null && last3.length >= 3 && last3Era < 2.5) {
    trends.push({
      id: 0,
      category: 'Pitching',
      title: `${pitcherName} — Dominant Stretch`,
      stat: `${last3Era.toFixed(2)} ERA over last 3 starts`,
      note: `${abbr} gets a real edge on the mound tonight if this form holds.`,
      hot: last3Era < 1.5,
    })
  }

  const seasonOuts = log.reduce((s, g) => s + Number(g.stat.outs ?? 0), 0)
  const seasonK = log.reduce((s, g) => s + Number(g.stat.strikeOuts ?? 0), 0)
  const seasonK9 = seasonOuts > 0 ? (9 * seasonK) / (seasonOuts / 3) : 0
  if (seasonK9 > 10) {
    trends.push({
      id: 0,
      category: 'Pitching',
      title: `${pitcherName} — Elite Strikeout Pitcher`,
      stat: `${seasonK9.toFixed(1)} K/9 this season`,
      note: 'Strong lean toward the strikeout prop and under on contact-heavy stat lines.',
      hot: seasonK9 > 11.5,
    })
  }

  const last5 = sorted.slice(0, 5)
  const sixPlusCount = last5.filter((g) => parseFloat(String(g.stat.inningsPitched ?? '0')) >= 6).length
  if (last5.length >= 5 && sixPlusCount >= 4) {
    trends.push({
      id: 0,
      category: 'Pitching',
      title: `${pitcherName} — Workhorse`,
      stat: `${sixPlusCount} of last 5 starts with 6+ IP`,
      note: 'Deep starts reduce bullpen exposure — relevant for team total unders.',
      hot: sixPlusCount === 5,
    })
  }

  const homeGames = log.filter((g) => g.isHome)
  const awayGames = log.filter((g) => !g.isHome)
  const homeEra = eraFrom(homeGames)
  const awayEra = eraFrom(awayGames)
  if (homeEra !== null && awayEra !== null && Math.abs(homeEra - awayEra) > 1.0) {
    const better = homeEra < awayEra ? 'home' : 'road'
    trends.push({
      id: 0,
      category: 'Pitching',
      title: `${pitcherName} — Home/Road Split`,
      stat: `${homeEra.toFixed(2)} ERA at home vs ${awayEra.toFixed(2)} ERA on the road`,
      note: `Meaningfully better pitching ${better} this season.`,
      hot: Math.abs(homeEra - awayEra) > 1.75,
    })
  }

  return trends
}

function eraFrom(games: { stat: Record<string, string | number> }[]): number | null {
  const er = games.reduce((s, g) => s + Number(g.stat.earnedRuns ?? 0), 0)
  const outs = games.reduce((s, g) => s + Number(g.stat.outs ?? 0), 0)
  return outs > 0 ? (9 * er) / (outs / 3) : null
}

// ---------------------------------------------------------------------------
// Trend rules — Betting (proxied against a league-average total — see disclosure below)
// ---------------------------------------------------------------------------

function bettingTrends(abbr: string, allResults: TeamGameResult[], leagueAvgTotal: number, pitcherName: string | null, pitcherResults: TeamGameResult[]): Trend[] {
  const trends: Trend[] = []
  if (allResults.length < 10) return trends

  const overs = allResults.filter((g) => g.runsFor + g.runsAgainst > leagueAvgTotal).length
  const overPct = (overs / allResults.length) * 100
  if (overPct >= 55) {
    trends.push({
      id: 0,
      category: 'Betting',
      title: `${abbr} — Over Trend`,
      stat: `${overPct.toFixed(0)}% of games finished above the league-average total (${leagueAvgTotal.toFixed(1)} combined runs)`,
      note: 'No real betting line data available — this compares combined runs to the league-average game total as a proxy, not an actual posted total.',
      hot: overPct >= 65,
    })
  } else if (overPct <= 45) {
    trends.push({
      id: 0,
      category: 'Betting',
      title: `${abbr} — Under Trend`,
      stat: `${(100 - overPct).toFixed(0)}% of games finished below the league-average total (${leagueAvgTotal.toFixed(1)} combined runs)`,
      note: 'No real betting line data available — this compares combined runs to the league-average game total as a proxy, not an actual posted total.',
      hot: overPct <= 35,
    })
  }

  if (pitcherName && pitcherResults.length >= 5) {
    const underRate = (pitcherResults.filter((g) => g.runsFor + g.runsAgainst <= leagueAvgTotal).length / pitcherResults.length) * 100
    if (underRate >= 60) {
      trends.push({
        id: 0,
        category: 'Betting',
        title: `${pitcherName} — Pitcher Suppresses Scoring`,
        stat: `${underRate.toFixed(0)}% of his starts finished at or below the league-average total`,
        note: 'Proxied against the league-average combined-run total, not a real posted line.',
        hot: underRate >= 70,
      })
    }
  }

  return trends
}

// ---------------------------------------------------------------------------
// Trend rules — Situational
// ---------------------------------------------------------------------------

function situationalTrends(
  homeAbbr: string,
  awayAbbr: string,
  homeSplits: Map<string, { wins: number; losses: number }>,
  awaySplits: Map<string, { wins: number; losses: number }>
): Trend[] {
  const trends: Trend[] = []

  const homeHome = homeSplits.get('home')
  if (homeHome) {
    const total = homeHome.wins + homeHome.losses
    const pct = total > 0 ? (homeHome.wins / total) * 100 : 0
    if (pct >= 65) {
      trends.push({
        id: 0,
        category: 'Situational',
        title: `${homeAbbr} — Strong Home Field`,
        stat: `${homeHome.wins}-${homeHome.losses} at home (${pct.toFixed(0)}%)`,
        note: 'A real edge for the home side in this matchup.',
        hot: pct >= 70,
      })
    }
  }

  for (const [abbr, splits] of [[homeAbbr, homeSplits] as const, [awayAbbr, awaySplits] as const]) {
    const day = splits.get('day')
    const night = splits.get('night')
    if (day && night) {
      const dayTotal = day.wins + day.losses
      const nightTotal = night.wins + night.losses
      if (dayTotal >= 5 && nightTotal >= 5) {
        const dayPct = (day.wins / dayTotal) * 100
        const nightPct = (night.wins / nightTotal) * 100
        if (Math.abs(dayPct - nightPct) >= 20) {
          const better = dayPct > nightPct ? 'day' : 'night'
          trends.push({
            id: 0,
            category: 'Situational',
            title: `${abbr} — Day/Night Split`,
            stat: `${day.wins}-${day.losses} (${dayPct.toFixed(0)}%) day vs ${night.wins}-${night.losses} (${nightPct.toFixed(0)}%) night`,
            note: `Notably better in ${better} games this season.`,
            hot: Math.abs(dayPct - nightPct) >= 30,
          })
        }
      }
    }

    const oneRun = splits.get('oneRun')
    if (oneRun) {
      const total = oneRun.wins + oneRun.losses
      if (total >= 8) {
        const pct = (oneRun.wins / total) * 100
        trends.push({
          id: 0,
          category: 'Situational',
          title: `${abbr} — One-Run Games`,
          stat: `${oneRun.wins}-${oneRun.losses} in one-run games (${pct.toFixed(0)}%)`,
          note: pct >= 55 ? 'Performs well in close games — live in tight spots late.' : 'Struggles to close out tight games.',
          hot: pct >= 65 || pct <= 35,
        })
      }
    }
  }

  return trends
}

async function dayOffTrend(abbr: string, allGames: RawScheduleResultGame[], results: TeamGameResult[]): Promise<Trend | null> {
  const finalGames = allGames.filter((g) => g.status.abstractGameState === 'Final').sort((a, b) => new Date(a.officialDate).getTime() - new Date(b.officialDate).getTime())
  if (finalGames.length < 10) return null

  const resultByDate = new Map(results.map((r) => [r.date, r]))
  let wins = 0
  let total = 0
  for (let i = 1; i < finalGames.length; i++) {
    const gapDays = Math.round(
      (new Date(finalGames[i].officialDate).getTime() - new Date(finalGames[i - 1].officialDate).getTime()) / (24 * 60 * 60 * 1000)
    )
    if (gapDays >= 2) {
      const r = resultByDate.get(finalGames[i].officialDate)
      if (r) {
        total++
        if (r.win) wins++
      }
    }
  }
  if (total < 5) return null
  const pct = (wins / total) * 100
  return {
    id: 0,
    category: 'Situational',
    title: `${abbr} — Record After Day Off`,
    stat: `${wins}-${total - wins} after a day off (${pct.toFixed(0)}%)`,
    note: pct >= 60 ? 'Comes out sharp after rest.' : pct <= 40 ? 'Tends to come out flat after rest.' : 'No strong signal here.',
    hot: pct >= 65 || pct <= 35,
  }
}

// ---------------------------------------------------------------------------
// H2H
// ---------------------------------------------------------------------------

function h2hTrend(awayAbbr: string, homeAbbr: string, homeId: number, h2hGames: RawScheduleResultGame[]): Trend {
  if (h2hGames.length === 0) {
    return {
      id: 0,
      category: 'H2H',
      title: 'Season Series',
      stat: 'No completed meetings yet this season',
      note: 'First meeting of the season, or earlier games not yet played.',
      hot: false,
    }
  }

  let homeWins = 0
  let homeRuns = 0
  let awayRuns = 0
  for (const g of h2hGames) {
    const isHomeTeamHome = g.teams.home.team.id === homeId
    const homeSideScore = isHomeTeamHome ? (g.teams.home.score ?? 0) : (g.teams.away.score ?? 0)
    const awaySideScore = isHomeTeamHome ? (g.teams.away.score ?? 0) : (g.teams.home.score ?? 0)
    homeRuns += homeSideScore
    awayRuns += awaySideScore
    const homeTeamWon = isHomeTeamHome ? g.teams.home.isWinner : g.teams.away.isWinner
    if (homeTeamWon) homeWins++
  }
  const awayWins = h2hGames.length - homeWins

  return {
    id: 0,
    category: 'H2H',
    title: 'Season Series',
    stat: `${homeAbbr} ${homeWins}-${awayWins} ${awayAbbr} · ${homeRuns}-${awayRuns} combined runs (${homeAbbr}-${awayAbbr})`,
    note: `${h2hGames.length} meeting${h2hGames.length !== 1 ? 's' : ''} so far this season.`,
    hot: false,
  }
}

// ---------------------------------------------------------------------------
// Aggregator
// ---------------------------------------------------------------------------

export async function getTrendsData(gamePk: number): Promise<Trend[] | null> {
  const matchup = await getGameMatchup(gamePk)
  if (!matchup) return null

  const [awayGames, homeGames, awaySplitsMap, homeSplitsMap, awayHitting, homeHitting] = await Promise.all([
    getTeamScheduleResults(matchup.away.id),
    getTeamScheduleResults(matchup.home.id),
    getRawSplitRecords(matchup.away.id),
    getRawSplitRecords(matchup.home.id),
    getTeamHittingContext(matchup.away.id),
    getTeamHittingContext(matchup.home.id),
  ])

  const awayResults = resultsForTeam(matchup.away.id, awayGames ?? [])
  const homeResults = resultsForTeam(matchup.home.id, homeGames ?? [])
  const awayLast10 = awayResults.slice(0, 10)
  const homeLast10 = homeResults.slice(0, 10)
  const awayLast3 = awayResults.slice(0, 3)
  const homeLast3 = homeResults.slice(0, 3)

  const leagueAvgTotal = awayHitting && homeHitting ? awayHitting.runsPerGame + homeHitting.runsPerGame : 8.5

  const awayPitcherResults = matchup.probablePitchers.away ? awayResults : []
  const homePitcherResults = matchup.probablePitchers.home ? homeResults : []

  const h2hGames = (awayGames ?? []).filter(
    (g) => g.status.abstractGameState === 'Final' && (g.teams.away.team.id === matchup.home.id || g.teams.home.team.id === matchup.home.id)
  )

  const [awayPitcherTrends, homePitcherTrends, awayDayOff, homeDayOff] = await Promise.all([
    matchup.probablePitchers.away ? pitcherTrends(matchup.away.abbr, matchup.probablePitchers.away.id, matchup.probablePitchers.away.name) : Promise.resolve([]),
    matchup.probablePitchers.home ? pitcherTrends(matchup.home.abbr, matchup.probablePitchers.home.id, matchup.probablePitchers.home.name) : Promise.resolve([]),
    dayOffTrend(matchup.away.abbr, awayGames ?? [], awayResults),
    dayOffTrend(matchup.home.abbr, homeGames ?? [], homeResults),
  ])

  const trends: Trend[] = [
    ...formTrends(matchup.away.abbr, awayLast10, awayLast3),
    ...formTrends(matchup.home.abbr, homeLast10, homeLast3),
    ...awayPitcherTrends,
    ...homePitcherTrends,
    ...bettingTrends(matchup.away.abbr, awayResults, leagueAvgTotal, matchup.probablePitchers.away?.name ?? null, awayPitcherResults),
    ...bettingTrends(matchup.home.abbr, homeResults, leagueAvgTotal, matchup.probablePitchers.home?.name ?? null, homePitcherResults),
    h2hTrend(matchup.away.abbr, matchup.home.abbr, matchup.home.id, h2hGames),
    ...situationalTrends(matchup.home.abbr, matchup.away.abbr, homeSplitsMap, awaySplitsMap),
    ...(awayDayOff ? [awayDayOff] : []),
    ...(homeDayOff ? [homeDayOff] : []),
  ]

  return trends.map((t, i) => ({ ...t, id: i + 1 }))
}
