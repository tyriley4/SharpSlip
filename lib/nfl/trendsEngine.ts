import { getNFLAdvancedStats, getNFLSchedule, getNFLWeeklyPlayerStats } from './api'
import { normalizeNflAbbr } from './divisions'
import { getNFLGameMatchup, passerRating } from './gameBreakdown'

export type NFLTrendCategory = 'Form' | 'Passing' | 'Rushing' | 'Situational' | 'H2H'

export interface NFLTrend {
  id: number
  category: NFLTrendCategory
  title: string
  stat: string
  note: string
  hot: boolean
}

function n(v: string | undefined): number {
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : 0
}

interface GameResult {
  week: number
  my: number
  opp: number
  win: boolean
  isHome: boolean
  divGame: boolean
  spreadLine: number | null
  primetime: boolean
  roof: string
}

function resultsForTeam(teamAbbr: string, schedule: Record<string, string>[]): GameResult[] {
  return schedule
    .filter((r) => r.game_type === 'REG' && r.home_score !== '' && r.away_score !== '')
    .filter((r) => normalizeNflAbbr(r.home_team) === teamAbbr || normalizeNflAbbr(r.away_team) === teamAbbr)
    .map((r) => {
      const isHome = normalizeNflAbbr(r.home_team) === teamAbbr
      const my = isHome ? n(r.home_score) : n(r.away_score)
      const opp = isHome ? n(r.away_score) : n(r.home_score)
      const hour = r.gametime ? Number(r.gametime.split(':')[0]) : 13
      return {
        week: n(r.week),
        my,
        opp,
        win: my > opp,
        isHome,
        divGame: r.div_game === '1',
        spreadLine: r.spread_line ? Number(r.spread_line) : null,
        primetime: hour >= 19 || r.weekday === 'Monday' || r.weekday === 'Thursday',
        roof: r.roof || 'outdoors',
      }
    })
    .sort((a, b) => a.week - b.week)
}

function formTrends(abbr: string, last10: GameResult[], last3: GameResult[]): NFLTrend[] {
  const trends: NFLTrend[] = []
  const last5 = last10.slice(-5)
  const wins5 = last5.filter((g) => g.win).length

  if (last5.length === 5 && wins5 >= 4) {
    trends.push({ id: 0, category: 'Form', title: `${abbr} — Strong Recent Form`, stat: `${wins5}-${5 - wins5} in last 5`, note: 'Playing at a high level heading into this matchup.', hot: wins5 === 5 })
  }
  if (last5.length === 5 && 5 - wins5 >= 4) {
    trends.push({ id: 0, category: 'Form', title: `${abbr} — Struggling Stretch`, stat: `${wins5}-${5 - wins5} in last 5`, note: 'A trend worth monitoring until they show signs of life.', hot: wins5 === 0 })
  }
  if (last3.length === 3) {
    const pts3 = last3.reduce((s, g) => s + g.my, 0)
    if (pts3 >= 90) {
      trends.push({ id: 0, category: 'Form', title: `${abbr} — Offensive Hot Streak`, stat: `${(pts3 / 3).toFixed(1)} pts/g over last 3`, note: 'Offense trending well above season norms.', hot: pts3 / 3 >= 32 })
    }
    const ptsAllowed3 = last3.reduce((s, g) => s + g.opp, 0)
    if (ptsAllowed3 / 3 <= 17) {
      trends.push({ id: 0, category: 'Form', title: `${abbr} — Defensive Dominance`, stat: `${(ptsAllowed3 / 3).toFixed(1)} pts allowed/g over last 3`, note: 'Defense locking teams down — favors unders.', hot: ptsAllowed3 / 3 <= 13 })
    }
  }
  return trends
}

async function passingTrends(abbr: string, qbId: string, qbName: string, season: number): Promise<NFLTrend[]> {
  const [weekly, ngs] = await Promise.all([getNFLWeeklyPlayerStats(season), getNFLAdvancedStats('passing', season)])
  const trends: NFLTrend[] = []
  if (!weekly) return trends

  const games = weekly.filter((r) => r.player_id === qbId && n(r.attempts) > 0).sort((a, b) => Number(b.week) - Number(a.week))
  const last3 = games.slice(0, 3)
  if (last3.length === 3) {
    const comp = last3.reduce((s, r) => s + n(r.completions), 0)
    const att = last3.reduce((s, r) => s + n(r.attempts), 0)
    const yds = last3.reduce((s, r) => s + n(r.passing_yards), 0)
    const td = last3.reduce((s, r) => s + n(r.passing_tds), 0)
    const int = last3.reduce((s, r) => s + n(r.interceptions), 0)
    const rating = passerRating(comp, att, yds, td, int)
    if (rating > 100) {
      trends.push({ id: 0, category: 'Passing', title: `${qbName} — QB on Fire`, stat: `${rating.toFixed(1)} rating over last 3 games`, note: `${abbr} gets a real passing edge if this holds.`, hot: rating > 115 })
    } else if (rating < 75) {
      trends.push({ id: 0, category: 'Passing', title: `${qbName} — QB Struggling`, stat: `${rating.toFixed(1)} rating over last 3 games`, note: 'Key trend: passing output has been below average recently.', hot: rating < 60 })
    }
  }

  const ngsRow = ngs?.find((r) => r.player_display_name === qbName)
  if (ngsRow) {
    const cpoe = Number(ngsRow.completion_percentage_above_expectation)
    if (cpoe > 5) {
      trends.push({ id: 0, category: 'Passing', title: `${qbName} — Elite Accuracy`, stat: `+${cpoe.toFixed(1)}% CPOE this season`, note: 'Completing passes well above expectation all year.', hot: cpoe > 8 })
    }
  }

  return trends
}

