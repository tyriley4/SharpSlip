import { fetchJson } from './fetchJson'
import { getMlbTeamsIndex } from './teams'

const BASE_URL = 'https://statsapi.mlb.com/api/v1'

// ---------------------------------------------------------------------------
// Shared raw shapes (only the fields this app actually reads)
// ---------------------------------------------------------------------------

interface RawTeamRef {
  id: number
  name: string
  abbreviation?: string
}

interface RawPersonRef {
  id: number
  fullName: string
}

interface RawRecord {
  wins: number
  losses: number
  ties: number
  pct: string
}

export interface RawScheduleGame {
  gamePk: number
  gameDate: string
  officialDate: string
  status: { abstractGameState: string; detailedState: string }
  venue?: { id: number; name: string }
  teams: {
    away: {
      team: RawTeamRef
      leagueRecord: RawRecord
      score?: number
      probablePitcher?: RawPersonRef
    }
    home: {
      team: RawTeamRef
      leagueRecord: RawRecord
      score?: number
      probablePitcher?: RawPersonRef
    }
  }
}

interface ScheduleResponse {
  dates: { games: RawScheduleGame[] }[]
}

/** Full MLB schedule for an arbitrary date (YYYY-MM-DD). Revalidates hourly. */
export async function getGamesForDate(date: string): Promise<RawScheduleGame[] | null> {
  const url = `${BASE_URL}/schedule?sportId=1&date=${date}&hydrate=probablePitcher,team,linescore`
  const data = await fetchJson<ScheduleResponse>(url, 3600, `mlb-games-${date}`)
  if (!data) return null
  return data.dates.flatMap((d) => d.games)
}

/** Today's full MLB schedule (matchups, times, venues, probable pitchers). Revalidates hourly. */
export async function getTodaysGames(): Promise<RawScheduleGame[] | null> {
  const today = new Date().toISOString().slice(0, 10)
  return getGamesForDate(today)
}

