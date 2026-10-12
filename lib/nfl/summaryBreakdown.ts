import { getNFLSchedule, getNFLWeeklyPlayerStats } from './api'
import { normalizeNflAbbr } from './divisions'
import { getNFLGameMatchup, getNFLTeamStats, type NFLTeamStats } from './gameBreakdown'

function n(v: string | undefined): number {
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : 0
}

export interface NFLLastGameRow {
  week: number
  date: string
  opp: string
  result: 'W' | 'L' | 'T'
  score: string
  passYds: number
  rushYds: number
}

export interface NFLTeamSummaryCard {
  abbr: string
  record: { wins: number; losses: number; ties: number; pct: number }
  last5Dots: ('W' | 'L' | 'T')[]
  offense: { pointsPerGame: number; passYdsPerGame: number; rushYdsPerGame: number; turnoversPerGame: number }
  defense: { pointsAllowedPerGame: number; passYdsAllowedPerGame: number; rushYdsAllowedPerGame: number; sacks: number; turnoversForcedPerGame: number }
  last5: NFLLastGameRow[]
  /** League-specific extra stats (college: conference record, record vs ranked teams). */
  extras?: { label: string; value: string }[]
}

export async function getNFLTeamSummaryCard(teamAbbr: string, season: number): Promise<NFLTeamSummaryCard | null> {
  const [stats, schedule, weeklyOffense] = await Promise.all([
    getNFLTeamStats(teamAbbr, season),
    getNFLSchedule(season),
    getNFLWeeklyPlayerStats(season),
  ])
  if (!stats || !schedule) return null

  const played = schedule
    .filter((r) => r.game_type === 'REG' && r.home_score !== '' && r.away_score !== '')
    .filter((r) => normalizeNflAbbr(r.home_team) === teamAbbr || normalizeNflAbbr(r.away_team) === teamAbbr)
    .sort((a, b) => Number(a.week) - Number(b.week))

  const results = played.map((g) => {
    const isHome = normalizeNflAbbr(g.home_team) === teamAbbr
    const my = isHome ? n(g.home_score) : n(g.away_score)
    const opp = isHome ? n(g.away_score) : n(g.home_score)
    const oppAbbr = normalizeNflAbbr(isHome ? g.away_team : g.home_team)
    const result: 'W' | 'L' | 'T' = my > opp ? 'W' : my < opp ? 'L' : 'T'
    const teamWeekRows = (weeklyOffense ?? []).filter((r) => r.week === g.week && normalizeNflAbbr(r.recent_team) === teamAbbr)
    return {
      week: n(g.week),
      date: g.gameday,
      opp: oppAbbr,
      result,
      score: `${my}-${opp}`,
      passYds: teamWeekRows.reduce((s, r) => s + n(r.passing_yards), 0),
      rushYds: teamWeekRows.reduce((s, r) => s + n(r.rushing_yards), 0),
    }
  })

  const last5 = results.slice(-5).reverse()

  return {
    abbr: teamAbbr,
    record: { wins: stats.wins, losses: stats.losses, ties: stats.ties, pct: stats.wins + stats.losses > 0 ? Math.round((stats.wins / (stats.wins + stats.losses)) * 1000) / 10 : 0 },
    last5Dots: results.slice(-10).map((r) => r.result),
    offense: {
      pointsPerGame: stats.pointsPerGame,
      passYdsPerGame: stats.passYdsPerGame,
      rushYdsPerGame: stats.rushYdsPerGame,
      turnoversPerGame: stats.turnoversPerGame,
    },
    defense: {
      pointsAllowedPerGame: stats.pointsAllowedPerGame,
      passYdsAllowedPerGame: stats.passYdsAllowedPerGame,
      rushYdsAllowedPerGame: stats.rushYdsAllowedPerGame,
      sacks: stats.sacks,
      turnoversForcedPerGame: stats.turnoversForcedPerGame,
    },
    last5,
  }
}

// ---------------------------------------------------------------------------
// Betting summary — real spread_line/total_line from nflverse (not a proxy).
// spread_line convention: positive = home team favored by that many points (verified against results).
// ---------------------------------------------------------------------------

export interface NFLBettingLine {
  label: string
  wins: number
  losses: number
  pct: number
}

