import type { Edge } from '@/data/breakdown/types'
import {
  getNFLAdvancedStats,
  getNFLStatsSeason,
  getNFLDefenseStats,
  getNFLPlayerStats,
  getNFLSchedule,
  getNFLWeeklyDefenseStats,
  getNFLWeeklyPlayerStats,
  getActiveNFLSeason,
} from './api'
import { generateNFLEdges, type EdgeQBInput, type EdgeTeamInput, type NFLEdgeContext } from './edgeEngine'
import { normalizeNflAbbr, NFL_TEAM_NAMES } from './divisions'

function n(v: string | undefined): number {
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : 0
}

export function passerRating(comp: number, att: number, yds: number, td: number, int: number): number {
  if (att === 0) return 0
  const a = Math.max(0, Math.min(2.375, (comp / att - 0.3) * 5))
  const b = Math.max(0, Math.min(2.375, (yds / att - 3) * 0.25))
  const c = Math.max(0, Math.min(2.375, (td / att) * 20))
  const d = Math.max(0, Math.min(2.375, 2.375 - (int / att) * 25))
  return ((a + b + c + d) / 6) * 100
}

// ---------------------------------------------------------------------------
// Game matchup
// ---------------------------------------------------------------------------

export type NFLGameStatus = 'Pregame' | 'Live' | 'Final'

export interface NFLGameMatchup {
  gameId: string
  season: number
  week: number
  seasonType: string
  gameday: string
  gametime: string
  status: NFLGameStatus
  away: { abbr: string; name: string; score: number | null; qbId: string | null; qbName: string | null }
  home: { abbr: string; name: string; score: number | null; qbId: string | null; qbName: string | null }
  venue: { stadium: string; stadiumId: string; roof: string; surface: string; temp: string; wind: string }
  spreadLine: number | null
  totalLine: number | null
  divGame: boolean
}

export async function getNFLGameMatchup(gameId: string): Promise<NFLGameMatchup | null> {
  const seasonPart = Number(gameId.split('_')[0])
  const season = Number.isInteger(seasonPart) ? seasonPart : await getActiveNFLSeason()

  const rows = await getNFLSchedule(season)
  const row = rows?.find((r) => r.game_id === gameId)
  if (!row) return null

  const hasScore = row.home_score !== '' && row.away_score !== ''
  let status: NFLGameStatus = 'Pregame'
  if (hasScore) {
    status = 'Final'
  } else if (row.gameday) {
    const kickoff = new Date(`${row.gameday}T${row.gametime || '13:00'}:00`)
    if (Date.now() >= kickoff.getTime() + 3.5 * 60 * 60 * 1000) status = 'Final' // best-effort: nflverse hasn't posted the score yet
    else if (Date.now() >= kickoff.getTime()) status = 'Live'
  }

  const awayAbbr = normalizeNflAbbr(row.away_team)
  const homeAbbr = normalizeNflAbbr(row.home_team)

  return {
    gameId,
    season,
    week: n(row.week),
    seasonType: row.game_type,
    gameday: row.gameday,
    gametime: row.gametime,
    status,
    away: {
      abbr: awayAbbr,
      name: NFL_TEAM_NAMES[awayAbbr] ?? awayAbbr,
      score: hasScore ? n(row.away_score) : null,
      qbId: row.away_qb_id || null,
      qbName: row.away_qb_name || null,
    },
    home: {
      abbr: homeAbbr,
      name: NFL_TEAM_NAMES[homeAbbr] ?? homeAbbr,
      score: hasScore ? n(row.home_score) : null,
      qbId: row.home_qb_id || null,
      qbName: row.home_qb_name || null,
    },
    venue: {
      stadium: row.stadium || '—',
      stadiumId: row.stadium_id || '',
      roof: row.roof || 'outdoors',
      surface: row.surface || '—',
      temp: row.temp || '',
      wind: row.wind || '',
    },
    spreadLine: row.spread_line ? Number(row.spread_line) : null,
    totalLine: row.total_line ? Number(row.total_line) : null,
    divGame: row.div_game === '1',
  }
}