/** A single game's matchup info (teams, time, probable pitchers) by gamePk. Revalidates every 60s. */
export async function getGameByGamePk(gamePk: number): Promise<RawScheduleGame | null> {
  const url = `${BASE_URL}/schedule?sportId=1&gamePk=${gamePk}&hydrate=probablePitcher,team,linescore`
  const data = await fetchJson<ScheduleResponse>(url, 60, `mlb-game-${gamePk}`)
  return data?.dates?.[0]?.games?.[0] ?? null
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

export interface RawSplitRecord {
  wins: number
  losses: number
  type: string
  pct: string
}

export interface RawStandingsTeamRecord {
  team: RawTeamRef
  leagueRecord: RawRecord
  divisionRank: string
  gamesBack: string
  divisionLeader: boolean
  streak?: { streakCode: string }
  gamesPlayed: number
  runsScored: number
  runsAllowed: number
  runDifferential?: number
  records?: { splitRecords: RawSplitRecord[] }
}

export interface RawStandingsRecordGroup {
  division: { id: number }
  teamRecords: RawStandingsTeamRecord[]
}

interface StandingsResponse {
  records: RawStandingsRecordGroup[]
}

/** Current AL + NL standings for all 6 divisions. Revalidates hourly. */
export async function getStandings(season?: number): Promise<RawStandingsRecordGroup[] | null> {
  const yr = season ?? new Date().getFullYear()
  const url = `${BASE_URL}/standings?leagueId=103,104&season=${yr}&standingsTypes=regularSeason`
  const data = await fetchJson<StandingsResponse>(url, 3600, 'mlb-standings')
  return data?.records ?? null
}

// ---------------------------------------------------------------------------
// Player season / career stats
// ---------------------------------------------------------------------------

export interface RawStatSplit {
  season: string
  stat: Record<string, string | number>
  team?: RawTeamRef
}

interface PlayerStatsResponse {
  stats: { splits: RawStatSplit[] }[]
}

/** A player's current-season stats. Revalidates every 24h. */
export async function getPlayerStats(
  playerId: number,
  group: 'hitting' | 'pitching' = 'hitting',
  season?: number
): Promise<RawStatSplit | null> {
  const yr = season ?? new Date().getFullYear()
  const url = `${BASE_URL}/people/${playerId}/stats?stats=season&group=${group}&season=${yr}`
  const data = await fetchJson<PlayerStatsResponse>(url, 86400, `mlb-player-stats-${playerId}-${group}-${yr}`)
  return data?.stats?.[0]?.splits?.[0] ?? null
}

/** A player's full career, broken out by season. Revalidates every 7 days. */
export async function getPlayerCareerStats(
  playerId: number,
  group: 'hitting' | 'pitching' = 'hitting'
): Promise<RawStatSplit[] | null> {
  const url = `${BASE_URL}/people/${playerId}/stats?stats=yearByYear&group=${group}`
  const data = await fetchJson<PlayerStatsResponse>(url, 604800, `mlb-player-career-${playerId}-${group}`)
  return data?.stats?.[0]?.splits ?? null
}

export interface RawGameLogEntry {
  date: string
  team: RawTeamRef
  stat: Record<string, string | number>
  opponent: RawTeamRef
  isHome: boolean
  isWin: boolean
  game?: { gamePk: number; dayNight?: string }
}

/** A player's game-by-game log for a season (used for "recent form"). Revalidates every 24h. */
export async function getPlayerGameLog(
  playerId: number,
  group: 'hitting' | 'pitching' = 'hitting',
  season?: number
): Promise<RawGameLogEntry[] | null> {
  const yr = season ?? new Date().getFullYear()
  const url = `${BASE_URL}/people/${playerId}/stats?stats=gameLog&group=${group}&season=${yr}`
  // Finished seasons never change, so they cache for a week (Career pulls several of them).
  const revalidate = yr < new Date().getFullYear() ? 604800 : 86400
  const data = await fetchJson<{ stats: { splits: RawGameLogEntry[] }[] }>(
    url,
    revalidate,
    `mlb-player-gamelog-${playerId}-${group}-${yr}`
  )
  return data?.stats?.[0]?.splits ?? null
}

/**
 * A player's season-long vs-handedness split (sitCodes 'vl' = vs LHP/LHB, 'vr' = vs RHP/RHB).
 * This is the only real, accurate source for handedness splits — the API has no way to combine
 * it with per-game filters like date range or opponent. Revalidates every 24h.
 */
export async function getPlayerHandednessSplit(
  playerId: number,
  hand: 'vl' | 'vr',
  group: 'hitting' | 'pitching' = 'hitting',
  season?: number
): Promise<RawStatSplit | null> {
  const yr = season ?? new Date().getFullYear()
  const url = `${BASE_URL}/people/${playerId}/stats?stats=statSplits&group=${group}&season=${yr}&sitCodes=${hand}`
  const data = await fetchJson<PlayerStatsResponse>(url, 86400, `mlb-player-split-${playerId}-${group}-${hand}-${yr}`)
  return data?.stats?.[0]?.splits?.[0] ?? null
}

// ---------------------------------------------------------------------------
// Live game feed (full matchup detail: status, score, inning, probable pitchers, weather)
// ---------------------------------------------------------------------------

interface RawGameFeedTeam {
  id: number
  name: string
  abbreviation: string
}

interface RawFeedProbablePitcher {
  id: number
  fullName: string
}

export interface RawGameFeedLive {
  gameData: {
    status: { abstractGameState: string; detailedState: string }
    teams: { away: RawGameFeedTeam; home: RawGameFeedTeam }
    venue?: { id?: number; name: string }
    weather?: { condition?: string; temp?: string; wind?: string }
    probablePitchers?: { away?: RawFeedProbablePitcher; home?: RawFeedProbablePitcher }
    datetime?: { dateTime: string }
  }
  liveData: {
    linescore?: {
      currentInning?: number
      inningState?: string
      teams?: { away?: { runs?: number }; home?: { runs?: number } }
      balls?: number
      strikes?: number
      outs?: number
      offense?: { batter?: RawPersonRef; onDeck?: RawPersonRef }
      defense?: { pitcher?: RawPersonRef }
    }
    plays?: {
      allPlays?: { result?: { description?: string; event?: string }; about?: { isComplete?: boolean } }[]
    }
  }
}

const FEED_BASE_URL = 'https://statsapi.mlb.com/api/v1.1'

/**
 * Full live-feed detail for a game: status, score, inning, probable pitchers, venue, weather.
 * revalidateSeconds should be short (30) for live games and longer (300) for pregame/final —
 * callers decide based on a cheap status probe first, since this endpoint doesn't know the
 * caller's desired freshness ahead of time.
 */
export async function getGameFeedLive(gamePk: number, revalidateSeconds = 30): Promise<RawGameFeedLive | null> {
  const url = `${FEED_BASE_URL}/game/${gamePk}/feed/live`
  return fetchJson<RawGameFeedLive>(url, revalidateSeconds, `mlb-feed-live-${gamePk}`)
}

// ---------------------------------------------------------------------------
// Box score
// ---------------------------------------------------------------------------

export interface RawBoxscorePlayer {
  person: { id: number; fullName: string }
  position: { name: string; abbreviation: string }
  battingOrder?: string
  stats: { batting?: Record<string, string | number>; pitching?: Record<string, string | number> }
  seasonStats: { batting?: Record<string, string | number>; pitching?: Record<string, string | number> }
}

export interface RawBoxscoreTeam {
  team: RawTeamRef
  battingOrder: number[]
  players: Record<string, RawBoxscorePlayer>
}

export interface RawBoxscore {
  teams: { away: RawBoxscoreTeam; home: RawBoxscoreTeam }
}

/** Typed box score for a given game (live or completed): lineups, batting order, per-player stats. */
export async function getGameBoxScoreDetail(gamePk: number, revalidateSeconds = 30): Promise<RawBoxscore | null> {
  const url = `${BASE_URL}/game/${gamePk}/boxscore`
  return fetchJson<RawBoxscore>(url, revalidateSeconds, `mlb-boxscore-detail-${gamePk}`)
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

export interface RawRosterEntry {
  person: RawPersonRef
  jerseyNumber: string
  position: { name: string; abbreviation: string }
  status: { code: string; description: string }
}

interface RosterResponse {
  roster: RawRosterEntry[]
}

/** Current active roster for a team. Revalidates every 24h. */
export async function getTeamRoster(teamId: number, season?: number): Promise<RawRosterEntry[] | null> {
  const yr = season ?? new Date().getFullYear()
  const url = `${BASE_URL}/teams/${teamId}/roster?season=${yr}`
  const data = await fetchJson<RosterResponse>(url, 86400, `mlb-roster-${teamId}-${yr}`)
  return data?.roster ?? null
}

// ---------------------------------------------------------------------------
// League leaders
// ---------------------------------------------------------------------------

export interface RawLeader {
  rank: number
  value: string
  team: RawTeamRef
  person: RawPersonRef
}

interface LeadersResponse {
  leagueLeaders: { leaderCategory: string; leaders: RawLeader[] }[]
}

/**
 * League leaders for one stat category within a stat group.
 * e.g. getLeagueLeaders('homeRuns', 'hitting') or getLeagueLeaders('earnedRunAverage', 'pitching')
 */
export async function getLeagueLeaders(
  statType: string,
  statGroup: 'hitting' | 'pitching' = 'hitting',
  limit = 10,
  season?: number
): Promise<RawLeader[] | null> {
  const yr = season ?? new Date().getFullYear()
  const url = `${BASE_URL}/stats/leaders?leaderCategories=${statType}&season=${yr}&sportId=1&statGroup=${statGroup}&limit=${limit}`
  const data = await fetchJson<LeadersResponse>(url, 3600, `mlb-leaders-${statType}-${statGroup}-${yr}`)
  return data?.leagueLeaders?.[0]?.leaders ?? null
}

// ---------------------------------------------------------------------------
// Team-level season stats (for the "Teams" leaders category)
// ---------------------------------------------------------------------------

export interface RawTeamStatLine {
  stat: Record<string, string | number>
  team: RawTeamRef
}

interface TeamStatsResponse {
  stats: { splits: RawTeamStatLine[] }[]
}

/** Season-level team stats (hitting or pitching) for every team. Revalidates hourly. */
export async function getTeamStats(
  group: 'hitting' | 'pitching' = 'hitting',
  season?: number
): Promise<RawTeamStatLine[] | null> {
  const yr = season ?? new Date().getFullYear()
  const url = `${BASE_URL}/teams/stats?season=${yr}&group=${group}&stats=season&sportId=1`
  const data = await fetchJson<TeamStatsResponse>(url, 3600, `mlb-team-stats-${group}-${yr}`)
  return data?.stats?.[0]?.splits ?? null
}

// ---------------------------------------------------------------------------
// Player ID lookup by slug (for /players/[slug])
// ---------------------------------------------------------------------------

interface AllPlayersResponse {
  people: { id: number; fullName: string }[]
}

/** All active MLB players for a season, id + name only. Revalidates every 24h. */
export async function getAllActivePlayers(season?: number): Promise<{ id: number; fullName: string }[] | null> {
  const yr = season ?? new Date().getFullYear()
  const url = `${BASE_URL}/sports/1/players?season=${yr}`
  const data = await fetchJson<AllPlayersResponse>(url, 86400, `mlb-all-players-${yr}`)
  return data?.people ?? null
}

// ---------------------------------------------------------------------------
// Person detail
// ---------------------------------------------------------------------------

export interface RawPerson {
  id: number
  fullName: string
  currentTeam?: RawTeamRef
  primaryPosition?: { name: string; abbreviation: string }
  pitchHand?: { code: string; description: string }
  batSide?: { code: string; description: string }
}

interface PersonResponse {
  people: RawPerson[]
}

/** A player's identity/bio info (name, position, current team). Revalidates every 24h. */
export async function getPerson(playerId: number): Promise<RawPerson | null> {
  const url = `${BASE_URL}/people/${playerId}?hydrate=currentTeam`
  const data = await fetchJson<PersonResponse>(url, 86400, `mlb-person-${playerId}`)
  return data?.people?.[0] ?? null
}

// ---------------------------------------------------------------------------
// Pitch arsenal + sabermetrics (real Statcast-derived pitch mix, real FIP/xFIP)
// ---------------------------------------------------------------------------

export interface RawPitchArsenalEntry {
  percentage: number
  count: number
  totalPitches: number
  averageSpeed: number
  type: { code: string; description: string }
}

/** Real pitch-type mix (%) and average velocity per pitch, from Statcast-backed data. Revalidates every 24h. */
export async function getPitchArsenal(pitcherId: number, season?: number): Promise<RawPitchArsenalEntry[] | null> {
  const yr = season ?? new Date().getFullYear()
  const url = `${BASE_URL}/people/${pitcherId}/stats?stats=pitchArsenal&group=pitching&season=${yr}`
  const data = await fetchJson<{ stats: { splits: { stat: RawPitchArsenalEntry }[] }[] }>(
    url,
    86400,
    `mlb-pitch-arsenal-${pitcherId}-${yr}`
  )
  const splits = data?.stats?.[0]?.splits
  return splits ? splits.map((s) => s.stat) : null
}

export interface RawSabermetrics {
  fip: number
  xfip: number
  war: number
  eraMinus: number
}

/** Real FIP/xFIP/WAR (not approximated). Revalidates every 24h. */
export async function getSabermetrics(pitcherId: number, season?: number): Promise<RawSabermetrics | null> {
  const yr = season ?? new Date().getFullYear()
  const url = `${BASE_URL}/people/${pitcherId}/stats?stats=sabermetrics&group=pitching&season=${yr}`
  const data = await fetchJson<{ stats: { splits: { stat: RawSabermetrics }[] }[] }>(
    url,
    86400,
    `mlb-sabermetrics-${pitcherId}-${yr}`
  )
  return data?.stats?.[0]?.splits?.[0]?.stat ?? null
}

// ---------------------------------------------------------------------------
// Venue detail (stadium info)
// ---------------------------------------------------------------------------

export interface RawVenueDetail {
  id: number
  name: string
  location?: {
    city?: string
    state?: string
    country?: string
    azimuthAngle?: number
    defaultCoordinates?: { latitude: number; longitude: number }
  }
  fieldInfo?: {
    capacity?: number
    turfType?: string
    roofType?: string
    leftLine?: number
    center?: number
    rightLine?: number
  }
}

/** Real venue detail — location, capacity, surface, roof type. Revalidates every 24h. */
export async function getVenueDetail(venueId: number): Promise<RawVenueDetail | null> {
  const url = `${BASE_URL}/venues/${venueId}?hydrate=location,fieldInfo`
  const data = await fetchJson<{ venues: RawVenueDetail[] }>(url, 86400, `mlb-venue-${venueId}`)
  return data?.venues?.[0] ?? null
}

// ---------------------------------------------------------------------------
// Team schedule with results (for Game Log tab, H2H trends, betting records)
// ---------------------------------------------------------------------------

export interface RawScheduleResultGame {
  gamePk: number
  gameDate: string
  officialDate: string
  status: { abstractGameState: string }
  teams: {
    away: { team: RawTeamRef; score?: number; isWinner?: boolean; probablePitcher?: RawPersonRef }
    home: { team: RawTeamRef; score?: number; isWinner?: boolean; probablePitcher?: RawPersonRef }
  }
  venue?: { id: number; name: string }
}

/** A team's full-season schedule with final scores + probable/actual starters. Revalidates every 5 min. */
export async function getTeamScheduleResults(teamId: number, season?: number, revalidateSeconds = 300): Promise<RawScheduleResultGame[] | null> {
  const yr = season ?? new Date().getFullYear()
  const url = `${BASE_URL}/schedule?sportId=1&teamId=${teamId}&season=${yr}&gameType=R&hydrate=probablePitcher`
  const data = await fetchJson<{ dates: { games: RawScheduleResultGame[] }[] }>(
    url,
    revalidateSeconds,
    `mlb-team-schedule-${teamId}-${yr}`
  )
  return data?.dates?.flatMap((d) => d.games) ?? null
}

/** Head-to-head games this season between two teams (derived from one team's schedule). */
export async function getHeadToHeadGames(teamId: number, opponentId: number, season?: number): Promise<RawScheduleResultGame[] | null> {
  const games = await getTeamScheduleResults(teamId, season)
  if (!games) return null
  return games.filter(
    (g) =>
      g.status.abstractGameState === 'Final' &&
      (g.teams.away.team.id === opponentId || g.teams.home.team.id === opponentId)
  )
}

// ---------------------------------------------------------------------------
// Game linescore (lightweight — for NRFI and inning-by-inning checks)
// ---------------------------------------------------------------------------

export interface RawLinescore {
  innings: { num: number; home?: { runs?: number }; away?: { runs?: number } }[]
}

/** Lightweight inning-by-inning linescore for a completed game. Revalidates every 24h (immutable once final). */
export async function getGameLinescore(gamePk: number): Promise<RawLinescore | null> {
  const url = `${BASE_URL}/game/${gamePk}/linescore`
  return fetchJson<RawLinescore>(url, 86400, `mlb-linescore-${gamePk}`)
}

export { getMlbTeamsIndex }