function toLine(label: string, wins: number, losses: number): NFLBettingLine {
  const total = wins + losses
  return { label, wins, losses, pct: total > 0 ? Math.round((wins / total) * 1000) / 10 : 0 }
}

export interface NFLTeamBettingSummary {
  moneyline: NFLBettingLine
  ats: NFLBettingLine
  overUnder: NFLBettingLine
  last5OverUnder: NFLBettingLine
  homeRecord: NFLBettingLine
  awayRecord: NFLBettingLine
  note: string
}

export async function getNFLTeamBettingSummary(teamAbbr: string, season: number): Promise<NFLTeamBettingSummary | null> {
  const schedule = await getNFLSchedule(season)
  if (!schedule) return null

  const played = schedule
    .filter((r) => r.game_type === 'REG' && r.home_score !== '' && r.away_score !== '')
    .filter((r) => normalizeNflAbbr(r.home_team) === teamAbbr || normalizeNflAbbr(r.away_team) === teamAbbr)
    .sort((a, b) => Number(a.week) - Number(b.week))

  if (played.length === 0) return null

  let mlW = 0
  let atsW = 0
  let atsTotal = 0
  let overW = 0
  let overTotal = 0
  let homeW = 0
  let homeTotal = 0
  let awayW = 0
  let awayTotal = 0

  const withResults = played.map((g) => {
    const isHome = normalizeNflAbbr(g.home_team) === teamAbbr
    const my = isHome ? n(g.home_score) : n(g.away_score)
    const opp = isHome ? n(g.away_score) : n(g.home_score)
    const win = my > opp
    const margin = my - opp
    const teamSpread = g.spread_line ? (isHome ? -Number(g.spread_line) : Number(g.spread_line)) : null
    const covered = teamSpread !== null ? margin + teamSpread > 0 : null
    const totalPts = n(g.total)
    const totalLine = g.total_line ? Number(g.total_line) : null
    const over = totalLine !== null ? totalPts > totalLine : null

    if (win) mlW++
    if (covered !== null) {
      atsTotal++
      if (covered) atsW++
    }
    if (over !== null) {
      overTotal++
      if (over) overW++
    }
    if (isHome) {
      homeTotal++
      if (win) homeW++
    } else {
      awayTotal++
      if (win) awayW++
    }

    return { win, over }
  })

  const last5 = withResults.slice(-5)
  const last5OverTotal = last5.filter((g) => g.over !== null).length
  const last5OverW = last5.filter((g) => g.over === true).length

  return {
    moneyline: toLine(`${teamAbbr} ML`, mlW, played.length - mlW),
    ats: toLine(`${teamAbbr} ATS`, atsW, atsTotal - atsW),
    overUnder: toLine(`${teamAbbr} O/U`, overW, overTotal - overW),
    last5OverUnder: toLine(`${teamAbbr} L5 O/U`, last5OverW, last5OverTotal - last5OverW),
    homeRecord: toLine(`${teamAbbr} Home`, homeW, homeTotal - homeW),
    awayRecord: toLine(`${teamAbbr} Away`, awayW, awayTotal - awayW),
    note: 'ATS and Over/Under use real closing spread_line/total_line from nflverse (not a proxy). ATS treats a positive spread_line as the home team being favored — the standard nflverse convention.',
  }
}

// ---------------------------------------------------------------------------
// Full Summary-tab aggregator
// ---------------------------------------------------------------------------

export interface NFLSummaryTabData {
  away: NFLTeamSummaryCard | null
  home: NFLTeamSummaryCard | null
  awayBetting: NFLTeamBettingSummary | null
  homeBetting: NFLTeamBettingSummary | null
}

export async function getNFLSummaryTabData(gameId: string): Promise<NFLSummaryTabData | null> {
  const matchup = await getNFLGameMatchup(gameId)
  if (!matchup) return null

  const [away, home, awayBetting, homeBetting] = await Promise.all([
    getNFLTeamSummaryCard(matchup.away.abbr, matchup.season),
    getNFLTeamSummaryCard(matchup.home.abbr, matchup.season),
    getNFLTeamBettingSummary(matchup.away.abbr, matchup.season),
    getNFLTeamBettingSummary(matchup.home.abbr, matchup.season),
  ])

  return { away, home, awayBetting, homeBetting }
}

export type { NFLTeamStats }
