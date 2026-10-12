import { getNBAGameMatchup } from './gameBreakdown'
import { getNBAStandings, getNBATeamGameLog, getNBATeamStats, type NBATeamGameLogRow, type NBAStandingsTeam, type NBATeamStats } from './api'
import { getRealLineRecords } from '@/lib/odds/history'
import { NBA_CURRENT_SEASON, nbaSeasonStartYear } from './divisions'

export interface NBALastGameRow {
  date: string
  opp: string
  result: 'W' | 'L'
  score: string
}

export interface NBATeamSummaryCard {
  abbr: string
  record: { wins: number; losses: number; pct: number }
  last10Dots: ('W' | 'L')[]
  offense: { ppg: number; fgPct: number; fg3Pct: number; ftPct: number; reb: number; ast: number; tov: number }
  defense: { oppPpg: number; oppFgPct: number; dreb: number; drtg: number | null }
  last5: NBALastGameRow[]
}

export async function getNBATeamSummaryCard(teamId: number, abbr: string): Promise<NBATeamSummaryCard | null> {
  const [stats, standing, log] = await Promise.all([
    getNBATeamStats(teamId),
    getNBAStandings().then((s) => s?.find((t) => t.teamId === teamId) ?? null),
    getNBATeamGameLog(teamId, NBA_CURRENT_SEASON),
  ])
  if (!stats) return null

  const sorted = [...(log ?? [])].sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
  const last10 = sorted.slice(0, 10).map((g) => (g.wl === 'W' ? 'W' : 'L') as 'W' | 'L').reverse()
  const last5: NBALastGameRow[] = sorted.slice(0, 5).map((g) => ({
    date: g.gameDate,
    opp: g.opponentAbbr,
    result: g.wl === 'W' ? 'W' : 'L',
    score: `${g.pts}-${g.oppPts}`,
  }))

  return {
    abbr,
    record: {
      wins: standing?.wins ?? stats.wins,
      losses: standing?.losses ?? stats.losses,
      pct: stats.wins + stats.losses > 0 ? Math.round((stats.wins / (stats.wins + stats.losses)) * 1000) / 10 : 0,
    },
    last10Dots: last10,
    offense: { ppg: stats.pts, fgPct: stats.fgPct, fg3Pct: stats.fg3Pct, ftPct: stats.ftPct, reb: stats.reb, ast: stats.ast, tov: stats.tov },
    defense: { oppPpg: stats.oppPts, oppFgPct: 0, dreb: 0, drtg: stats.defRtg },
    last5,
  }
}

export interface NBABettingLine {
  label: string
  wins: number
  losses: number
  pct: number
}

function toLine(label: string, wins: number, losses: number): NBABettingLine {
  const total = wins + losses
  return { label, wins, losses, pct: total > 0 ? Math.round((wins / total) * 1000) / 10 : 0 }
}

export interface NBATeamBettingSummary {
  moneyline: NBABettingLine
  ats: NBABettingLine
  overUnder: NBABettingLine
  last5OverUnder: NBABettingLine
  note: string
}

const ATS_PROXY_MARGIN = 5.5

export async function getNBATeamBettingSummary(teamId: number, abbr: string, leagueAvgTotal: number): Promise<NBATeamBettingSummary | null> {
  const log = await getNBATeamGameLog(teamId, NBA_CURRENT_SEASON)
  if (!log || log.length === 0) return null

  let mlW = 0
  let atsW = 0
  let overW = 0

  for (const g of log) {
    if (g.wl === 'W') mlW++
    if (g.pts - g.oppPts >= ATS_PROXY_MARGIN) atsW++
    if (g.pts + g.oppPts > leagueAvgTotal) overW++
  }

  const sorted = [...log].sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
  const last5 = sorted.slice(0, 5)
  const last5OverW = last5.filter((g) => g.pts + g.oppPts > leagueAvgTotal).length

  // Real DraftKings closing lines (from ESPN game summaries) replace the proxies whenever enough games have them.
  const real = await getRealLineRecords('nba', abbr, nbaSeasonStartYear(NBA_CURRENT_SEASON) + 1)
  if (real) {
    return {
      moneyline: toLine(`${abbr} ML`, mlW, log.length - mlW),
      ats: toLine(`${abbr} ATS`, real.ats.wins, real.ats.losses),
      overUnder: toLine(`${abbr} O/U`, real.overUnder.over, real.overUnder.under),
      last5OverUnder: toLine(`${abbr} L5 O/U`, real.last5.overUnder.over, real.last5.overUnder.under),
      note: `ATS and Over/Under use real DraftKings closing lines (${real.withLines} of ${real.games} games have a recorded line; pushes excluded).`,
    }
  }

  return {
    moneyline: toLine(`${abbr} ML`, mlW, log.length - mlW),
    ats: toLine(`${abbr} ATS`, atsW, log.length - atsW),
    overUnder: toLine(`${abbr} O/U`, overW, log.length - overW),
    last5OverUnder: toLine(`${abbr} L5 O/U`, last5OverW, last5.length - last5OverW),
    note: `stats.nba.com has no real betting-line data, so ATS uses a proxy (won by ${ATS_PROXY_MARGIN}+ points) and Over/Under compares combined points to a ${leagueAvgTotal.toFixed(1)}-point league-average total — neither is a real posted line.`,
  }
}

export interface NBASummaryTabData {
  away: NBATeamSummaryCard | null
  home: NBATeamSummaryCard | null
  awayBetting: NBATeamBettingSummary | null
  homeBetting: NBATeamBettingSummary | null
}

export async function getNBASummaryTabData(gameId: string): Promise<NBASummaryTabData | null> {
  const matchup = await getNBAGameMatchup(gameId)
  if (!matchup) return null

  const [away, home] = await Promise.all([
    getNBATeamSummaryCard(matchup.away.teamId, matchup.away.abbr),
    getNBATeamSummaryCard(matchup.home.teamId, matchup.home.abbr),
  ])

  const leagueAvgTotal = (away?.offense.ppg ?? 112) + (home?.offense.ppg ?? 112)

  const [awayBetting, homeBetting] = await Promise.all([
    getNBATeamBettingSummary(matchup.away.teamId, matchup.away.abbr, leagueAvgTotal),
    getNBATeamBettingSummary(matchup.home.teamId, matchup.home.abbr, leagueAvgTotal),
  ])

  return { away, home, awayBetting, homeBetting }
}

export type { NBATeamGameLogRow, NBAStandingsTeam, NBATeamStats }
