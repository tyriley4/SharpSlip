import type { ContextStat, Edge } from '@/data/breakdown/types'
import type { RawBoxscoreTeam, RawGameLogEntry } from './api'
import {
  getGameBoxScoreDetail,
  getGameByGamePk,
  getGameFeedLive,
  getMlbTeamsIndex,
  getPerson,
  getPlayerGameLog,
  getPlayerHandednessSplit,
  getPlayerStats,
  getStandings,
  getTeamRoster,
  getTeamStats,
} from './api'
import { computeHitRate, mostRecentFirst } from './bettingStats'
import { generateEdges, type EdgeContext } from './edgeEngine'

// ---------------------------------------------------------------------------
// Game matchup (status, score, inning, probable pitchers, venue, weather)
// ---------------------------------------------------------------------------

export type GameStatus = 'Preview' | 'Live' | 'Final'

export interface GameMatchup {
  gamePk: number
  status: GameStatus
  detailedState: string
  gameDate: string
  venue: string
  venueId: number
  weather: { condition: string; temp: string; wind: string } | null
  away: { id: number; abbr: string; name: string; score: number }
  home: { id: number; abbr: string; name: string; score: number }
  inning: { number: number; state: string } | null
  probablePitchers: {
    away: { id: number; name: string } | null
    home: { id: number; name: string } | null
  }
}

/** Full matchup detail for a game. Probes status cheaply first so live games refresh every 30s while pregame/final hold for 300s. */
export async function getGameMatchup(gamePk: number): Promise<GameMatchup | null> {
  const schedGame = await getGameByGamePk(gamePk)
  if (!schedGame) return null

  const revalidateSeconds = schedGame.status.abstractGameState === 'Live' ? 30 : 300
  const feed = await getGameFeedLive(gamePk, revalidateSeconds)
  if (!feed) return null

  const gd = feed.gameData
  const ld = feed.liveData
  const abstract = gd.status.abstractGameState
  const status: GameStatus = abstract === 'Live' ? 'Live' : abstract === 'Final' ? 'Final' : 'Preview'

  return {
    gamePk,
    status,
    detailedState: gd.status.detailedState,
    gameDate: gd.datetime?.dateTime ?? schedGame.gameDate,
    venue: gd.venue?.name ?? '',
    venueId: gd.venue?.id ?? 0,
    weather: gd.weather?.condition
      ? { condition: gd.weather.condition ?? '', temp: gd.weather.temp ?? '', wind: gd.weather.wind ?? '' }
      : null,
    away: {
      id: gd.teams.away.id,
      abbr: gd.teams.away.abbreviation,
      name: gd.teams.away.name,
      score: ld.linescore?.teams?.away?.runs ?? 0,
    },
    home: {
      id: gd.teams.home.id,
      abbr: gd.teams.home.abbreviation,
      name: gd.teams.home.name,
      score: ld.linescore?.teams?.home?.runs ?? 0,
    },
    inning:
      status === 'Live' && ld.linescore?.currentInning
        ? { number: ld.linescore.currentInning, state: ld.linescore.inningState ?? '' }
        : null,
    probablePitchers: {
      away: gd.probablePitchers?.away
        ? { id: gd.probablePitchers.away.id, name: gd.probablePitchers.away.fullName }
        : null,
      home: gd.probablePitchers?.home
        ? { id: gd.probablePitchers.home.id, name: gd.probablePitchers.home.fullName }
        : null,
    },
  }
}

// ---------------------------------------------------------------------------
// Probable pitcher stats (season line, last 5 starts, home/away + handedness splits)
// ---------------------------------------------------------------------------

export interface PitcherStartLog {
  date: string
  opp: string
  ip: string
  h: number
  er: number
  k: number
  result: 'W' | 'L' | 'ND'
}

export interface ProbablePitcherStats {
  id: number
  name: string
  team: string
  handedness: 'L' | 'R' | '—'
  era: number
  whip: number
  k9: number
  bb9: number
  kPct: number
  avgAgainst: string
  fip: number
  gamesStarted: number
  last5: PitcherStartLog[]
  recentEra: number | null
  hot: boolean
  cold: boolean
  homeAwayEra: { home: number | null; away: number | null }
  handAvg: { vsLeft: string | null; vsRight: string | null }
}

/** FIP uses a standard constant approximation (~3.10) since the free Stats API doesn't publish the league's exact yearly FIP constant. */
const FIP_CONSTANT = 3.1