// ---------------------------------------------------------------------------
// Team offense/defense season stats
// ---------------------------------------------------------------------------

export interface NFLTeamStats {
  abbr: string
  gamesPlayed: number
  pointsPerGame: number
  pointsAllowedPerGame: number
  passYdsPerGame: number
  rushYdsPerGame: number
  passYdsAllowedPerGame: number
  rushYdsAllowedPerGame: number
  turnoversPerGame: number
  turnoversForcedPerGame: number
  sacks: number
  wins: number
  losses: number
  ties: number
}

/** Real team offense/defense season aggregates, derived from schedule results + player_stats sums. 3rd-down% and red-zone% aren't included — they require full play-by-play parsing, which isn't practical from these season-summary CSV releases. */
export async function getNFLTeamStats(teamAbbr: string, season: number): Promise<NFLTeamStats | null> {
  const [schedule, offenseRows, defenseRows, yardsAllowed] = await Promise.all([
    getNFLSchedule(season),
    getNFLPlayerStats(season),
    getNFLDefenseStats(season),
    getNFLYardsAllowed(teamAbbr, season),
  ])
  if (!schedule) return null

  const played = schedule.filter((r) => r.game_type === 'REG' && r.home_score !== '' && r.away_score !== '')
  const teamGames = played.filter((r) => normalizeNflAbbr(r.home_team) === teamAbbr || normalizeNflAbbr(r.away_team) === teamAbbr)
  if (teamGames.length === 0) return null

  let pointsFor = 0
  let pointsAgainst = 0
  let wins = 0
  let losses = 0
  let ties = 0
  for (const g of teamGames) {
    const isHome = normalizeNflAbbr(g.home_team) === teamAbbr
    const my = isHome ? n(g.home_score) : n(g.away_score)
    const opp = isHome ? n(g.away_score) : n(g.home_score)
    pointsFor += my
    pointsAgainst += opp
    if (my > opp) wins++
    else if (my < opp) losses++
    else ties++
  }

  const gamesPlayed = teamGames.length
  const teamOffense = (offenseRows ?? []).filter((r) => normalizeNflAbbr(r.recent_team) === teamAbbr)
  const passYds = teamOffense.reduce((s, r) => s + n(r.passing_yards), 0)
  const rushYds = teamOffense.reduce((s, r) => s + n(r.rushing_yards), 0)
  const turnovers = teamOffense.reduce((s, r) => s + n(r.interceptions) + n(r.rushing_fumbles_lost) + n(r.receiving_fumbles_lost) + n(r.sack_fumbles_lost), 0)

  const teamDefense = (defenseRows ?? []).filter((r) => normalizeNflAbbr(r.team) === teamAbbr)
  const sacks = teamDefense.reduce((s, r) => s + n(r.def_sacks), 0)
  const turnoversForced = teamDefense.reduce((s, r) => s + n(r.def_interceptions) + n(r.def_fumble_recovery_opp), 0)

  return {
    abbr: teamAbbr,
    gamesPlayed,
    pointsPerGame: Math.round((pointsFor / gamesPlayed) * 10) / 10,
    pointsAllowedPerGame: Math.round((pointsAgainst / gamesPlayed) * 10) / 10,
    passYdsPerGame: Math.round((passYds / gamesPlayed) * 10) / 10,
    rushYdsPerGame: Math.round((rushYds / gamesPlayed) * 10) / 10,
    passYdsAllowedPerGame: yardsAllowed?.passAllowedPerGame ?? 0,
    rushYdsAllowedPerGame: yardsAllowed?.rushAllowedPerGame ?? 0,
    turnoversPerGame: Math.round((turnovers / gamesPlayed) * 100) / 100,
    turnoversForcedPerGame: Math.round((turnoversForced / gamesPlayed) * 100) / 100,
    sacks,
    wins,
    losses,
    ties,
  }
}

