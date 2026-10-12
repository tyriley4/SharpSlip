import { getGameLinescore, getMlbTeamsIndex, getPlayerGameLog, getTeamScheduleResults, getTeamStats, type RawScheduleResultGame } from './api'
import { getGameMatchup, getTeamHittingContext, getTeamStandingsRecord } from './gameBreakdown'
import { getRealLineRecords } from '@/lib/odds/history'

interface TeamGameResult {
  date: string
  gamePk: number
  opp: string
  runsFor: number
  runsAgainst: number
  win: boolean
  starterName: string | null
  starterId: number | null
}

function resultsForTeam(teamId: number, games: RawScheduleResultGame[], teamAbbrById: Map<number, { abbr: string }> | null): TeamGameResult[] {
  return games
    .filter((g) => g.status.abstractGameState === 'Final')
    .map((g) => {
      const isHome = g.teams.home.team.id === teamId
      const mine = isHome ? g.teams.home : g.teams.away
      const opp = isHome ? g.teams.away : g.teams.home
      return {
        date: g.officialDate,
        gamePk: g.gamePk,
        opp: teamAbbrById?.get(opp.team.id)?.abbr ?? opp.team.name.slice(0, 3).toUpperCase(),
        runsFor: mine.score ?? 0,
        runsAgainst: opp.score ?? 0,
        win: Boolean(mine.isWinner),
        starterName: mine.probablePitcher?.fullName ?? null,
        starterId: mine.probablePitcher?.id ?? null,
      }
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

// ---------------------------------------------------------------------------
// Game stats
// ---------------------------------------------------------------------------

export interface TeamDefenseContext {
  era: number
  whip: number
  k9: number
  bb9: number
  hrAllowed: number
}

async function getTeamDefenseContext(teamId: number): Promise<TeamDefenseContext | null> {
  const stats = await getTeamStats('pitching')
  const line = stats?.find((s) => s.team.id === teamId)
  if (!line) return null
  const stat = line.stat
  return {
    era: Number(stat.era ?? 0),
    whip: Number(stat.whip ?? 0),
    k9: Number(stat.strikeoutsPer9Inn ?? 0),
    bb9: Number(stat.walksPer9Inn ?? 0),
    hrAllowed: Number(stat.homeRuns ?? 0),
  }
}

export interface RecentGameRow {
  date: string
  opp: string
  result: 'W' | 'L'
  score: string
  sp: string | null
  spEra: number | null
}

async function starterEraForGame(starterId: number, date: string): Promise<number | null> {
  const log = await getPlayerGameLog(starterId, 'pitching')
  const entry = log?.find((g) => g.date === date)
  if (!entry) return null
  const outs = Number(entry.stat.outs ?? 0)
  const er = Number(entry.stat.earnedRuns ?? 0)
  return outs > 0 ? Math.round(((9 * er) / (outs / 3)) * 100) / 100 : null
}

export interface TeamSummaryCard {
  abbr: string
  record: { wins: number; losses: number; pct: number }
  homeRecord: { wins: number; losses: number } | null
  awayRecord: { wins: number; losses: number } | null
  last10Dots: ('W' | 'L')[]
  offense: { runsPerGame: number; avg: string; obp: string; slg: string; hr: number; kPct: number }
  defense: TeamDefenseContext | null
  last5: RecentGameRow[]
}

export async function getTeamSummaryCard(teamId: number, abbr: string, teamAbbrById: Map<number, { abbr: string }> | null): Promise<TeamSummaryCard | null> {
  const [games, standings, hitting, defense] = await Promise.all([
    getTeamScheduleResults(teamId),
    getTeamStandingsRecord(teamId),
    getTeamHittingContext(teamId),
    getTeamDefenseContext(teamId),
  ])
  if (!standings) return null

  const results = resultsForTeam(teamId, games ?? [], teamAbbrById)
  const last10 = results.slice(0, 10)
  const last5 = results.slice(0, 5)

  const last5Rows = await Promise.all(
    last5.map(async (g): Promise<RecentGameRow> => {
      const spEra = g.starterId ? await starterEraForGame(g.starterId, g.date) : null
      return {
        date: g.date,
        opp: g.opp,
        result: g.win ? 'W' : 'L',
        score: `${g.runsFor}-${g.runsAgainst}`,
        sp: g.starterName,
        spEra,
      }
    })
  )

  return {
    abbr,
    record: { wins: standings.wins, losses: standings.losses, pct: standings.wins + standings.losses > 0 ? Math.round((standings.wins / (standings.wins + standings.losses)) * 1000) / 10 : 0 },
    homeRecord: { wins: standings.homeWins, losses: standings.homeLosses },
    awayRecord: { wins: standings.awayWins, losses: standings.awayLosses },
    last10Dots: last10.map((g) => (g.win ? 'W' : 'L')).reverse(),
    offense: {
      runsPerGame: hitting?.runsPerGame ?? 0,
      avg: hitting?.avg ?? '—',
      obp: hitting?.obp ?? '—',
      slg: hitting?.slg ?? '—',
      hr: hitting?.hr ?? 0,
      kPct: hitting?.kPct ?? 0,
    },
    defense,
    last5: last5Rows,
  }
}

// ---------------------------------------------------------------------------
// Betting stats — all derived from real final scores. Full-game totals and F5 totals use a
// league-average-runs proxy since the free Stats API has no real posted betting totals.
// ---------------------------------------------------------------------------

export interface BettingRecordLine {
  label: string
  wins: number
  losses: number
  pct: number
}

function toRecordLine(label: string, wins: number, losses: number): BettingRecordLine {
  const total = wins + losses
  return { label, wins, losses, pct: total > 0 ? Math.round((wins / total) * 1000) / 10 : 0 }
}

export interface TeamBettingSummary {
  moneyline: BettingRecordLine
  runLine: BettingRecordLine
  overUnder: BettingRecordLine
  last10OverUnder: BettingRecordLine
  f5OverUnder: BettingRecordLine
  note: string
}

export async function getTeamBettingSummary(
  teamId: number,
  abbr: string,
  leagueAvgTotal: number,
  teamAbbrById: Map<number, { abbr: string }> | null
): Promise<TeamBettingSummary | null> {
  const games = await getTeamScheduleResults(teamId)
  if (!games) return null
  const results = resultsForTeam(teamId, games, teamAbbrById)
  if (results.length === 0) return null

  const mlWins = results.filter((g) => g.win).length
  const rlWins = results.filter((g) => g.runsFor - g.runsAgainst >= 2).length
  const overs = results.filter((g) => g.runsFor + g.runsAgainst > leagueAvgTotal).length

  const last10 = results.slice(0, 10)
  const last10Overs = last10.filter((g) => g.runsFor + g.runsAgainst > leagueAvgTotal).length

  const f5Games = results.slice(0, 10).filter((g) => g.gamePk)
  const f5Results = await Promise.all(
    f5Games.map(async (g) => {
      const linescore = await getGameLinescore(g.gamePk)
      const first5 = (linescore?.innings ?? []).filter((i) => i.num <= 5)
      const total = first5.reduce((s, i) => s + (i.home?.runs ?? 0) + (i.away?.runs ?? 0), 0)
      return total
    })
  )
  const f5Threshold = leagueAvgTotal * (5 / 9)
  const f5Overs = f5Results.filter((r) => r > f5Threshold).length

  // Real DraftKings closing lines (from ESPN game summaries) replace the proxies whenever enough games have them.
  const real = await getRealLineRecords('mlb', abbr, new Date().getUTCFullYear())
  if (real) {
    return {
      moneyline: toRecordLine(`${abbr} ML`, mlWins, results.length - mlWins),
      runLine: toRecordLine(`${abbr} Run Line`, real.ats.wins, real.ats.losses),
      overUnder: toRecordLine(`${abbr} O/U`, real.overUnder.over, real.overUnder.under),
      last10OverUnder: toRecordLine(`${abbr} L10 O/U`, real.last10.overUnder.over, real.last10.overUnder.under),
      f5OverUnder: toRecordLine(`${abbr} F5 O/U`, f5Overs, f5Results.length - f5Overs),
      note: `Run line and Over/Under use real DraftKings closing lines (${real.withLines} of ${real.games} games have a recorded line; pushes excluded). F5 O/U still compares the last ${f5Results.length} games' first-five runs to a ${f5Threshold.toFixed(1)}-run estimate — no first-five line is available.`,
    }
  }

  return {
    moneyline: toRecordLine(`${abbr} ML`, mlWins, results.length - mlWins),
    runLine: toRecordLine(`${abbr} RL -1.5`, rlWins, results.length - rlWins),
    overUnder: toRecordLine(`${abbr} O/U`, overs, results.length - overs),
    last10OverUnder: toRecordLine(`${abbr} L10 O/U`, last10Overs, last10.length - last10Overs),
    f5OverUnder: toRecordLine(`${abbr} F5 O/U`, f5Overs, f5Results.length - f5Overs),
    note: `Run Line and Over/Under are derived from real final scores (RL: won by 2+ runs; O/U: vs a ${leagueAvgTotal.toFixed(1)}-run league-average total) — no real betting-line data is available from the free MLB Stats API. F5 sample is the last ${f5Results.length} games.`,
  }
}

// ---------------------------------------------------------------------------
// Full Summary-tab aggregator
// ---------------------------------------------------------------------------

export interface SummaryTabData {
  away: TeamSummaryCard | null
  home: TeamSummaryCard | null
  awayBetting: TeamBettingSummary | null
  homeBetting: TeamBettingSummary | null
}

export async function getSummaryTabData(gamePk: number): Promise<SummaryTabData | null> {
  const matchup = await getGameMatchup(gamePk)
  if (!matchup) return null

  const teams = await getMlbTeamsIndex()

  const [away, home] = await Promise.all([
    getTeamSummaryCard(matchup.away.id, matchup.away.abbr, teams),
    getTeamSummaryCard(matchup.home.id, matchup.home.abbr, teams),
  ])

  const leagueAvgTotal = (away?.offense.runsPerGame ?? 4.3) + (home?.offense.runsPerGame ?? 4.3)

  const [awayBetting, homeBetting] = await Promise.all([
    getTeamBettingSummary(matchup.away.id, matchup.away.abbr, leagueAvgTotal, teams),
    getTeamBettingSummary(matchup.home.id, matchup.home.abbr, leagueAvgTotal, teams),
  ])

  return { away, home, awayBetting, homeBetting }
}