function eraFromGames(games: RawGameLogEntry[]): number | null {
  const er = games.reduce((sum, g) => sum + Number(g.stat.earnedRuns ?? 0), 0)
  const outs = games.reduce((sum, g) => sum + Number(g.stat.outs ?? 0), 0)
  return outs > 0 ? Math.round(((9 * er) / (outs / 3)) * 100) / 100 : null
}

export async function getProbablePitcherStats(pitcherId: number): Promise<ProbablePitcherStats | null> {
  const [person, season, log, teams] = await Promise.all([
    getPerson(pitcherId),
    getPlayerStats(pitcherId, 'pitching'),
    getPlayerGameLog(pitcherId, 'pitching'),
    getMlbTeamsIndex(),
  ])
  if (!person || !season) return null

  const stat = season.stat
  const era = Number(stat.era ?? 0)
  const whip = Number(stat.whip ?? 0)
  const k9 = Number(stat.strikeoutsPer9Inn ?? 0)
  const bb9 = Number(stat.walksPer9Inn ?? 0)
  const battersFaced = Number(stat.battersFaced ?? 0)
  const strikeOuts = Number(stat.strikeOuts ?? 0)
  const kPct = battersFaced > 0 ? Math.round((strikeOuts / battersFaced) * 1000) / 10 : 0
  const avgAgainst = String(stat.avg ?? '—')
  const ip = parseFloat(String(stat.inningsPitched ?? '0'))
  const hr = Number(stat.homeRuns ?? 0)
  const bb = Number(stat.baseOnBalls ?? 0)
  const hbp = Number(stat.hitBatsmen ?? 0)
  const fip = ip > 0 ? Math.round(((13 * hr + 3 * (bb + hbp) - 2 * strikeOuts) / ip + FIP_CONSTANT) * 100) / 100 : era

  const games = log ?? []
  const sortedDesc = mostRecentFirst(games)

  const last5: PitcherStartLog[] = sortedDesc.slice(0, 5).map((g) => ({
    date: g.date,
    opp: teams?.get(g.opponent.id)?.abbr ?? g.opponent.name.slice(0, 3).toUpperCase(),
    ip: String(g.stat.inningsPitched ?? '0'),
    h: Number(g.stat.hits ?? 0),
    er: Number(g.stat.earnedRuns ?? 0),
    k: Number(g.stat.strikeOuts ?? 0),
    result: Number(g.stat.wins ?? 0) === 1 ? 'W' : Number(g.stat.losses ?? 0) === 1 ? 'L' : 'ND',
  }))

  const last3 = sortedDesc.slice(0, 3)
  const recentEra = eraFromGames(last3)
  const hot = recentEra !== null && era > 0 && recentEra < era - 0.75
  const cold = recentEra !== null && era > 0 && recentEra > era + 0.75

  const [vsLeft, vsRight] = await Promise.all([
    getPlayerHandednessSplit(pitcherId, 'vl', 'pitching'),
    getPlayerHandednessSplit(pitcherId, 'vr', 'pitching'),
  ])

  return {
    id: pitcherId,
    name: person.fullName,
    team: person.currentTeam ? (teams?.get(person.currentTeam.id)?.abbr ?? person.currentTeam.name) : '',
    handedness: (person.pitchHand?.code as 'L' | 'R') ?? '—',
    era,
    whip,
    k9,
    bb9,
    kPct,
    avgAgainst,
    fip,
    gamesStarted: Number(stat.gamesStarted ?? 0),
    last5,
    recentEra,
    hot,
    cold,
    homeAwayEra: { home: eraFromGames(games.filter((g) => g.isHome)), away: eraFromGames(games.filter((g) => !g.isHome)) },
    handAvg: {
      vsLeft: vsLeft ? String(vsLeft.stat.avg ?? '—') : null,
      vsRight: vsRight ? String(vsRight.stat.avg ?? '—') : null,
    },
  }
}

// ---------------------------------------------------------------------------
// Lineups (batting order + player IDs from the box score)
// ---------------------------------------------------------------------------

export interface TodayBattingLine {
  ab: number
  h: number
  hr: number
  rbi: number
  bb: number
  k: number
}

export interface LineupEntry {
  id: number
  name: string
  pos: string
  order: number
  today: TodayBattingLine | null
}