/** Yards allowed per game, computed properly from each week's opposing-offense output. */
export async function getNFLYardsAllowed(teamAbbr: string, season: number): Promise<{ passAllowedPerGame: number; rushAllowedPerGame: number } | null> {
  const [schedule, weeklyOffense] = await Promise.all([getNFLSchedule(season), getNFLWeeklyPlayerStats(season)])
  if (!schedule || !weeklyOffense) return null

  const played = schedule.filter((r) => r.game_type === 'REG' && r.home_score !== '' && r.away_score !== '' && (normalizeNflAbbr(r.home_team) === teamAbbr || normalizeNflAbbr(r.away_team) === teamAbbr))
  if (played.length === 0) return null

  let passAllowed = 0
  let rushAllowed = 0
  for (const g of played) {
    const isHome = normalizeNflAbbr(g.home_team) === teamAbbr
    const oppAbbr = normalizeNflAbbr(isHome ? g.away_team : g.home_team)
    const week = g.week
    const oppRows = weeklyOffense.filter((r) => r.week === week && normalizeNflAbbr(r.recent_team) === oppAbbr)
    passAllowed += oppRows.reduce((s, r) => s + n(r.passing_yards), 0)
    rushAllowed += oppRows.reduce((s, r) => s + n(r.rushing_yards), 0)
  }

  return {
    passAllowedPerGame: Math.round((passAllowed / played.length) * 10) / 10,
    rushAllowedPerGame: Math.round((rushAllowed / played.length) * 10) / 10,
  }
}

// ---------------------------------------------------------------------------
// QB stats
// ---------------------------------------------------------------------------

export interface NFLLastGameQB {
  week: number
  opp: string
  comp: number
  att: number
  yds: number
  td: number
  int: number
  rating: number
  result: 'W' | 'L' | 'T' | null
}

export interface NFLQBStats {
  playerId: string
  name: string
  team: string
  season: {
    comp: number
    att: number
    yds: number
    td: number
    int: number
    rating: number
    compPct: number
    rushYds: number
    rushTd: number
    sacks: number
  }
  gamesPlayed: number
  last3RatingAvg: number | null
  hot: boolean
  cold: boolean
  last5: NFLLastGameQB[]
}

