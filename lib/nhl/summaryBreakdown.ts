import { getNHLStandings, getNHLTeamGameLog, getNHLTeamStats, type NHLTeamGameLogRow } from './api'
import { getNHLGameMatchup } from './gameBreakdown'
import { NHL_CURRENT_SEASON } from './divisions'
import { getRealLineRecords } from '@/lib/odds/history'

export interface NHLLastGameRow {
  date: string
  opp: string
  result: 'W' | 'L'
  score: string
}

export interface NHLTeamSummaryCard {
  abbr: string
  record: { wins: number; losses: number; otLosses: number; pointPct: number }
  last10Dots: ('W' | 'L')[]
  offense: { gpg: number; shPct: number; sogPerGame: number; ppPct: number }
  defense: { gaa: number; svPct: number; saPerGame: number; pkPct: number }
  last5: NHLLastGameRow[]
}

export async function getNHLTeamSummaryCard(abbr: string): Promise<NHLTeamSummaryCard | null> {
  const [stats, standing, log] = await Promise.all([getNHLTeamStats(abbr), getNHLStandings().then((s) => s?.find((t) => t.abbr === abbr) ?? null), getNHLTeamGameLog(abbr)])
  if (!stats) return null

  const sorted = [...(log ?? [])].sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
  const last10 = sorted.slice(0, 10).map((g) => (g.result === 'W' ? 'W' : 'L') as 'W' | 'L').reverse()
  const last5: NHLLastGameRow[] = sorted.slice(0, 5).map((g) => ({
    date: g.gameDate,
    opp: g.opponentAbbr,
    result: g.result === 'W' ? 'W' : 'L',
    score: `${g.goalsFor}-${g.goalsAgainst}`,
  }))

  const shPct = stats.shotsForPerGame > 0 ? stats.goalsForPerGame / stats.shotsForPerGame : 0
  const svPct = stats.shotsAgainstPerGame > 0 ? (stats.shotsAgainstPerGame - stats.goalsAgainstPerGame) / stats.shotsAgainstPerGame : 0

  return {
    abbr,
    record: {
      wins: standing?.wins ?? stats.wins,
      losses: standing?.losses ?? stats.losses,
      otLosses: standing?.otLosses ?? stats.otLosses,
      pointPct: stats.pointPct,
    },
    last10Dots: last10,
    offense: { gpg: stats.goalsForPerGame, shPct, sogPerGame: stats.shotsForPerGame, ppPct: stats.powerPlayPct },
    defense: { gaa: stats.goalsAgainstPerGame, svPct, saPerGame: stats.shotsAgainstPerGame, pkPct: stats.penaltyKillPct },
    last5,
  }
}

export interface NHLBettingLine {
  label: string
  wins: number
  losses: number
  pct: number
}

function toLine(label: string, wins: number, losses: number): NHLBettingLine {
  const total = wins + losses
  return { label, wins, losses, pct: total > 0 ? Math.round((wins / total) * 1000) / 10 : 0 }
}

export interface NHLTeamBettingSummary {
  moneyline: NHLBettingLine
  puckLine: NHLBettingLine
  overUnder: NHLBettingLine
  last5OverUnder: NHLBettingLine
  note: string
}

const PUCK_LINE_PROXY_MARGIN = 1.5

export async function getNHLTeamBettingSummary(abbr: string, leagueAvgTotal: number): Promise<NHLTeamBettingSummary | null> {
  const log = await getNHLTeamGameLog(abbr)
  if (!log || log.length === 0) return null

  let mlW = 0
  let plW = 0
  let overW = 0

  for (const g of log) {
    if (g.result === 'W') mlW++
    if (g.goalsFor - g.goalsAgainst >= PUCK_LINE_PROXY_MARGIN) plW++
    if (g.goalsFor + g.goalsAgainst > leagueAvgTotal) overW++
  }

  const sorted = [...log].sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
  const last5 = sorted.slice(0, 5)
  const last5OverW = last5.filter((g) => g.goalsFor + g.goalsAgainst > leagueAvgTotal).length

  // Real DraftKings closing lines (from ESPN game summaries) replace the proxies whenever enough games have them.
  const real = await getRealLineRecords('nhl', abbr, NHL_CURRENT_SEASON % 10000)
  if (real) {
    return {
      moneyline: toLine(`${abbr} ML`, mlW, log.length - mlW),
      puckLine: toLine(`${abbr} Puck Line`, real.ats.wins, real.ats.losses),
      overUnder: toLine(`${abbr} O/U`, real.overUnder.over, real.overUnder.under),
      last5OverUnder: toLine(`${abbr} L5 O/U`, real.last5.overUnder.over, real.last5.overUnder.under),
      note: `Puck line and Over/Under use real DraftKings closing lines (${real.withLines} of ${real.games} games have a recorded line; pushes excluded).`,
    }
  }

  return {
    moneyline: toLine(`${abbr} ML`, mlW, log.length - mlW),
    puckLine: toLine(`${abbr} Puck Line`, plW, log.length - plW),
    overUnder: toLine(`${abbr} O/U`, overW, log.length - overW),
    last5OverUnder: toLine(`${abbr} L5 O/U`, last5OverW, last5.length - last5OverW),
    note: `The NHL API has no real betting-line data, so the puck line uses a proxy (won by ${PUCK_LINE_PROXY_MARGIN}+ goals) and Over/Under compares combined goals to a ${leagueAvgTotal.toFixed(1)}-goal league-average total — neither is a real posted line.`,
  }
}

export interface NHLSummaryTabData {
  away: NHLTeamSummaryCard | null
  home: NHLTeamSummaryCard | null
  awayBetting: NHLTeamBettingSummary | null
  homeBetting: NHLTeamBettingSummary | null
}

export async function getNHLSummaryTabData(gameId: string): Promise<NHLSummaryTabData | null> {
  const matchup = await getNHLGameMatchup(gameId)
  if (!matchup) return null

  const [away, home] = await Promise.all([getNHLTeamSummaryCard(matchup.away.abbr), getNHLTeamSummaryCard(matchup.home.abbr)])

  const leagueAvgTotal = (away?.offense.gpg ?? 3) + (home?.offense.gpg ?? 3)

  const [awayBetting, homeBetting] = await Promise.all([
    getNHLTeamBettingSummary(matchup.away.abbr, leagueAvgTotal),
    getNHLTeamBettingSummary(matchup.home.abbr, leagueAvgTotal),
  ])

  return { away, home, awayBetting, homeBetting }
}

export type { NHLTeamGameLogRow }