export interface GameLineups {
  away: { posted: boolean; players: LineupEntry[] }
  home: { posted: boolean; players: LineupEntry[] }
}

function extractLineup(team: RawBoxscoreTeam): { posted: boolean; players: LineupEntry[] } {
  const order = team.battingOrder ?? []
  const players: LineupEntry[] = order.map((id, i) => {
    const p = team.players[`ID${id}`]
    const b = p?.stats.batting
    return {
      id,
      name: p?.person.fullName ?? 'Unknown',
      pos: p?.position.abbreviation ?? '—',
      order: i + 1,
      today: b
        ? {
            ab: Number(b.atBats ?? 0),
            h: Number(b.hits ?? 0),
            hr: Number(b.homeRuns ?? 0),
            rbi: Number(b.rbi ?? 0),
            bb: Number(b.baseOnBalls ?? 0),
            k: Number(b.strikeOuts ?? 0),
          }
        : null,
    }
  })
  return { posted: players.length > 0, players }
}

/** Batting lineups for both teams from the box score. `posted: false` when the lineup hasn't been announced yet. */
export async function getGameLineup(gamePk: number, revalidateSeconds = 300): Promise<GameLineups | null> {
  const box = await getGameBoxScoreDetail(gamePk, revalidateSeconds)
  if (!box) return null
  return { away: extractLineup(box.teams.away), home: extractLineup(box.teams.home) }
}

// ---------------------------------------------------------------------------
// Batter stats (season line, vs today's starter handedness, hit-rate, hot/cold)
// ---------------------------------------------------------------------------

export interface BatterBreakdownStats {
  id: number
  name: string
  pos: string
  bats: string
  season: { avg: string; obp: string; slg: string; ops: string; hr: number; rbi: number; pa: number }
  vsHand: { avg: string; obp: string; slg: string; hr: number; rbi: number } | null
  kPct: number
  bbPct: number
  last7Avg: string | null
  hitRate: number
}

/** pitcherHand is today's OPPOSING starter's throwing hand — determines which split we pull for this batter. */
export async function getBatterStats(playerId: number, pitcherHand: 'L' | 'R'): Promise<BatterBreakdownStats | null> {
  const sitCode = pitcherHand === 'L' ? 'vl' : 'vr'
  const [person, season, split, log] = await Promise.all([
    getPerson(playerId),
    getPlayerStats(playerId, 'hitting'),
    getPlayerHandednessSplit(playerId, sitCode, 'hitting'),
    getPlayerGameLog(playerId, 'hitting'),
  ])
  if (!person || !season) return null

  const stat = season.stat
  const pa = Number(stat.plateAppearances ?? 0)
  const kPct = pa > 0 ? Math.round((Number(stat.strikeOuts ?? 0) / pa) * 1000) / 10 : 0
  const bbPct = pa > 0 ? Math.round((Number(stat.baseOnBalls ?? 0) / pa) * 1000) / 10 : 0

  const games = log ?? []
  const hitRateResult = computeHitRate(games, 'hits', 1)

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const last7Games = games.filter((g) => new Date(g.date).getTime() >= cutoff)
  const last7Hits = last7Games.reduce((s, g) => s + Number(g.stat.hits ?? 0), 0)
  const last7AtBats = last7Games.reduce((s, g) => s + Number(g.stat.atBats ?? 0), 0)
  const last7Avg = last7AtBats > 0 ? (last7Hits / last7AtBats).toFixed(3).replace(/^0/, '') : null

  return {
    id: playerId,
    name: person.fullName,
    pos: person.primaryPosition?.abbreviation ?? '—',
    bats: person.batSide?.code ?? '—',
    season: {
      avg: String(stat.avg ?? '—'),
      obp: String(stat.obp ?? '—'),
      slg: String(stat.slg ?? '—'),
      ops: String(stat.ops ?? '—'),
      hr: Number(stat.homeRuns ?? 0),
      rbi: Number(stat.rbi ?? 0),
      pa,
    },
    vsHand: split
      ? {
          avg: String(split.stat.avg ?? '—'),
          obp: String(split.stat.obp ?? '—'),
          slg: String(split.stat.slg ?? '—'),
          hr: Number(split.stat.homeRuns ?? 0),
          rbi: Number(split.stat.rbi ?? 0),
        }
      : null,
    kPct,
    bbPct,
    last7Avg,
    hitRate: hitRateResult.hitRate,
  }
}