export async function getNFLQBStatsByName(playerName: string, team: string, season: number): Promise<NFLQBStats | null> {
  const [seasonRows, weeklyRows, schedule] = await Promise.all([
    getNFLPlayerStats(season),
    getNFLWeeklyPlayerStats(season),
    getNFLSchedule(season),
  ])
  if (!seasonRows || !weeklyRows) return null

  const seasonRow = seasonRows.find((r) => (r.player_display_name === playerName || r.player_name === playerName) && r.position === 'QB')
  if (!seasonRow) return null

  const comp = n(seasonRow.completions)
  const att = n(seasonRow.attempts)
  const yds = n(seasonRow.passing_yards)
  const td = n(seasonRow.passing_tds)
  const int = n(seasonRow.interceptions)

  // A season row with a negligible attempt count (e.g. an emergency/trick-play appearance) isn't
  // a meaningful QB sample — treat it the same as "not found" rather than showing a misleading
  // all-zeros stat line.
  if (att < 10) return null

  const weekly = weeklyRows
    .filter((r) => r.player_id === seasonRow.player_id && n(r.attempts) > 0)
    .sort((a, b) => Number(b.week) - Number(a.week))

  const played = (schedule ?? []).filter((r) => r.game_type === 'REG' && r.home_score !== '' && r.away_score !== '')
  const resultForWeek = (week: string, oppAbbr: string): 'W' | 'L' | 'T' | null => {
    const g = played.find((r) => r.week === week && (normalizeNflAbbr(r.away_team) === oppAbbr || normalizeNflAbbr(r.home_team) === oppAbbr) && (normalizeNflAbbr(r.home_team) === team || normalizeNflAbbr(r.away_team) === team))
    if (!g) return null
    const isHome = normalizeNflAbbr(g.home_team) === team
    const my = isHome ? n(g.home_score) : n(g.away_score)
    const opp = isHome ? n(g.away_score) : n(g.home_score)
    return my > opp ? 'W' : my < opp ? 'L' : 'T'
  }

  const last5: NFLLastGameQB[] = weekly.slice(0, 5).map((r) => {
    const rating = passerRating(n(r.completions), n(r.attempts), n(r.passing_yards), n(r.passing_tds), n(r.interceptions))
    return {
      week: n(r.week),
      opp: normalizeNflAbbr(r.opponent_team),
      comp: n(r.completions),
      att: n(r.attempts),
      yds: n(r.passing_yards),
      td: n(r.passing_tds),
      int: n(r.interceptions),
      rating: Math.round(rating * 10) / 10,
      result: resultForWeek(r.week, normalizeNflAbbr(r.opponent_team)),
    }
  })

  const seasonRating = passerRating(comp, att, yds, td, int)
  const last3 = last5.slice(0, 3)
  const last3RatingAvg = last3.length >= 3 ? Math.round((last3.reduce((s, g) => s + g.rating, 0) / last3.length) * 10) / 10 : null

  return {
    playerId: seasonRow.player_id,
    name: seasonRow.player_display_name || seasonRow.player_name,
    team,
    season: {
      comp,
      att,
      yds,
      td,
      int,
      rating: Math.round(seasonRating * 10) / 10,
      compPct: att > 0 ? Math.round((comp / att) * 1000) / 10 : 0,
      rushYds: n(seasonRow.rushing_yards),
      rushTd: n(seasonRow.rushing_tds),
      sacks: n(seasonRow.sacks),
    },
    gamesPlayed: weekly.length,
    last3RatingAvg,
    hot: last3RatingAvg !== null && last3RatingAvg > seasonRating + 10,
    cold: last3RatingAvg !== null && last3RatingAvg < seasonRating - 10,
    last5,
  }
}

// ---------------------------------------------------------------------------
// Skill-position (RB/WR/TE) stats
// ---------------------------------------------------------------------------

export interface NFLLastGameSkill {
  week: number
  opp: string
  att: number
  rushYds: number
  rushTd: number
  targets: number
  rec: number
  recYds: number
  recTd: number
}

export interface NFLSkillPlayerStats {
  playerId: string
  name: string
  position: string
  team: string
  season: {
    att: number
    rushYds: number
    rushTd: number
    ypc: number
    targets: number
    rec: number
    recYds: number
    recTd: number
    targetShare: number
    airYardsShare: number
  }
  last5: NFLLastGameSkill[]
}

export async function getNFLTeamSkillPlayers(teamAbbr: string, season: number, position: 'RB' | 'WR' | 'TE'): Promise<NFLSkillPlayerStats[]> {
  const [seasonRows, weeklyRows] = await Promise.all([getNFLPlayerStats(season), getNFLWeeklyPlayerStats(season)])
  if (!seasonRows) return []

  const pool = seasonRows
    .filter((r) => normalizeNflAbbr(r.recent_team) === teamAbbr && r.position === position)
    .filter((r) => (position === 'RB' ? n(r.carries) >= 15 : n(r.targets) >= 10))
    .sort((a, b) => (position === 'RB' ? n(b.rushing_yards) - n(a.rushing_yards) : n(b.receiving_yards) - n(a.receiving_yards)))
    .slice(0, 3)

  return pool.map((r) => {
    const weekly = (weeklyRows ?? [])
      .filter((w) => w.player_id === r.player_id)
      .sort((a, b) => Number(b.week) - Number(a.week))
      .slice(0, 5)
      .map((w) => ({
        week: n(w.week),
        opp: normalizeNflAbbr(w.opponent_team),
        att: n(w.carries),
        rushYds: n(w.rushing_yards),
        rushTd: n(w.rushing_tds),
        targets: n(w.targets),
        rec: n(w.receptions),
        recYds: n(w.receiving_yards),
        recTd: n(w.receiving_tds),
      }))

    return {
      playerId: r.player_id,
      name: r.player_display_name || r.player_name,
      position: r.position,
      team: teamAbbr,
      season: {
        att: n(r.carries),
        rushYds: n(r.rushing_yards),
        rushTd: n(r.rushing_tds),
        ypc: n(r.carries) > 0 ? Math.round((n(r.rushing_yards) / n(r.carries)) * 10) / 10 : 0,
        targets: n(r.targets),
        rec: n(r.receptions),
        recYds: n(r.receiving_yards),
        recTd: n(r.receiving_tds),
        targetShare: Math.round(n(r.target_share) * 1000) / 10,
        airYardsShare: Math.round(n(r.air_yards_share) * 1000) / 10,
      },
      last5: weekly,
    }
  })
}

