import { getNFLDefenseStats, getNFLSchedule, getNFLWeeklyDefenseStats, getNFLWeeklyPlayerStats } from './api'
import { hitRatesForThresholds, type NFLThresholdHitRate } from './bettingStats'
import { normalizeNflAbbr } from './divisions'
import {
  getNFLDefenseTeamStats,
  getNFLGameMatchup,
  getNFLQBStatsByName,
  getNFLTopDefenders,
  type NFLDefenseTeamStats,
  type NFLTopDefender,
} from './gameBreakdown'
import { getNFLTeamBettingSummary } from './summaryBreakdown'

function n(v: string | undefined): number {
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : 0
}

export interface RankedStat {
  value: number
  rank: number
}

export interface NFLDefenseRanks {
  pointsAllowedPerGame: RankedStat | null
  passYdsAllowedPerGame: RankedStat | null
  rushYdsAllowedPerGame: RankedStat | null
  sacks: RankedStat | null
  turnoversForced: RankedStat | null
  interceptions: RankedStat | null
  tacklesForLoss: RankedStat | null
}

function rankMapAscending(values: Map<string, number>): Map<string, number> {
  const sorted = Array.from(values.entries()).sort((a, b) => a[1] - b[1])
  const rankMap = new Map<string, number>()
  sorted.forEach(([abbr], i) => rankMap.set(abbr, i + 1))
  return rankMap
}

function rankMapDescending(values: Map<string, number>): Map<string, number> {
  const sorted = Array.from(values.entries()).sort((a, b) => b[1] - a[1])
  const rankMap = new Map<string, number>()
  sorted.forEach(([abbr], i) => rankMap.set(abbr, i + 1))
  return rankMap
}

/**
 * Ranks every team's defense in ONE pass over the already-fetched league-wide CSVs (schedule +
 * weekly offense + season defense), rather than calling the per-team helpers 32 times — that
 * fan-out would trigger 32 concurrent re-downloads of the same multi-MB CSVs before the shared
 * cache has a chance to populate.
 */