// ---------------------------------------------------------------------------
// Team-level context (used by the edge engine and the batting-tab team summary)
// ---------------------------------------------------------------------------

export interface TeamHittingContext {
  avg: string
  obp: string
  slg: string
  hr: number
  runsPerGame: number
  kPct: number
  gamesPlayed: number
}

export async function getTeamHittingContext(teamId: number): Promise<TeamHittingContext | null> {
  const stats = await getTeamStats('hitting')
  const line = stats?.find((s) => s.team.id === teamId)
  if (!line) return null
  const stat = line.stat
  const gamesPlayed = Number(stat.gamesPlayed ?? 0)
  const pa = Number(stat.plateAppearances ?? 0)
  return {
    avg: String(stat.avg ?? '—'),
    obp: String(stat.obp ?? '—'),
    slg: String(stat.slg ?? '—'),
    hr: Number(stat.homeRuns ?? 0),
    runsPerGame: gamesPlayed > 0 ? Math.round((Number(stat.runs ?? 0) / gamesPlayed) * 100) / 100 : 0,
    kPct: pa > 0 ? Math.round((Number(stat.strikeOuts ?? 0) / pa) * 1000) / 10 : 0,
    gamesPlayed,
  }
}

export async function getTeamPitchingEra(teamId: number): Promise<number | null> {
  const stats = await getTeamStats('pitching')
  const line = stats?.find((s) => s.team.id === teamId)
  return line ? Number(line.stat.era ?? 0) : null
}

export interface LeagueHittingAverages {
  avg: number
  obp: number
  slg: number
  hr: number
  runsPerGame: number
}

/** League-wide averages (mean across all 30 teams) for the batting-tab "vs league average" comparison. */
export async function getLeagueHittingAverages(): Promise<LeagueHittingAverages | null> {
  const stats = await getTeamStats('hitting')
  if (!stats || stats.length === 0) return null
  const n = stats.length
  const sum = stats.reduce(
    (acc, s) => {
      const gp = Number(s.stat.gamesPlayed ?? 0)
      acc.avg += Number(s.stat.avg ?? 0)
      acc.obp += Number(s.stat.obp ?? 0)
      acc.slg += Number(s.stat.slg ?? 0)
      acc.hr += Number(s.stat.homeRuns ?? 0)
      acc.runsPerGame += gp > 0 ? Number(s.stat.runs ?? 0) / gp : 0
      return acc
    },
    { avg: 0, obp: 0, slg: 0, hr: 0, runsPerGame: 0 }
  )
  return {
    avg: Math.round((sum.avg / n) * 1000) / 1000,
    obp: Math.round((sum.obp / n) * 1000) / 1000,
    slg: Math.round((sum.slg / n) * 1000) / 1000,
    hr: Math.round(sum.hr / n),
    runsPerGame: Math.round((sum.runsPerGame / n) * 100) / 100,
  }
}

export interface TeamStandingsRecord {
  wins: number
  losses: number
  homeWins: number
  homeLosses: number
  awayWins: number
  awayLosses: number
  last10Wins: number
  last10Losses: number
  runDifferential: number
}

export async function getTeamStandingsRecord(teamId: number): Promise<TeamStandingsRecord | null> {
  const groups = await getStandings()
  if (!groups) return null
  const record = groups.flatMap((g) => g.teamRecords).find((r) => r.team.id === teamId)
  if (!record) return null

  const splits = record.records?.splitRecords ?? []
  const home = splits.find((s) => s.type === 'home')
  const away = splits.find((s) => s.type === 'away')
  const lastTen = splits.find((s) => s.type === 'lastTen')

  return {
    wins: record.leagueRecord.wins,
    losses: record.leagueRecord.losses,
    homeWins: home?.wins ?? 0,
    homeLosses: home?.losses ?? 0,
    awayWins: away?.wins ?? 0,
    awayLosses: away?.losses ?? 0,
    last10Wins: lastTen?.wins ?? 0,
    last10Losses: lastTen?.losses ?? 0,
    runDifferential: record.runDifferential ?? record.runsScored - record.runsAllowed,
  }
}

/**
 * Approximates bullpen ERA by summing earned-run/outs across the current active-roster pitchers
 * who are primarily relievers (gamesStarted / gamesPitched < 0.5) — the free Stats API has no
 * dedicated "bullpen only" stat line, so this is derived rather than pulled directly.
 */