function rushingTrends(abbr: string, teamAbbr: string, weekly: Record<string, string>[]): NFLTrend[] {
  const trends: NFLTrend[] = []
  const teamRows = weekly.filter((r) => normalizeNflAbbr(r.recent_team) === teamAbbr)
  const weeks = Array.from(new Set(teamRows.map((r) => n(r.week)))).sort((a, b) => b - a).slice(0, 3)
  if (weeks.length < 3) return trends

  const rushYds = weeks.reduce((sum, wk) => sum + teamRows.filter((r) => n(r.week) === wk).reduce((s, r) => s + n(r.rushing_yards), 0), 0)
  const avg = rushYds / 3
  if (avg >= 150) {
    trends.push({ id: 0, category: 'Rushing', title: `${abbr} — Ground Game Rolling`, stat: `${avg.toFixed(1)} rush yds/g over last 3`, note: 'Run game is dictating tempo — favors run-heavy game script.', hot: avg >= 175 })
  } else if (avg < 80) {
    trends.push({ id: 0, category: 'Rushing', title: `${abbr} — Run Game Stalling`, stat: `${avg.toFixed(1)} rush yds/g over last 3`, note: 'Ground game has gone cold — leaning pass-heavy.', hot: avg < 60 })
  }
  return trends
}

function situationalTrends(abbr: string, results: GameResult[]): NFLTrend[] {
  const trends: NFLTrend[] = []

  const divGames = results.filter((g) => g.divGame)
  if (divGames.length >= 3) {
    const w = divGames.filter((g) => g.win).length
    trends.push({ id: 0, category: 'Situational', title: `${abbr} — Divisional Record`, stat: `${w}-${divGames.length - w} in division games`, note: 'Divisional games tend to be tighter, more physical matchups.', hot: false })
  }

  const withSpread = results.filter((g) => g.spreadLine !== null)
  const favoriteGames = withSpread.filter((g) => (g.isHome ? (g.spreadLine as number) > 0 : (g.spreadLine as number) < 0))
  const underdogGames = withSpread.filter((g) => (g.isHome ? (g.spreadLine as number) < 0 : (g.spreadLine as number) > 0))
  if (favoriteGames.length >= 3) {
    const w = favoriteGames.filter((g) => g.win).length
    trends.push({ id: 0, category: 'Situational', title: `${abbr} — Record as Favorite`, stat: `${w}-${favoriteGames.length - w} as the favorite`, note: 'Favorite spot per the closing spread.', hot: false })
  }
  if (underdogGames.length >= 3) {
    const w = underdogGames.filter((g) => g.win).length
    trends.push({ id: 0, category: 'Situational', title: `${abbr} — Record as Underdog`, stat: `${w}-${underdogGames.length - w} as the underdog`, note: 'Underdog spot per the closing spread.', hot: false })
  }

  const domeGames = results.filter((g) => g.roof === 'dome' || g.roof === 'closed')
  const outdoorGames = results.filter((g) => g.roof === 'outdoors' || g.roof === 'open')
  if (domeGames.length >= 3 && outdoorGames.length >= 3) {
    const domeW = domeGames.filter((g) => g.win).length
    const outdoorW = outdoorGames.filter((g) => g.win).length
    trends.push({
      id: 0,
      category: 'Situational',
      title: `${abbr} — Indoor vs Outdoor`,
      stat: `${domeW}-${domeGames.length - domeW} indoors, ${outdoorW}-${outdoorGames.length - outdoorW} outdoors`,
      note: 'Split by roof type this season.',
      hot: false,
    })
  }

  const primetimeGames = results.filter((g) => g.primetime)
  if (primetimeGames.length >= 2) {
    const w = primetimeGames.filter((g) => g.win).length
    trends.push({ id: 0, category: 'Situational', title: `${abbr} — Primetime Record`, stat: `${w}-${primetimeGames.length - w} in primetime games`, note: 'Night/marquee game performance.', hot: false })
  }

  return trends
}