export async function getNFLDefenseRanks(teamAbbr: string, season: number, stats: NFLDefenseTeamStats): Promise<NFLDefenseRanks> {
  const [schedule, weeklyOffense, defenseRows] = await Promise.all([
    getNFLSchedule(season),
    getNFLWeeklyPlayerStats(season),
    getNFLDefenseStats(season),
  ])
  if (!schedule) {
    return {
      pointsAllowedPerGame: null,
      passYdsAllowedPerGame: null,
      rushYdsAllowedPerGame: null,
      sacks: { value: stats.sacks, rank: 0 },
      turnoversForced: { value: stats.turnoversForcedPerGame, rank: 0 },
      interceptions: { value: stats.interceptions, rank: 0 },
      tacklesForLoss: { value: stats.tacklesForLoss, rank: 0 },
    }
  }

  const played = schedule.filter((r) => r.game_type === 'REG' && r.home_score !== '' && r.away_score !== '')
  const pointsAllowed = new Map<string, { total: number; games: number }>()
  const passAllowed = new Map<string, number>()
  const rushAllowed = new Map<string, number>()
  const gamesByTeam = new Map<string, number>()

  for (const g of played) {
    const home = normalizeNflAbbr(g.home_team)
    const away = normalizeNflAbbr(g.away_team)
    const homeScore = n(g.home_score)
    const awayScore = n(g.away_score)
    for (const [team, allowed] of [[home, awayScore], [away, homeScore]] as const) {
      const cur = pointsAllowed.get(team) ?? { total: 0, games: 0 }
      cur.total += allowed
      cur.games += 1
      pointsAllowed.set(team, cur)
      gamesByTeam.set(team, (gamesByTeam.get(team) ?? 0) + 1)
    }
  }

  for (const r of weeklyOffense ?? []) {
    const opp = normalizeNflAbbr(r.opponent_team)
    passAllowed.set(opp, (passAllowed.get(opp) ?? 0) + n(r.passing_yards))
    rushAllowed.set(opp, (rushAllowed.get(opp) ?? 0) + n(r.rushing_yards))
  }

  const pointsPerGame = new Map<string, number>()
  const passPerGame = new Map<string, number>()
  const rushPerGame = new Map<string, number>()
  for (const [team, gp] of Array.from(gamesByTeam.entries())) {
    const pts = pointsAllowed.get(team)
    if (pts) pointsPerGame.set(team, pts.total / gp)
    if (passAllowed.has(team)) passPerGame.set(team, (passAllowed.get(team) ?? 0) / gp)
    if (rushAllowed.has(team)) rushPerGame.set(team, (rushAllowed.get(team) ?? 0) / gp)
  }

  const ptsRank = rankMapAscending(pointsPerGame)
  const passRank = rankMapAscending(passPerGame)
  const rushRank = rankMapAscending(rushPerGame)

  const sacksByTeam = new Map<string, number>()
  const intByTeam = new Map<string, number>()
  const tflByTeam = new Map<string, number>()
  const toByTeam = new Map<string, number>()
  for (const r of defenseRows ?? []) {
    const team = normalizeNflAbbr(r.team)
    sacksByTeam.set(team, (sacksByTeam.get(team) ?? 0) + n(r.def_sacks))
    intByTeam.set(team, (intByTeam.get(team) ?? 0) + n(r.def_interceptions))
    tflByTeam.set(team, (tflByTeam.get(team) ?? 0) + n(r.def_tackles_for_loss))
    toByTeam.set(team, (toByTeam.get(team) ?? 0) + n(r.def_interceptions) + n(r.def_fumble_recovery_opp))
  }
  const sacksRank = rankMapDescending(sacksByTeam)
  const intRank = rankMapDescending(intByTeam)
  const tflRank = rankMapDescending(tflByTeam)
  const toRank = rankMapDescending(toByTeam)

  return {
    pointsAllowedPerGame: ptsRank.has(teamAbbr) ? { value: stats.pointsAllowedPerGame, rank: ptsRank.get(teamAbbr)! } : null,
    passYdsAllowedPerGame: passRank.has(teamAbbr) ? { value: stats.passYdsAllowedPerGame, rank: passRank.get(teamAbbr)! } : null,
    rushYdsAllowedPerGame: rushRank.has(teamAbbr) ? { value: stats.rushYdsAllowedPerGame, rank: rushRank.get(teamAbbr)! } : null,
    sacks: sacksRank.has(teamAbbr) ? { value: stats.sacks, rank: sacksRank.get(teamAbbr)! } : { value: stats.sacks, rank: 0 },
    turnoversForced: toRank.has(teamAbbr) ? { value: stats.turnoversForcedPerGame, rank: toRank.get(teamAbbr)! } : { value: stats.turnoversForcedPerGame, rank: 0 },
    interceptions: intRank.has(teamAbbr) ? { value: stats.interceptions, rank: intRank.get(teamAbbr)! } : { value: stats.interceptions, rank: 0 },
    tacklesForLoss: tflRank.has(teamAbbr) ? { value: stats.tacklesForLoss, rank: tflRank.get(teamAbbr)! } : { value: stats.tacklesForLoss, rank: 0 },
  }
}

export interface NFLDefenseLastGameRow {
  week: number
  opp: string
  ptsAllowed: number
  passYdsAllowed: number
  rushYdsAllowed: number
  sacks: number
  turnovers: number
}

async function getDefenseLast5(teamAbbr: string, season: number): Promise<NFLDefenseLastGameRow[]> {
  const [schedule, weeklyDefense] = await Promise.all([getNFLSchedule(season), getNFLWeeklyDefenseStats(season)])
  if (!schedule) return []

  const played = schedule
    .filter((r) => r.game_type === 'REG' && r.home_score !== '' && r.away_score !== '')
    .filter((r) => normalizeNflAbbr(r.home_team) === teamAbbr || normalizeNflAbbr(r.away_team) === teamAbbr)
    .sort((a, b) => Number(a.week) - Number(b.week))
    .slice(-5)
    .reverse()

  return played.map((g) => {
    const isHome = normalizeNflAbbr(g.home_team) === teamAbbr
    const oppAbbr = normalizeNflAbbr(isHome ? g.away_team : g.home_team)
    const ptsAllowed = isHome ? n(g.away_score) : n(g.home_score)
    const weekDefRows = (weeklyDefense ?? []).filter((r) => r.week === g.week && normalizeNflAbbr(r.team) === teamAbbr)
    const sacks = weekDefRows.reduce((s, r) => s + n(r.def_sacks), 0)
    const turnovers = weekDefRows.reduce((s, r) => s + n(r.def_interceptions) + n(r.def_fumble_recovery_opp), 0)
    return { week: n(g.week), opp: oppAbbr, ptsAllowed, passYdsAllowed: 0, rushYdsAllowed: 0, sacks, turnovers }
  })
}

export interface NFLKeyMatchup {
  title: string
  detail: string
}