export async function getBullpenEra(teamId: number): Promise<number | null> {
  const roster = await getTeamRoster(teamId)
  if (!roster) return null
  const pitchers = roster.filter((r) => r.position.abbreviation === 'P')
  if (pitchers.length === 0) return null

  const results = await Promise.all(
    pitchers.map(async (p) => {
      const stat = await getPlayerStats(p.person.id, 'pitching')
      if (!stat) return null
      const gamesStarted = Number(stat.stat.gamesStarted ?? 0)
      const gamesPitched = Number(stat.stat.gamesPitched ?? 0)
      const isReliever = gamesPitched > 0 && gamesStarted / gamesPitched < 0.5
      if (!isReliever) return null
      return { earnedRuns: Number(stat.stat.earnedRuns ?? 0), outs: Number(stat.stat.outs ?? 0) }
    })
  )

  const relievers = results.filter((r): r is { earnedRuns: number; outs: number } => r !== null && r.outs > 0)
  if (relievers.length === 0) return null
  const totalEr = relievers.reduce((s, r) => s + r.earnedRuns, 0)
  const totalOuts = relievers.reduce((s, r) => s + r.outs, 0)
  return totalOuts > 0 ? Math.round(((9 * totalEr) / (totalOuts / 3)) * 100) / 100 : null
}

// ---------------------------------------------------------------------------
// Full breakdown aggregator — everything the Analysis + Batting tabs need, in one call
// ---------------------------------------------------------------------------

export interface RealTeamLineup {
  posted: boolean
  players: (BatterBreakdownStats & { order: number; today: TodayBattingLine | null })[]
}

export interface RealGameBreakdown {
  matchup: GameMatchup
  pitchers: { away: ProbablePitcherStats | null; home: ProbablePitcherStats | null }
  edges: Edge[]
  contextStats: ContextStat[]
  batting: { away: RealTeamLineup; home: RealTeamLineup }
  teamHitting: { away: TeamHittingContext | null; home: TeamHittingContext | null }
  leagueAvg: LeagueHittingAverages | null
}

function fallbackBatterStats(entry: LineupEntry): BatterBreakdownStats & { order: number; today: TodayBattingLine | null } {
  return {
    id: entry.id,
    name: entry.name,
    pos: entry.pos,
    bats: '—',
    season: { avg: '—', obp: '—', slg: '—', ops: '—', hr: 0, rbi: 0, pa: 0 },
    vsHand: null,
    kPct: 0,
    bbPct: 0,
    last7Avg: null,
    hitRate: 0,
    order: entry.order,
    today: entry.today,
  }
}

async function buildTeamLineup(
  entries: LineupEntry[],
  opposingHand: 'L' | 'R'
): Promise<(BatterBreakdownStats & { order: number; today: TodayBattingLine | null })[]> {
  const results = await Promise.all(
    entries.map(async (e) => {
      const stats = await getBatterStats(e.id, opposingHand)
      return stats ? { ...stats, order: e.order, today: e.today } : fallbackBatterStats(e)
    })
  )
  return results
}

function winPct(wins: number, losses: number): number | null {
  const total = wins + losses
  return total > 0 ? Math.round((wins / total) * 1000) / 10 : null
}

function buildContextStats(
  away: { abbr: string; standings: TeamStandingsRecord | null },
  home: { abbr: string; standings: TeamStandingsRecord | null }
): ContextStat[] {
  const stats: ContextStat[] = []
  for (const side of [away, home]) {
    if (!side.standings) continue
    stats.push({
      label: `${side.abbr} Record`,
      val: `${side.standings.wins}-${side.standings.losses}`,
      good: side.standings.wins >= side.standings.losses,
    })
  }
  for (const side of [away, home]) {
    if (!side.standings) continue
    const diff = side.standings.runDifferential
    stats.push({ label: `${side.abbr} Run Diff`, val: diff >= 0 ? `+${diff}` : `${diff}`, good: diff >= 0 })
  }
  return stats
}