// ---------------------------------------------------------------------------
// Defense team stats
// ---------------------------------------------------------------------------

export interface NFLDefenseTeamStats {
  abbr: string
  pointsAllowedPerGame: number
  passYdsAllowedPerGame: number
  rushYdsAllowedPerGame: number
  sacks: number
  interceptions: number
  tackles: number
  passesDefended: number
  forcedFumbles: number
  tacklesForLoss: number
  turnoversForcedPerGame: number
}

export async function getNFLDefenseTeamStats(teamAbbr: string, season: number): Promise<NFLDefenseTeamStats | null> {
  const [defenseRows, yardsAllowed, teamStats] = await Promise.all([
    getNFLDefenseStats(season),
    getNFLYardsAllowed(teamAbbr, season),
    getNFLTeamStats(teamAbbr, season),
  ])
  if (!defenseRows || !teamStats) return null

  const teamDefense = defenseRows.filter((r) => normalizeNflAbbr(r.team) === teamAbbr)
  const sacks = teamDefense.reduce((s, r) => s + n(r.def_sacks), 0)
  const interceptions = teamDefense.reduce((s, r) => s + n(r.def_interceptions), 0)
  const tackles = teamDefense.reduce((s, r) => s + n(r.def_tackles), 0)
  const passesDefended = teamDefense.reduce((s, r) => s + n(r.def_pass_defended), 0)
  const forcedFumbles = teamDefense.reduce((s, r) => s + n(r.def_fumbles_forced), 0)
  const tacklesForLoss = teamDefense.reduce((s, r) => s + n(r.def_tackles_for_loss), 0)
  const turnoversForced = interceptions + teamDefense.reduce((s, r) => s + n(r.def_fumble_recovery_opp), 0)

  return {
    abbr: teamAbbr,
    pointsAllowedPerGame: teamStats.pointsAllowedPerGame,
    passYdsAllowedPerGame: yardsAllowed?.passAllowedPerGame ?? 0,
    rushYdsAllowedPerGame: yardsAllowed?.rushAllowedPerGame ?? 0,
    sacks,
    interceptions,
    tackles,
    passesDefended,
    forcedFumbles,
    tacklesForLoss,
    turnoversForcedPerGame: teamStats.gamesPlayed > 0 ? Math.round((turnoversForced / teamStats.gamesPlayed) * 100) / 100 : 0,
  }
}

export interface NFLTopDefender {
  name: string
  position: string
  sacks: number
  interceptions: number
}