async function getKeyMatchup(teamAbbr: string, opponentQbName: string | null, season: number, stats: NFLDefenseTeamStats): Promise<NFLKeyMatchup | null> {
  if (!opponentQbName) return null
  const qb = await getNFLQBStatsByName(opponentQbName, '', season)
  if (!qb) return null
  if (qb.season.rating > 100 && stats.passYdsAllowedPerGame >= 260) {
    return {
      title: 'Passing Attack vs Vulnerable Secondary',
      detail: `${qb.name} carries a ${qb.season.rating.toFixed(1)} passer rating into a ${teamAbbr} defense allowing ${stats.passYdsAllowedPerGame.toFixed(1)} pass yards per game.`,
    }
  }
  return null
}

export const DEF_SACKS_THRESHOLDS = [1.5, 2.5, 3.5, 4.5]
export const DEF_POINTS_ALLOWED_THRESHOLDS = [13.5, 16.5, 20.5, 23.5, 27.5]
export const DEF_TURNOVERS_THRESHOLDS = [0.5, 1.5, 2.5]

export interface NFLDefenseBetting {
  sacks: NFLThresholdHitRate[]
  pointsAllowed: NFLThresholdHitRate[]
  turnoversForced: NFLThresholdHitRate[]
  ats: { wins: number; losses: number; pct: number } | null
}

async function getDefenseBetting(teamAbbr: string, season: number): Promise<NFLDefenseBetting> {
  const [schedule, weeklyDefense, atsSummary] = await Promise.all([
    getNFLSchedule(season),
    getNFLWeeklyDefenseStats(season),
    getNFLTeamBettingSummary(teamAbbr, season),
  ])

  const played = (schedule ?? [])
    .filter((r) => r.game_type === 'REG' && r.home_score !== '' && r.away_score !== '')
    .filter((r) => normalizeNflAbbr(r.home_team) === teamAbbr || normalizeNflAbbr(r.away_team) === teamAbbr)

  const perGamePointsAllowed = played.map((g) => {
    const isHome = normalizeNflAbbr(g.home_team) === teamAbbr
    return { points_allowed: String(isHome ? n(g.away_score) : n(g.home_score)) }
  })

  const weeks = Array.from(new Set(played.map((g) => g.week)))
  const perGameDef = weeks.map((wk) => {
    const rows = (weeklyDefense ?? []).filter((r) => r.week === wk && normalizeNflAbbr(r.team) === teamAbbr)
    return {
      sacks: String(rows.reduce((s, r) => s + n(r.def_sacks), 0)),
      turnovers: String(rows.reduce((s, r) => s + n(r.def_interceptions) + n(r.def_fumble_recovery_opp), 0)),
    }
  })

  return {
    sacks: hitRatesForThresholds(perGameDef, 'sacks', DEF_SACKS_THRESHOLDS),
    pointsAllowed: hitRatesForThresholds(perGamePointsAllowed, 'points_allowed', DEF_POINTS_ALLOWED_THRESHOLDS),
    turnoversForced: hitRatesForThresholds(perGameDef, 'turnovers', DEF_TURNOVERS_THRESHOLDS),
    ats: atsSummary ? { wins: atsSummary.ats.wins, losses: atsSummary.ats.losses, pct: atsSummary.ats.pct } : null,
  }
}

export interface NFLDefenseTabData {
  stats: NFLDefenseTeamStats | null
  ranks: NFLDefenseRanks | null
  last5: NFLDefenseLastGameRow[]
  keyMatchup: NFLKeyMatchup | null
  topDefenders: NFLTopDefender[]
  betting: NFLDefenseBetting
}

export async function getNFLDefenseTabData(gameId: string, team: 'away' | 'home'): Promise<NFLDefenseTabData | null> {
  const matchup = await getNFLGameMatchup(gameId)
  if (!matchup) return null
  const teamAbbr = team === 'away' ? matchup.away.abbr : matchup.home.abbr
  const opponentQbName = team === 'away' ? matchup.home.qbName : matchup.away.qbName

  const stats = await getNFLDefenseTeamStats(teamAbbr, matchup.season)
  if (!stats) return { stats: null, ranks: null, last5: [], keyMatchup: null, topDefenders: [], betting: await getDefenseBetting(teamAbbr, matchup.season) }

  const [ranks, last5, keyMatchup, topDefenders, betting] = await Promise.all([
    getNFLDefenseRanks(teamAbbr, matchup.season, stats),
    getDefenseLast5(teamAbbr, matchup.season),
    getKeyMatchup(teamAbbr, opponentQbName, matchup.season, stats),
    getNFLTopDefenders(teamAbbr, matchup.season),
    getDefenseBetting(teamAbbr, matchup.season),
  ])

  return { stats, ranks, last5, keyMatchup, topDefenders, betting }
}