/** Everything the Analysis and Batting tabs need for a real game, fetched and assembled in one call. */
export async function getRealGameBreakdown(gamePk: number): Promise<RealGameBreakdown | null> {
  const matchup = await getGameMatchup(gamePk)
  if (!matchup) return null

  const [awayPitcherStats, homePitcherStats, lineups] = await Promise.all([
    matchup.probablePitchers.away ? getProbablePitcherStats(matchup.probablePitchers.away.id) : Promise.resolve(null),
    matchup.probablePitchers.home ? getProbablePitcherStats(matchup.probablePitchers.home.id) : Promise.resolve(null),
    getGameLineup(gamePk, matchup.status === 'Live' ? 30 : 300),
  ])

  const [awayHitting, homeHitting, awayPitchingEra, homePitchingEra, awayBullpenEra, homeBullpenEra, awayStandings, homeStandings, leagueAvg] =
    await Promise.all([
      getTeamHittingContext(matchup.away.id),
      getTeamHittingContext(matchup.home.id),
      getTeamPitchingEra(matchup.away.id),
      getTeamPitchingEra(matchup.home.id),
      getBullpenEra(matchup.away.id),
      getBullpenEra(matchup.home.id),
      getTeamStandingsRecord(matchup.away.id),
      getTeamStandingsRecord(matchup.home.id),
      getLeagueHittingAverages(),
    ])

  const edgeCtx: EdgeContext = {
    away: {
      abbr: matchup.away.abbr,
      battingAvg: Number(awayHitting?.avg ?? 0),
      kPct: awayHitting?.kPct ?? 0,
      runsPerGame: awayHitting?.runsPerGame ?? 0,
      pitchingEra: awayPitchingEra ?? 0,
      bullpenEra: awayBullpenEra,
      homeWinPct: awayStandings ? winPct(awayStandings.homeWins, awayStandings.homeLosses) : null,
      awayWinPct: awayStandings ? winPct(awayStandings.awayWins, awayStandings.awayLosses) : null,
      last10Wins: awayStandings?.last10Wins ?? 0,
      last10Losses: awayStandings?.last10Losses ?? 0,
      isHome: false,
    },
    home: {
      abbr: matchup.home.abbr,
      battingAvg: Number(homeHitting?.avg ?? 0),
      kPct: homeHitting?.kPct ?? 0,
      runsPerGame: homeHitting?.runsPerGame ?? 0,
      pitchingEra: homePitchingEra ?? 0,
      bullpenEra: homeBullpenEra,
      homeWinPct: homeStandings ? winPct(homeStandings.homeWins, homeStandings.homeLosses) : null,
      awayWinPct: homeStandings ? winPct(homeStandings.awayWins, homeStandings.awayLosses) : null,
      last10Wins: homeStandings?.last10Wins ?? 0,
      last10Losses: homeStandings?.last10Losses ?? 0,
      isHome: true,
    },
    awayPitcher: awayPitcherStats
      ? { id: awayPitcherStats.id, name: awayPitcherStats.name, team: matchup.away.abbr, era: awayPitcherStats.era, fip: awayPitcherStats.fip, k9: awayPitcherStats.k9 }
      : null,
    homePitcher: homePitcherStats
      ? { id: homePitcherStats.id, name: homePitcherStats.name, team: matchup.home.abbr, era: homePitcherStats.era, fip: homePitcherStats.fip, k9: homePitcherStats.k9 }
      : null,
  }

  const edges = generateEdges(edgeCtx)
  const contextStats = buildContextStats(
    { abbr: matchup.away.abbr, standings: awayStandings },
    { abbr: matchup.home.abbr, standings: homeStandings }
  )

  const opposingHandForAwayLineup: 'L' | 'R' = homePitcherStats?.handedness === 'L' ? 'L' : 'R'
  const opposingHandForHomeLineup: 'L' | 'R' = awayPitcherStats?.handedness === 'L' ? 'L' : 'R'

  const [awayLineupStats, homeLineupStats] = await Promise.all([
    lineups?.away.posted ? buildTeamLineup(lineups.away.players, opposingHandForAwayLineup) : Promise.resolve([]),
    lineups?.home.posted ? buildTeamLineup(lineups.home.players, opposingHandForHomeLineup) : Promise.resolve([]),
  ])

  return {
    matchup,
    pitchers: { away: awayPitcherStats, home: homePitcherStats },
    edges,
    contextStats,
    batting: {
      away: { posted: lineups?.away.posted ?? false, players: awayLineupStats },
      home: { posted: lineups?.home.posted ?? false, players: homeLineupStats },
    },
    teamHitting: { away: awayHitting, home: homeHitting },
    leagueAvg,
  }
}