export async function getNFLTopDefenders(teamAbbr: string, season: number, limit = 3): Promise<NFLTopDefender[]> {
  const rows = await getNFLDefenseStats(season)
  if (!rows) return []
  return rows
    .filter((r) => normalizeNflAbbr(r.team) === teamAbbr)
    .map((r) => ({
      name: r.player_display_name || r.player_name,
      position: r.position,
      sacks: n(r.def_sacks),
      interceptions: n(r.def_interceptions),
    }))
    .sort((a, b) => b.sacks + b.interceptions * 1.5 - (a.sacks + a.interceptions * 1.5))
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// Win% splits (home/away, last 5) — shared by the edge engine and trends
// ---------------------------------------------------------------------------

export interface NFLWinSplits {
  homeWinPct: number | null
  awayWinPct: number | null
  last5Wins: number
  last5Losses: number
}

export async function getNFLWinSplits(teamAbbr: string, season: number): Promise<NFLWinSplits> {
  const schedule = await getNFLSchedule(season)
  if (!schedule) return { homeWinPct: null, awayWinPct: null, last5Wins: 0, last5Losses: 0 }

  const played = schedule
    .filter((r) => r.game_type === 'REG' && r.home_score !== '' && r.away_score !== '')
    .filter((r) => normalizeNflAbbr(r.home_team) === teamAbbr || normalizeNflAbbr(r.away_team) === teamAbbr)
    .sort((a, b) => Number(a.week) - Number(b.week))

  let homeW = 0
  let homeL = 0
  let awayW = 0
  let awayL = 0
  for (const g of played) {
    const isHome = normalizeNflAbbr(g.home_team) === teamAbbr
    const my = isHome ? n(g.home_score) : n(g.away_score)
    const opp = isHome ? n(g.away_score) : n(g.home_score)
    if (my === opp) continue
    const won = my > opp
    if (isHome) won ? homeW++ : homeL++
    else won ? awayW++ : awayL++
  }

  const last5 = played.slice(-5)
  let last5Wins = 0
  let last5Losses = 0
  for (const g of last5) {
    const isHome = normalizeNflAbbr(g.home_team) === teamAbbr
    const my = isHome ? n(g.home_score) : n(g.away_score)
    const opp = isHome ? n(g.away_score) : n(g.home_score)
    if (my > opp) last5Wins++
    else if (my < opp) last5Losses++
  }

  return {
    homeWinPct: homeW + homeL > 0 ? Math.round((homeW / (homeW + homeL)) * 1000) / 10 : null,
    awayWinPct: awayW + awayL > 0 ? Math.round((awayW / (awayW + awayL)) * 1000) / 10 : null,
    last5Wins,
    last5Losses,
  }
}

/** Completion% this team's pass defense has allowed this season (from opposing QBs' weekly output). */
async function getSecondaryCompPctAllowed(teamAbbr: string, season: number): Promise<number | null> {
  const weekly = await getNFLWeeklyPlayerStats(season)
  if (!weekly) return null
  const facedRows = weekly.filter((r) => normalizeNflAbbr(r.opponent_team) === teamAbbr && r.position === 'QB')
  const comp = facedRows.reduce((s, r) => s + n(r.completions), 0)
  const att = facedRows.reduce((s, r) => s + n(r.attempts), 0)
  return att > 0 ? Math.round((comp / att) * 1000) / 10 : null
}

async function getQBCpoe(playerName: string, season: number): Promise<number | null> {
  const rows = await getNFLAdvancedStats('passing', season)
  const row = rows?.find((r) => r.player_display_name === playerName)
  return row ? Number(row.completion_percentage_above_expectation) : null
}

// ---------------------------------------------------------------------------
// Full Analysis-tab aggregator
// ---------------------------------------------------------------------------

export interface NFLAnalysisData {
  matchup: NFLGameMatchup
  /** Season the player-stat files actually resolved to; differs from matchup.season while that season's stats aren't published yet. */
  statsSeason: number | null
  awayQB: NFLQBStats | null
  homeQB: NFLQBStats | null
  edges: Edge[]
  contextStats: { label: string; val: string; good: boolean }[]
}

export async function getNFLAnalysisData(gameId: string): Promise<NFLAnalysisData | null> {
  const matchup = await getNFLGameMatchup(gameId)
  if (!matchup) return null

  const season = matchup.season

  const [awayTeamStats, homeTeamStats, awayWin, homeWin] = await Promise.all([
    getNFLTeamStats(matchup.away.abbr, season),
    getNFLTeamStats(matchup.home.abbr, season),
    getNFLWinSplits(matchup.away.abbr, season),
    getNFLWinSplits(matchup.home.abbr, season),
  ])

  const [awayQB, homeQB] = await Promise.all([
    matchup.away.qbName ? getNFLQBStatsByName(matchup.away.qbName, matchup.away.abbr, season) : Promise.resolve(null),
    matchup.home.qbName ? getNFLQBStatsByName(matchup.home.qbName, matchup.home.abbr, season) : Promise.resolve(null),
  ])

  const [awaySecCompAllowed, homeSecCompAllowed, awayCpoe, homeCpoe] = await Promise.all([
    getSecondaryCompPctAllowed(matchup.away.abbr, season),
    getSecondaryCompPctAllowed(matchup.home.abbr, season),
    awayQB ? getQBCpoe(awayQB.name, season) : Promise.resolve(null),
    homeQB ? getQBCpoe(homeQB.name, season) : Promise.resolve(null),
  ])

  function toEdgeTeam(abbr: string, stats: NFLTeamStats | null, win: NFLWinSplits, secCompAllowed: number | null): EdgeTeamInput {
    return {
      abbr,
      pointsPerGame: stats?.pointsPerGame ?? 0,
      pointsAllowedPerGame: stats?.pointsAllowedPerGame ?? 0,
      passYdsPerGame: stats?.passYdsPerGame ?? 0,
      rushYdsPerGame: stats?.rushYdsPerGame ?? 0,
      passYdsAllowedPerGame: stats?.passYdsAllowedPerGame ?? 0,
      rushYdsAllowedPerGame: stats?.rushYdsAllowedPerGame ?? 0,
      turnoversForcedPerGame: stats?.turnoversForcedPerGame ?? 0,
      homeWinPct: win.homeWinPct,
      awayWinPct: win.awayWinPct,
      last5Wins: win.last5Wins,
      last5Losses: win.last5Losses,
      secondaryCompPctAllowed: secCompAllowed,
    }
  }

  function toEdgeQB(qb: NFLQBStats | null, cpoe: number | null): EdgeQBInput | null {
    if (!qb) return null
    return {
      name: qb.name,
      team: qb.team,
      rating: qb.season.rating,
      intRate: qb.season.att > 0 ? Math.round((qb.season.int / qb.season.att) * 1000) / 10 : 0,
      cpoe,
    }
  }

  const edgeCtx: NFLEdgeContext = {
    away: toEdgeTeam(matchup.away.abbr, awayTeamStats, awayWin, awaySecCompAllowed),
    home: toEdgeTeam(matchup.home.abbr, homeTeamStats, homeWin, homeSecCompAllowed),
    awayQB: toEdgeQB(awayQB, awayCpoe),
    homeQB: toEdgeQB(homeQB, homeCpoe),
  }

  const edges = generateNFLEdges(edgeCtx)

  const contextStats = [
    awayTeamStats ? { label: `${matchup.away.abbr} Record`, val: `${awayTeamStats.wins}-${awayTeamStats.losses}`, good: awayTeamStats.wins >= awayTeamStats.losses } : null,
    homeTeamStats ? { label: `${matchup.home.abbr} Record`, val: `${homeTeamStats.wins}-${homeTeamStats.losses}`, good: homeTeamStats.wins >= homeTeamStats.losses } : null,
    awayTeamStats ? { label: `${matchup.away.abbr} Pts/G`, val: awayTeamStats.pointsPerGame.toFixed(1), good: awayTeamStats.pointsPerGame >= 22 } : null,
    homeTeamStats ? { label: `${matchup.home.abbr} Pts/G`, val: homeTeamStats.pointsPerGame.toFixed(1), good: homeTeamStats.pointsPerGame >= 22 } : null,
  ].filter((s): s is { label: string; val: string; good: boolean } => s !== null)

  const statsSeason = await getNFLStatsSeason(season)

  return { matchup, statsSeason, awayQB, homeQB, edges, contextStats }
}
