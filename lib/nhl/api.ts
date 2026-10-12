import { fetchNhlApiWeb, fetchNhlStatsRest } from './nhlFetch'
import { NHL_TEAM_IDS, NHL_CURRENT_SEASON, nhlAbbrFromTeamId } from './divisions'

function n(v: unknown): number {
  const num = Number(v)
  return Number.isFinite(num) ? num : 0
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Today's games
// ---------------------------------------------------------------------------

export type NHLGameStatus = 'Pregame' | 'Live' | 'Final'

export interface NHLGame {
  gameId: string
  gameDate: string
  startTimeUTC: string
  status: NHLGameStatus
  statusText: string
  venue: string
  network: string | null
  away: { abbr: string; teamId: number; score: number | null }
  home: { abbr: string; teamId: number; score: number | null }
}

function mapGameState(state: string): { status: NHLGameStatus; statusText: string } {
  if (state === 'LIVE' || state === 'CRIT') return { status: 'Live', statusText: 'In Progress' }
  if (state === 'FINAL' || state === 'OFF') return { status: 'Final', statusText: 'Final' }
  return { status: 'Pregame', statusText: 'Scheduled' }
}

interface RawScheduleTeam {
  id: number
  abbrev: string
  score?: number
}

interface RawScheduleGame {
  id: number
  gameDate?: string
  startTimeUTC: string
  gameState: string
  venue?: { default: string }
  tvBroadcasts?: { network: string }[]
  awayTeam: RawScheduleTeam
  homeTeam: RawScheduleTeam
}

interface RawScheduleResponse {
  gameWeek: { date: string; games: RawScheduleGame[] }[]
}

function mapScheduleGame(g: RawScheduleGame, date: string): NHLGame {
  const { status, statusText } = mapGameState(g.gameState)
  return {
    gameId: String(g.id),
    gameDate: date,
    startTimeUTC: g.startTimeUTC,
    status,
    statusText,
    venue: g.venue?.default ?? '',
    network: g.tvBroadcasts?.[0]?.network ?? null,
    away: { abbr: g.awayTeam.abbrev, teamId: g.awayTeam.id, score: g.awayTeam.score ?? null },
    home: { abbr: g.homeTeam.abbrev, teamId: g.homeTeam.id, score: g.homeTeam.score ?? null },
  }
}

export async function getNHLScheduleForDate(date: string): Promise<NHLGame[] | null> {
  const data = await fetchNhlApiWeb<RawScheduleResponse>(`/schedule/${date}`, 3600)
  if (!data) return null
  const day = data.gameWeek.find((w) => w.date === date)
  if (!day) return []
  return day.games.map((g) => mapScheduleGame(g, date))
}

export async function getTodaysNHLGames(): Promise<NHLGame[] | null> {
  return getNHLScheduleForDate(todayDateString())
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

export interface NHLStandingsTeam {
  abbr: string
  teamName: string
  conference: 'Eastern' | 'Western'
  division: string
  gamesPlayed: number
  wins: number
  losses: number
  otLosses: number
  points: number
  pointPct: number
  goalsFor: number
  goalsAgainst: number
  diff: number
  homeRecord: string
  awayRecord: string
  last10: string
  streak: string
  /** Regulation + overtime wins (the ROW tiebreaker). */
  row: number
}

interface RawStandingsRow {
  conferenceName: string
  divisionName: string
  gamesPlayed: number
  wins: number
  losses: number
  otLosses: number
  points: number
  pointPctg: number
  goalFor: number
  goalAgainst: number
  goalDifferential: number
  homeWins: number
  homeLosses: number
  homeOtLosses: number
  roadWins: number
  roadLosses: number
  roadOtLosses: number
  l10Wins: number
  l10Losses: number
  l10OtLosses: number
  streakCode: string
  streakCount: number
  regulationPlusOtWins?: number
  teamName: { default: string }
  teamAbbrev: { default: string }
}

interface RawStandingsResponse {
  standings: RawStandingsRow[]
}

export async function getNHLStandings(date: string = todayDateString()): Promise<NHLStandingsTeam[] | null> {
  const data = await fetchNhlApiWeb<RawStandingsResponse>(`/standings/${date}`, 3600)
  if (!data) return null

  return data.standings.map((r): NHLStandingsTeam => ({
    abbr: r.teamAbbrev.default,
    teamName: r.teamName.default,
    conference: r.conferenceName === 'Eastern' ? 'Eastern' : 'Western',
    division: r.divisionName,
    gamesPlayed: n(r.gamesPlayed),
    wins: n(r.wins),
    losses: n(r.losses),
    otLosses: n(r.otLosses),
    points: n(r.points),
    pointPct: n(r.pointPctg),
    goalsFor: n(r.goalFor),
    goalsAgainst: n(r.goalAgainst),
    diff: n(r.goalDifferential),
    homeRecord: `${n(r.homeWins)}-${n(r.homeLosses)}-${n(r.homeOtLosses)}`,
    awayRecord: `${n(r.roadWins)}-${n(r.roadLosses)}-${n(r.roadOtLosses)}`,
    last10: `${n(r.l10Wins)}-${n(r.l10Losses)}-${n(r.l10OtLosses)}`,
    streak: `${r.streakCode ?? ''}${r.streakCount ?? ''}`,
    row: n(r.regulationPlusOtWins),
  }))
}

// ---------------------------------------------------------------------------
// Team season summary (PP%/PK%/GF-GA per game) — the api.nhle.com reporting API
// returns every team in one call, keyed by numeric teamId.
// ---------------------------------------------------------------------------

export interface NHLTeamStats {
  teamId: number
  abbr: string
  gamesPlayed: number
  wins: number
  losses: number
  otLosses: number
  points: number
  pointPct: number
  goalsForPerGame: number
  goalsAgainstPerGame: number
  shotsForPerGame: number
  shotsAgainstPerGame: number
  powerPlayPct: number
  penaltyKillPct: number
  faceoffWinPct: number
}

interface RawTeamSummaryRow {
  teamId: number
  gamesPlayed: number
  wins: number
  losses: number
  otLosses: number
  points: number
  pointPct: number
  goalsForPerGame: number
  goalsAgainstPerGame: number
  shotsForPerGame: number
  shotsAgainstPerGame: number
  powerPlayPct: number
  penaltyKillPct: number
  faceoffWinPct: number
}

let teamSummaryCache: { season: number; data: NHLTeamStats[]; fetchedAt: number } | null = null
const teamSummaryInFlight = new Map<number, Promise<NHLTeamStats[] | null>>()

async function fetchAllNHLTeamStats(season: number): Promise<NHLTeamStats[] | null> {
  const data = await fetchNhlStatsRest<{ data: RawTeamSummaryRow[] }>(
    `/team/summary?cayenneExp=seasonId=${season}`,
    3600
  )
  if (!data) return null
  const result = data.data.map((r): NHLTeamStats => ({
    teamId: r.teamId,
    abbr: nhlAbbrFromTeamId(r.teamId),
    gamesPlayed: n(r.gamesPlayed),
    wins: n(r.wins),
    losses: n(r.losses),
    otLosses: n(r.otLosses),
    points: n(r.points),
    pointPct: n(r.pointPct),
    goalsForPerGame: n(r.goalsForPerGame),
    goalsAgainstPerGame: n(r.goalsAgainstPerGame),
    shotsForPerGame: n(r.shotsForPerGame),
    shotsAgainstPerGame: n(r.shotsAgainstPerGame),
    powerPlayPct: n(r.powerPlayPct),
    penaltyKillPct: n(r.penaltyKillPct),
    faceoffWinPct: n(r.faceoffWinPct),
  }))
  teamSummaryCache = { season, data: result, fetchedAt: Date.now() }
  return result
}

/** Deduplicates concurrent cache-miss callers onto a single in-flight request. */
export async function getAllNHLTeamStats(season: number = NHL_CURRENT_SEASON): Promise<NHLTeamStats[] | null> {
  if (teamSummaryCache && teamSummaryCache.season === season && Date.now() - teamSummaryCache.fetchedAt < 3600 * 1000) {
    return teamSummaryCache.data
  }
  const existing = teamSummaryInFlight.get(season)
  if (existing) return existing

  const request = fetchAllNHLTeamStats(season)
  teamSummaryInFlight.set(season, request)
  try {
    return await request
  } finally {
    teamSummaryInFlight.delete(season)
  }
}

export async function getNHLTeamStats(teamAbbr: string, season: number = NHL_CURRENT_SEASON): Promise<NHLTeamStats | null> {
  const all = await getAllNHLTeamStats(season)
  return all?.find((t) => t.abbr === teamAbbr) ?? null
}

// ---------------------------------------------------------------------------
// Per-player season stats via club-stats (all 32 teams, aggregated) — the source for
// Leaders (skaters/goalies) and Phase 5 player lookup.
// ---------------------------------------------------------------------------

export interface NHLSkaterSeasonStats {
  playerId: number
  name: string
  teamAbbr: string
  position: string
  gamesPlayed: number
  goals: number
  assists: number
  points: number
  plusMinus: number
  pim: number
  powerPlayGoals: number
  shorthandedGoals: number
  gameWinningGoals: number
  shots: number
  shootingPct: number
  avgToiSeconds: number
  faceoffWinPct: number
}

export interface NHLGoalieSeasonStats {
  playerId: number
  name: string
  teamAbbr: string
  gamesPlayed: number
  gamesStarted: number
  wins: number
  losses: number
  otLosses: number
  goalsAgainstAvg: number
  savePct: number
  shotsAgainst: number
  saves: number
  goalsAgainst: number
  shutouts: number
  toiSeconds: number
}

interface RawClubSkater {
  playerId: number
  firstName: { default: string }
  lastName: { default: string }
  positionCode: string
  gamesPlayed: number
  goals: number
  assists: number
  points: number
  plusMinus: number
  penaltyMinutes: number
  powerPlayGoals: number
  shorthandedGoals: number
  gameWinningGoals: number
  shots: number
  shootingPctg: number
  avgTimeOnIcePerGame: number
  faceoffWinPctg: number
}

interface RawClubGoalie {
  playerId: number
  firstName: { default: string }
  lastName: { default: string }
  gamesPlayed: number
  gamesStarted: number
  wins: number
  losses: number
  overtimeLosses: number
  goalsAgainstAverage: number
  savePercentage: number
  shotsAgainst: number
  saves: number
  goalsAgainst: number
  shutouts: number
  timeOnIce: number
}

interface RawClubStatsResponse {
  skaters?: RawClubSkater[]
  goalies?: RawClubGoalie[]
}

let skaterStatsCache: { season: number; data: NHLSkaterSeasonStats[]; fetchedAt: number } | null = null
let goalieStatsCache: { season: number; data: NHLGoalieSeasonStats[]; fetchedAt: number } | null = null
const clubStatsInFlight = new Map<number, Promise<{ skaters: NHLSkaterSeasonStats[]; goalies: NHLGoalieSeasonStats[] } | null>>()

async function fetchAllNHLClubStats(): Promise<{ skaters: NHLSkaterSeasonStats[]; goalies: NHLGoalieSeasonStats[] } | null> {
  const abbrs = Object.keys(NHL_TEAM_IDS)
  const results = await Promise.all(abbrs.map((abbr) => fetchNhlApiWeb<RawClubStatsResponse>(`/club-stats/${abbr}/now`, 3600)))

  const skaters: NHLSkaterSeasonStats[] = []
  const goalies: NHLGoalieSeasonStats[] = []

  results.forEach((data, i) => {
    if (!data) return
    const abbr = abbrs[i]
    for (const s of data.skaters ?? []) {
      skaters.push({
        playerId: s.playerId,
        name: `${s.firstName.default} ${s.lastName.default}`,
        teamAbbr: abbr,
        position: s.positionCode,
        gamesPlayed: n(s.gamesPlayed),
        goals: n(s.goals),
        assists: n(s.assists),
        points: n(s.points),
        plusMinus: n(s.plusMinus),
        pim: n(s.penaltyMinutes),
        powerPlayGoals: n(s.powerPlayGoals),
        shorthandedGoals: n(s.shorthandedGoals),
        gameWinningGoals: n(s.gameWinningGoals),
        shots: n(s.shots),
        shootingPct: n(s.shootingPctg),
        avgToiSeconds: n(s.avgTimeOnIcePerGame),
        faceoffWinPct: n(s.faceoffWinPctg),
      })
    }
    for (const g of data.goalies ?? []) {
      goalies.push({
        playerId: g.playerId,
        name: `${g.firstName.default} ${g.lastName.default}`,
        teamAbbr: abbr,
        gamesPlayed: n(g.gamesPlayed),
        gamesStarted: n(g.gamesStarted),
        wins: n(g.wins),
        losses: n(g.losses),
        otLosses: n(g.overtimeLosses),
        goalsAgainstAvg: n(g.goalsAgainstAverage),
        savePct: n(g.savePercentage),
        shotsAgainst: n(g.shotsAgainst),
        saves: n(g.saves),
        goalsAgainst: n(g.goalsAgainst),
        shutouts: n(g.shutouts),
        toiSeconds: n(g.timeOnIce),
      })
    }
  })

  skaterStatsCache = { season: NHL_CURRENT_SEASON, data: skaters, fetchedAt: Date.now() }
  goalieStatsCache = { season: NHL_CURRENT_SEASON, data: goalies, fetchedAt: Date.now() }
  return { skaters, goalies }
}

async function getAllNHLClubStats(): Promise<{ skaters: NHLSkaterSeasonStats[]; goalies: NHLGoalieSeasonStats[] } | null> {
  if (
    skaterStatsCache &&
    goalieStatsCache &&
    skaterStatsCache.season === NHL_CURRENT_SEASON &&
    Date.now() - skaterStatsCache.fetchedAt < 3600 * 1000
  ) {
    return { skaters: skaterStatsCache.data, goalies: goalieStatsCache.data }
  }

  const existing = clubStatsInFlight.get(NHL_CURRENT_SEASON)
  if (existing) return existing

  const request = fetchAllNHLClubStats()
  clubStatsInFlight.set(NHL_CURRENT_SEASON, request)
  try {
    return await request
  } finally {
    clubStatsInFlight.delete(NHL_CURRENT_SEASON)
  }
}

export async function getAllNHLSkaterStats(): Promise<NHLSkaterSeasonStats[] | null> {
  const all = await getAllNHLClubStats()
  return all?.skaters ?? null
}

export async function getAllNHLGoalieStats(): Promise<NHLGoalieSeasonStats[] | null> {
  const all = await getAllNHLClubStats()
  return all?.goalies ?? null
}

const NHL_SKATER_LEADER_FIELD: Record<string, keyof NHLSkaterSeasonStats> = {
  PTS: 'points',
  G: 'goals',
  A: 'assists',
  '+/-': 'plusMinus',
  SOG: 'shots',
  PIM: 'pim',
  TOI: 'avgToiSeconds',
  PPG: 'powerPlayGoals',
  SHG: 'shorthandedGoals',
  GWG: 'gameWinningGoals',
}

const NHL_GOALIE_LEADER_FIELD: Record<string, keyof NHLGoalieSeasonStats> = {
  'SV%': 'savePct',
  GAA: 'goalsAgainstAvg',
  W: 'wins',
  SO: 'shutouts',
  SA: 'shotsAgainst',
  GA: 'goalsAgainst',
  MIN: 'toiSeconds',
}

export interface NHLLeaderRow {
  playerId: number
  name: string
  teamAbbr: string
  value: number
}

/** category is one of the Leaders tab's Game Stats pills (skater or goalie). */
export async function getNHLLeagueLeaders(category: string, group: 'skater' | 'goalie' = 'skater', limit = 15): Promise<NHLLeaderRow[] | null> {
  if (group === 'goalie') {
    const field = NHL_GOALIE_LEADER_FIELD[category]
    if (!field) return null
    const all = await getAllNHLGoalieStats()
    if (!all) return null
    const ascending = category === 'GAA'
    const qualified = all.filter((g) => g.gamesPlayed >= 1)
    const sorted = [...qualified].sort((a, b) => (ascending ? n(a[field]) - n(b[field]) : n(b[field]) - n(a[field])))
    return sorted.slice(0, limit).map((g) => ({ playerId: g.playerId, name: g.name, teamAbbr: g.teamAbbr, value: n(g[field]) }))
  }

  const field = NHL_SKATER_LEADER_FIELD[category]
  if (!field) return null
  const all = await getAllNHLSkaterStats()
  if (!all) return null
  const ascending = false
  const sorted = [...all].sort((a, b) => (ascending ? n(a[field]) - n(b[field]) : n(b[field]) - n(a[field])))
  return sorted.slice(0, limit).map((s) => ({ playerId: s.playerId, name: s.name, teamAbbr: s.teamAbbr, value: n(s[field]) }))
}

// ---------------------------------------------------------------------------
// Individual player stats / game log (landing + game-log endpoints)
// ---------------------------------------------------------------------------

export interface NHLPlayerInfo {
  playerId: number
  name: string
  teamAbbr: string
  position: string
  isGoalie: boolean
}

interface RawPlayerLanding {
  playerId: number
  currentTeamAbbrev: string
  firstName: { default: string }
  lastName: { default: string }
  position: string
  featuredStats?: {
    regularSeason?: {
      subSeason?: Record<string, number>
    }
  }
}

export async function getNHLPlayerInfo(playerId: number): Promise<NHLPlayerInfo | null> {
  const data = await fetchNhlApiWeb<RawPlayerLanding>(`/player/${playerId}/landing`, 86400)
  if (!data) return null
  return {
    playerId: data.playerId,
    name: `${data.firstName.default} ${data.lastName.default}`,
    teamAbbr: data.currentTeamAbbrev,
    position: data.position,
    isGoalie: data.position === 'G',
  }
}

export interface NHLPlayerSeasonStats {
  playerId: number
  name: string
  teamAbbr: string
  position: string
  gamesPlayed: number
  goals: number
  assists: number
  points: number
  plusMinus: number
  pim: number
  shots: number
  toiPerGame: string
}

export async function getNHLPlayerStats(playerId: number): Promise<NHLPlayerSeasonStats | null> {
  const info = await getNHLPlayerInfo(playerId)
  const data = await fetchNhlApiWeb<RawPlayerLanding>(`/player/${playerId}/landing`, 86400)
  if (!data || !info) return null
  const s = data.featuredStats?.regularSeason?.subSeason ?? {}
  return {
    playerId,
    name: info.name,
    teamAbbr: info.teamAbbr,
    position: info.position,
    gamesPlayed: n(s.gamesPlayed),
    goals: n(s.goals),
    assists: n(s.assists),
    points: n(s.points),
    plusMinus: n(s.plusMinus),
    pim: n(s.pim),
    shots: n(s.shots),
    toiPerGame: '',
  }
}

export interface NHLGoalieStats {
  playerId: number
  name: string
  teamAbbr: string
  gamesPlayed: number
  wins: number
  losses: number
  otLosses: number
  goalsAgainstAvg: number
  savePct: number
  shutouts: number
}

export async function getNHLGoalieStats(playerId: number): Promise<NHLGoalieStats | null> {
  const info = await getNHLPlayerInfo(playerId)
  const data = await fetchNhlApiWeb<RawPlayerLanding>(`/player/${playerId}/landing`, 86400)
  if (!data || !info) return null
  const s = data.featuredStats?.regularSeason?.subSeason ?? {}
  return {
    playerId,
    name: info.name,
    teamAbbr: info.teamAbbr,
    gamesPlayed: n(s.gamesPlayed),
    wins: n(s.wins),
    losses: n(s.losses),
    otLosses: n(s.otLosses),
    goalsAgainstAvg: n(s.goalsAgainstAvg),
    savePct: n(s.savePctg),
    shutouts: n(s.shutouts),
  }
}

export interface NHLPlayerGameLogRow {
  gameId: string
  gameDate: string
  opponentAbbr: string
  isHome: boolean
  result: 'W' | 'L' | null
  // skater fields
  goals: number
  assists: number
  points: number
  plusMinus: number
  shots: number
  pim: number
  toi: string
  // goalie fields
  decision: 'W' | 'L' | 'OT' | null
  shotsAgainst: number
  goalsAgainst: number
  savePct: number
  saves: number
}

interface RawGameLogRow {
  gameId: number
  gameDate: string
  homeRoadFlag: 'H' | 'R'
  teamAbbrev: string
  opponentAbbrev: string
  goals?: number
  assists?: number
  points?: number
  plusMinus?: number
  shots?: number
  pim?: number
  toi?: string
  decision?: 'W' | 'L' | 'O'
  shotsAgainst?: number
  goalsAgainst?: number
  savePctg?: number
}

interface RawGameLogResponse {
  gameLog: RawGameLogRow[]
}

export async function getNHLPlayerGameLog(playerId: number, season: number = NHL_CURRENT_SEASON): Promise<NHLPlayerGameLogRow[] | null> {
  const data = await fetchNhlApiWeb<RawGameLogResponse>(`/player/${playerId}/game-log/${season}/2`, season === NHL_CURRENT_SEASON ? 86400 : 604800)
  if (!data) return null

  const rows = data.gameLog.map((g): NHLPlayerGameLogRow => {
    const saves = g.decision !== undefined ? n(g.shotsAgainst) - n(g.goalsAgainst) : 0
    return {
      gameId: String(g.gameId),
      gameDate: g.gameDate,
      opponentAbbr: g.opponentAbbrev,
      isHome: g.homeRoadFlag === 'H',
      result: g.decision === 'W' ? 'W' : g.decision ? 'L' : null,
      goals: n(g.goals),
      assists: n(g.assists),
      points: n(g.points),
      plusMinus: n(g.plusMinus),
      shots: n(g.shots),
      pim: n(g.pim),
      toi: g.toi ?? '',
      decision: g.decision === 'W' ? 'W' : g.decision === 'L' ? 'L' : g.decision === 'O' ? 'OT' : null,
      shotsAgainst: n(g.shotsAgainst),
      goalsAgainst: n(g.goalsAgainst),
      savePct: n(g.savePctg),
      saves,
    }
  })

  // Skaters' own game-log rows carry no win/loss indicator (only goalies get a "decision" field
  // from this endpoint) — cross-reference the player's team schedule to fill in the real result.
  const isSkaterLog = data.gameLog.length > 0 && data.gameLog[0].decision === undefined
  if (isSkaterLog) {
    const teamAbbr = data.gameLog[0]?.teamAbbrev
    const teamLog = teamAbbr ? await getNHLTeamGameLog(teamAbbr, season) : null
    if (teamLog) {
      const resultByGameId = new Map(teamLog.map((g) => [g.gameId, g.result]))
      for (const row of rows) {
        const teamResult = resultByGameId.get(row.gameId)
        if (teamResult) row.result = teamResult === 'OT' ? 'L' : teamResult
      }
    }
  }

  return rows
}

// ---------------------------------------------------------------------------
// Box score (for live/final games and starting-goalie detection)
// ---------------------------------------------------------------------------

export interface NHLBoxScorePlayer {
  playerId: number
  name: string
  position: string
  goals: number
  assists: number
  points: number
  plusMinus: number
  shots: number
  toi: string
  starter?: boolean
  decision?: string
  savePctg?: number
  saves?: number
  shotsAgainst?: number
  goalsAgainst?: number
}

export interface NHLBoxScoreTeam {
  teamId: number
  abbr: string
  score: number
  sog: number
  forwards: NHLBoxScorePlayer[]
  defense: NHLBoxScorePlayer[]
  goalies: NHLBoxScorePlayer[]
}

export interface NHLBoxScore {
  gameId: string
  gameState: string
  away: NHLBoxScoreTeam
  home: NHLBoxScoreTeam
}

interface RawBoxTeamStats {
  id: number
  abbrev: string
  score: number
  sog: number
}

interface RawBoxPlayer {
  playerId: number
  name: { default: string }
  position: string
  goals?: number
  assists?: number
  points?: number
  plusMinus?: number
  sog?: number
  toi?: string
  starter?: boolean
  decision?: string
  savePctg?: number
  saves?: number
  shotsAgainst?: number
  goalsAgainst?: number
}

interface RawBoxScoreResponse {
  id: number
  gameState: string
  awayTeam: RawBoxTeamStats
  homeTeam: RawBoxTeamStats
  playerByGameStats?: {
    awayTeam: { forwards: RawBoxPlayer[]; defense: RawBoxPlayer[]; goalies: RawBoxPlayer[] }
    homeTeam: { forwards: RawBoxPlayer[]; defense: RawBoxPlayer[]; goalies: RawBoxPlayer[] }
  }
}

function mapBoxPlayer(p: RawBoxPlayer): NHLBoxScorePlayer {
  return {
    playerId: p.playerId,
    name: p.name.default,
    position: p.position,
    goals: n(p.goals),
    assists: n(p.assists),
    points: n(p.points),
    plusMinus: n(p.plusMinus),
    shots: n(p.sog),
    toi: p.toi ?? '',
    starter: p.starter,
    decision: p.decision,
    savePctg: p.savePctg,
    saves: p.saves,
    shotsAgainst: p.shotsAgainst,
    goalsAgainst: p.goalsAgainst,
  }
}

function mapBoxTeam(t: RawBoxTeamStats, players?: { forwards: RawBoxPlayer[]; defense: RawBoxPlayer[]; goalies: RawBoxPlayer[] }): NHLBoxScoreTeam {
  return {
    teamId: t.id,
    abbr: t.abbrev,
    score: n(t.score),
    sog: n(t.sog),
    forwards: (players?.forwards ?? []).map(mapBoxPlayer),
    defense: (players?.defense ?? []).map(mapBoxPlayer),
    goalies: (players?.goalies ?? []).map(mapBoxPlayer),
  }
}

export async function getNHLBoxScore(gameId: string): Promise<NHLBoxScore | null> {
  const data = await fetchNhlApiWeb<RawBoxScoreResponse>(`/gamecenter/${gameId}/boxscore`, 60)
  if (!data) return null
  return {
    gameId: String(data.id),
    gameState: data.gameState,
    away: mapBoxTeam(data.awayTeam, data.playerByGameStats?.awayTeam),
    home: mapBoxTeam(data.homeTeam, data.playerByGameStats?.homeTeam),
  }
}

// ---------------------------------------------------------------------------
// Team game log (for rest/back-to-back detection and last-5/H2H trends)
// ---------------------------------------------------------------------------

export interface NHLTeamGameLogRow {
  gameId: string
  gameDate: string
  opponentAbbr: string
  isHome: boolean
  goalsFor: number
  goalsAgainst: number
  result: 'W' | 'L' | 'OT'
  wentToOT: boolean
}

interface RawTeamScheduleGame {
  id: number
  gameDate: string
  gameState: string
  gameType: number
  periodDescriptor?: { periodType: string }
  homeTeam: { abbrev: string; score?: number }
  awayTeam: { abbrev: string; score?: number }
}

interface RawTeamScheduleResponse {
  games: RawTeamScheduleGame[]
}

let teamGameLogCache: Map<string, { data: NHLTeamGameLogRow[]; fetchedAt: number }> = new Map()

export async function getNHLTeamGameLog(teamAbbr: string, season: number = NHL_CURRENT_SEASON): Promise<NHLTeamGameLogRow[] | null> {
  const cached = teamGameLogCache.get(teamAbbr)
  if (cached && Date.now() - cached.fetchedAt < 3600 * 1000) return cached.data

  const data = await fetchNhlApiWeb<RawTeamScheduleResponse>(`/club-schedule-season/${teamAbbr}/${season}`, 3600)
  if (!data) return null

  const result = data.games
    .filter((g) => g.gameType === 2 && (g.gameState === 'OFF' || g.gameState === 'FINAL'))
    .map((g): NHLTeamGameLogRow => {
      const isHome = g.homeTeam.abbrev === teamAbbr
      const own = isHome ? g.homeTeam : g.awayTeam
      const opp = isHome ? g.awayTeam : g.homeTeam
      const goalsFor = n(own.score)
      const goalsAgainst = n(opp.score)
      const periodType = g.periodDescriptor?.periodType
      return {
        gameId: String(g.id),
        gameDate: g.gameDate,
        opponentAbbr: opp.abbrev,
        isHome,
        goalsFor,
        goalsAgainst,
        result: goalsFor > goalsAgainst ? 'W' : 'L',
        wentToOT: periodType === 'OT' || periodType === 'SO',
      }
    })

  teamGameLogCache.set(teamAbbr, { data: result, fetchedAt: Date.now() })
  return result
}

export interface NHLRestInfo {
  daysRest: number | null
  backToBack: boolean
}

export async function getNHLTeamRestInfo(teamAbbr: string, asOfDate: string, season: number = NHL_CURRENT_SEASON): Promise<NHLRestInfo> {
  const log = await getNHLTeamGameLog(teamAbbr, season)
  if (!log || log.length === 0) return { daysRest: null, backToBack: false }

  const asOf = new Date(asOfDate).getTime()
  const prior = log.filter((g) => new Date(g.gameDate).getTime() < asOf).sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
  if (prior.length === 0) return { daysRest: null, backToBack: false }

  const lastGameDate = new Date(prior[0].gameDate).getTime()
  const daysRest = Math.round((asOf - lastGameDate) / (24 * 60 * 60 * 1000))
  return { daysRest, backToBack: daysRest <= 1 }
}