async function h2hTrends(awayAbbr: string, homeAbbr: string, homeId: number, currentSeason: number): Promise<NFLTrend[]> {
  const trends: NFLTrend[] = []
  const seasons = [currentSeason, currentSeason - 1, currentSeason - 2, currentSeason - 3]
  const allGames = (await Promise.all(seasons.map((s) => getNFLSchedule(s)))).flatMap((rows) => rows ?? [])

  const meetings = allGames
    .filter((r) => r.game_type === 'REG' && r.home_score !== '' && r.away_score !== '')
    .filter((r) => (normalizeNflAbbr(r.home_team) === awayAbbr && normalizeNflAbbr(r.away_team) === homeAbbr) || (normalizeNflAbbr(r.home_team) === homeAbbr && normalizeNflAbbr(r.away_team) === awayAbbr))
    .sort((a, b) => Number(b.season) - Number(a.season) || Number(b.week) - Number(a.week))

  const seasonMeetings = meetings.filter((r) => Number(r.season) === currentSeason)
  if (seasonMeetings.length > 0) {
    let homeWins = 0
    for (const g of seasonMeetings) {
      const isHomeHome = normalizeNflAbbr(g.home_team) === homeAbbr
      const homeScore = isHomeHome ? n(g.home_score) : n(g.away_score)
      const awayScore = isHomeHome ? n(g.away_score) : n(g.home_score)
      if (homeScore > awayScore) homeWins++
    }
    trends.push({
      id: 0,
      category: 'H2H',
      title: 'Season Series',
      stat: `${homeAbbr} ${homeWins}-${seasonMeetings.length - homeWins} ${awayAbbr} this season`,
      note: `${seasonMeetings.length} meeting${seasonMeetings.length !== 1 ? 's' : ''} so far.`,
      hot: false,
    })
  }

  const last5 = meetings.slice(0, 5)
  if (last5.length > 0) {
    let homeWins = 0
    let totalCombined = 0
    for (const g of last5) {
      const isHomeHome = normalizeNflAbbr(g.home_team) === homeAbbr
      const homeScore = isHomeHome ? n(g.home_score) : n(g.away_score)
      const awayScore = isHomeHome ? n(g.away_score) : n(g.home_score)
      if (homeScore > awayScore) homeWins++
      totalCombined += homeScore + awayScore
    }
    trends.push({
      id: 0,
      category: 'H2H',
      title: 'Last 5 Meetings',
      stat: `${homeAbbr} ${homeWins}-${last5.length - homeWins} ${awayAbbr} · avg combined ${(totalCombined / last5.length).toFixed(1)} pts`,
      note: `Across the last ${last5.length} meetings between these teams.`,
      hot: false,
    })
  }

  return trends
}

export async function getNFLTrendsData(gameId: string): Promise<NFLTrend[] | null> {
  const matchup = await getNFLGameMatchup(gameId)
  if (!matchup) return null

  const season = matchup.season
  const [schedule, weeklyOffense] = await Promise.all([getNFLSchedule(season), getNFLWeeklyPlayerStats(season)])
  if (!schedule) return null

  const awayResults = resultsForTeam(matchup.away.abbr, schedule)
  const homeResults = resultsForTeam(matchup.home.abbr, schedule)

  const [awayQBTrends, homeQBTrends, h2h] = await Promise.all([
    matchup.away.qbId && matchup.away.qbName ? passingTrends(matchup.away.abbr, matchup.away.qbId, matchup.away.qbName, season) : Promise.resolve([]),
    matchup.home.qbId && matchup.home.qbName ? passingTrends(matchup.home.abbr, matchup.home.qbId, matchup.home.qbName, season) : Promise.resolve([]),
    h2hTrends(matchup.away.abbr, matchup.home.abbr, 0, season),
  ])

  const trends: NFLTrend[] = [
    ...formTrends(matchup.away.abbr, awayResults, awayResults.slice(-3)),
    ...formTrends(matchup.home.abbr, homeResults, homeResults.slice(-3)),
    ...awayQBTrends,
    ...homeQBTrends,
    ...(weeklyOffense ? rushingTrends(matchup.away.abbr, matchup.away.abbr, weeklyOffense) : []),
    ...(weeklyOffense ? rushingTrends(matchup.home.abbr, matchup.home.abbr, weeklyOffense) : []),
    ...situationalTrends(matchup.away.abbr, awayResults),
    ...situationalTrends(matchup.home.abbr, homeResults),
    ...h2h,
  ]

  return trends.map((t, i) => ({ ...t, id: i + 1 }))
}
