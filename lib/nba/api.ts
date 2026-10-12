import { fetchBdl, type BdlGame, type BdlPlayer, type BdlSeasonAverage, type BdlStandingRow, type BdlTeam } from './balldontlie'
import { NBA_CURRENT_SEASON, NBA_TEAM_IDS, nbaAbbrFromTeamId, NBA_TEAM_NAMES } from './divisions'
import { espnNbaBoxScore, espnNbaGames, espnNbaPlayerGameLog, espnNbaPlayerStats, espnNbaStandings, espnNbaTeamGameLog, espnNbaTeamStats, isEspnGameId } from './espnFallback'
import { fetchNbaStats, getResultRows, type NbaStatsResponse } from './statsFetch'

function n(v: string | number | null | undefined): number {
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : 0
}
function s(v: string | number | null | undefined): string {
  return v === null || v === undefined ? '' : String(v)
}
function pick(row: Record<string, string | number | null>, ...keys: string[]): string | number | null {
  for (const k of keys) {
    if (row[k] !== undefined) return row[k]
  }
  return null
}

// ---------------------------------------------------------------------------
// Today's games
// ---------------------------------------------------------------------------

export interface NBAGame {
  gameId: string
  gameDate: string
  status: 'Pregame' | 'Live' | 'Final'
  statusText: string
  arena: string
  network: string | null
  away: { abbr: string; teamId: number; score: number | null }
  home: { abbr: string; teamId: number; score: number | null }
}

function statusFromCode(gameStatusId: number, text: string): 'Pregame' | 'Live' | 'Final' {
  if (gameStatusId === 3 || /final/i.test(text)) return 'Final'
  if (gameStatusId === 2) return 'Live'
  return 'Pregame'
}

async function getTodaysNBAGamesFromStats(date: string): Promise<NBAGame[] | null> {
  const data = await fetchNbaStats(`scoreboardv2?GameDate=${date}&LeagueID=00&DayOffset=0`, 3600, `nba-scoreboard-${date}`)
  if (!data) return null

  const headers = getResultRows(data, 'GameHeader')
  const lines = getResultRows(data, 'LineScore')

  return headers.map((g): NBAGame => {
    const gameId = s(g.GAME_ID)
    const homeTeamId = n(g.HOME_TEAM_ID)
    const awayTeamId = n(g.VISITOR_TEAM_ID)
    const homeLine = lines.find((l) => s(l.GAME_ID) === gameId && n(l.TEAM_ID) === homeTeamId)
    const awayLine = lines.find((l) => s(l.GAME_ID) === gameId && n(l.TEAM_ID) === awayTeamId)
    const statusText = s(g.GAME_STATUS_TEXT)

    return {
      gameId,
      gameDate: s(g.GAME_DATE_EST),
      status: statusFromCode(n(g.GAME_STATUS_ID), statusText),
      statusText,
      arena: s(g.ARENA_NAME),
      network: s(g.NATL_TV_BROADCASTER_ABBREVIATION) || null,
      away: { abbr: nbaAbbrFromTeamId(awayTeamId), teamId: awayTeamId, score: awayLine ? n(awayLine.PTS) : null },
      home: { abbr: nbaAbbrFromTeamId(homeTeamId), teamId: homeTeamId, score: homeLine ? n(homeLine.PTS) : null },
    }
  })
}

async function getTodaysNBAGamesFromBdl(date: string): Promise<NBAGame[] | null> {
  const data = await fetchBdl<{ data: BdlGame[] }>(`/games?dates[]=${date}&per_page=25`, 3600, `nba-bdl-games-${date}`)
  if (!data) return null
  return data.data.map((g) => ({
    gameId: String(g.id),
    gameDate: g.date,
    status: g.status === 'Final' ? 'Final' : g.period > 0 ? 'Live' : 'Pregame',
    statusText: g.status,
    arena: '',
    network: null,
    away: { abbr: g.visitor_team.abbreviation, teamId: NBA_TEAM_IDS[g.visitor_team.abbreviation] ?? g.visitor_team.id, score: g.visitor_team_score || null },
    home: { abbr: g.home_team.abbreviation, teamId: NBA_TEAM_IDS[g.home_team.abbreviation] ?? g.home_team.id, score: g.home_team_score || null },
  }))
}

/**
 * NBA schedule for an arbitrary date (YYYY-MM-DD). ESPN is primary (stable, and its game ids open box scores);
 * then stats.nba.com (ids only it understands); then balldontlie.io (scores/schedule only); then null.
 */
export async function getNBAGamesForDate(date: string): Promise<NBAGame[] | null> {
  const fromEspn = await espnNbaGames(date)
  if (fromEspn) return fromEspn
  const fromStats = await getTodaysNBAGamesFromStats(date)
  if (fromStats) {
    console.log(`[nba] schedule ${date}: ESPN unavailable, served by stats.nba.com`)
    return fromStats
  }
  const fromBdl = await getTodaysNBAGamesFromBdl(date)
  if (fromBdl) console.log(`[nba] schedule ${date}: served by balldontlie fallback (${fromBdl.length} games)`)
  return fromBdl
}

/** Today's NBA schedule. Tries stats.nba.com, falls back to balldontlie.io, then null. */
export async function getTodaysNBAGames(): Promise<NBAGame[] | null> {
  const date = new Date().toISOString().slice(0, 10)
  return getNBAGamesForDate(date)
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

export interface NBAStandingsTeam {
  abbr: string
  teamId: number
  conference: 'East' | 'West'
  division: string
  wins: number
  losses: number
  winPct: number
  home: string
  away: string
  last10: string
  streak: string
  gamesBack: string
  /** Conference record (e.g. "28-14"); empty when the source doesn't provide it. */
  confRecord: string
}

async function getNBAStandingsFromStats(season: string): Promise<NBAStandingsTeam[] | null> {
  const data = await fetchNbaStats(
    `leaguestandingsv3?LeagueID=00&Season=${season}&SeasonType=Regular+Season`,
    3600,
    `nba-standings-${season}`
  )
  if (!data) return null
  const rows = getResultRows(data, 'Standings')
  if (rows.length === 0) return null

  return rows.map((r): NBAStandingsTeam => {
    const teamId = n(r.TeamID)
    return {
      abbr: s(pick(r, 'TeamAbbreviation')) || nbaAbbrFromTeamId(teamId),
      teamId,
      conference: s(r.Conference) === 'West' ? 'West' : 'East',
      division: s(r.Division),
      wins: n(r.WINS),
      losses: n(r.LOSSES),
      winPct: n(pick(r, 'WinPCT', 'WIN_PCT')),
      home: s(pick(r, 'HOME')) || '0-0',
      away: s(pick(r, 'ROAD', 'AWAY')) || '0-0',
      last10: s(pick(r, 'L10')) || '0-0',
      streak: s(pick(r, 'strCurrentStreak', 'CurrentStreak')) || '—',
      gamesBack: s(pick(r, 'ConferenceGamesBack')) || '-',
      confRecord: s(pick(r, 'ConferenceRecord')),
    }
  })
}

async function getNBAStandingsFromBdl(season: string): Promise<NBAStandingsTeam[] | null> {
  const seasonYear = Number(season.slice(0, 4))
  const data = await fetchBdl<{ data: BdlStandingRow[] }>(`/standings?season=${seasonYear}`, 3600, `nba-bdl-standings-${seasonYear}`)
  if (!data) return null
  return data.data.map((r) => ({
    abbr: r.team.abbreviation,
    teamId: r.team.id,
    conference: r.team.conference === 'West' ? 'West' : 'East',
    division: r.team.division,
    wins: r.wins,
    losses: r.losses,
    winPct: r.wins + r.losses > 0 ? Math.round((r.wins / (r.wins + r.losses)) * 1000) / 1000 : 0,
    home: r.home_record ?? '0-0',
    away: r.road_record ?? '0-0',
    last10: '—',
    streak: '—',
    gamesBack: '-',
    confRecord: '',
  }))
}

/** Full-league NBA standings (both conferences). ESPN → stats.nba.com → balldontlie (paid tier only) → null. */
export async function getNBAStandings(season: string = NBA_CURRENT_SEASON): Promise<NBAStandingsTeam[] | null> {
  const fromEspn = await espnNbaStandings(season)
  if (fromEspn) return fromEspn
  const fromStats = await getNBAStandingsFromStats(season)
  if (fromStats) {
    console.log('[nba] standings: ESPN unavailable, served by stats.nba.com')
    return fromStats
  }
  const fromBdl = await getNBAStandingsFromBdl(season)
  if (fromBdl) console.log('[nba] standings: served by balldontlie fallback')
  return fromBdl
}

// ---------------------------------------------------------------------------
// League-wide player season stats (per-game averages) — backs leaders, player pages, breakdown
// ---------------------------------------------------------------------------

export interface NBAPlayerSeasonStats {
  playerId: number
  name: string
  teamAbbr: string
  teamId: number
  position: string
  gamesPlayed: number
  min: number
  pts: number
  reb: number
  oreb: number
  dreb: number
  ast: number
  stl: number
  blk: number
  tov: number
  fgPct: number
  fg3m: number
  fg3Pct: number
  ftPct: number
  plusMinus: number
}

let playerStatsCache: { season: string; data: NBAPlayerSeasonStats[]; fetchedAt: number } | null = null
const playerStatsInFlight = new Map<string, Promise<NBAPlayerSeasonStats[] | null>>()

async function getAllNBAPlayerSeasonStatsFromStats(season: string): Promise<NBAPlayerSeasonStats[] | null> {
  const data = await fetchNbaStats(
    `leaguedashplayerstats?Season=${season}&SeasonType=Regular+Season&PerMode=PerGame&MeasureType=Base&LeagueID=00`,
    3600,
    `nba-player-stats-${season}`
  )
  if (!data) return null
  const rows = getResultRows(data, 'LeagueDashPlayerStats')
  if (rows.length === 0) return null

  return rows.map((r): NBAPlayerSeasonStats => ({
    playerId: n(r.PLAYER_ID),
    name: s(r.PLAYER_NAME),
    teamAbbr: s(r.TEAM_ABBREVIATION),
    teamId: n(r.TEAM_ID),
    position: '',
    gamesPlayed: n(r.GP),
    min: n(r.MIN),
    pts: n(r.PTS),
    reb: n(r.REB),
    oreb: n(r.OREB),
    dreb: n(r.DREB),
    ast: n(r.AST),
    stl: n(r.STL),
    blk: n(r.BLK),
    tov: n(r.TOV),
    fgPct: n(r.FG_PCT),
    fg3m: n(r.FG3M),
    fg3Pct: n(r.FG3_PCT),
    ftPct: n(r.FT_PCT),
    plusMinus: n(r.PLUS_MINUS),
  }))
}

async function getAllNBAPlayerSeasonStatsFromBdl(season: string): Promise<NBAPlayerSeasonStats[] | null> {
  const seasonYear = Number(season.slice(0, 4))
  const data = await fetchBdl<{ data: (BdlSeasonAverage & { player?: BdlPlayer })[] }>(
    `/season_averages?season=${seasonYear}`,
    3600,
    `nba-bdl-player-stats-${seasonYear}`
  )
  if (!data) return null
  return data.data.map((r) => ({
    playerId: r.player_id,
    name: r.player ? `${r.player.first_name} ${r.player.last_name}` : `Player ${r.player_id}`,
    teamAbbr: r.player?.team.abbreviation ?? '',
    teamId: r.player?.team.id ?? 0,
    position: r.player?.position ?? '',
    gamesPlayed: r.games_played,
    min: Number(r.min) || 0,
    pts: r.pts,
    reb: r.reb,
    oreb: 0,
    dreb: 0,
    ast: r.ast,
    stl: r.stl,
    blk: r.blk,
    tov: r.turnover,
    fgPct: r.fg_pct,
    fg3m: 0,
    fg3Pct: r.fg3_pct,
    ftPct: r.ft_pct,
    plusMinus: 0,
  }))
}

/** All players' season averages, cached in-process for 1h (this one bulk call backs Leaders, player pages, and lineup cards). */
/**
 * Deduplicates concurrent cache-miss callers (e.g. several breakdown tabs fetching at once) onto
 * a single in-flight request, instead of each firing its own full stats.nba.com retry/fallback
 * chain — a thundering-herd fix, the same principle used for the Defense tab's league-wide DRTG scan.
 */
export async function getAllNBAPlayerSeasonStats(season: string = NBA_CURRENT_SEASON): Promise<NBAPlayerSeasonStats[] | null> {
  if (playerStatsCache && playerStatsCache.season === season && Date.now() - playerStatsCache.fetchedAt < 3600 * 1000) {
    return playerStatsCache.data
  }

  const existing = playerStatsInFlight.get(season)
  if (existing) return existing

  const request = (async () => {
    let result = await espnNbaPlayerStats(season)
    if (!result) {
      result = await getAllNBAPlayerSeasonStatsFromStats(season)
      if (result) console.log('[nba] player stats: ESPN unavailable, served by stats.nba.com')
    }
    if (!result) {
      result = await getAllNBAPlayerSeasonStatsFromBdl(season)
      if (result) console.log('[nba] player stats: served by balldontlie fallback')
    }
    if (result) playerStatsCache = { season, data: result, fetchedAt: Date.now() }
    return result
  })()

  playerStatsInFlight.set(season, request)
  try {
    return await request
  } finally {
    playerStatsInFlight.delete(season)
  }
}

export async function getNBAPlayerStats(playerId: number, season: string = NBA_CURRENT_SEASON): Promise<NBAPlayerSeasonStats | null> {
  const all = await getAllNBAPlayerSeasonStats(season)
  return all?.find((p) => p.playerId === playerId) ?? null
}

const NBA_LEADER_STAT_FIELD: Record<string, keyof NBAPlayerSeasonStats> = {
  PTS: 'pts', REB: 'reb', AST: 'ast', STL: 'stl', BLK: 'blk',
  'FG%': 'fgPct', '3P%': 'fg3Pct', 'FT%': 'ftPct', MIN: 'min', TO: 'tov',
}

export interface NBALeaderRow {
  rank: number
  playerId: number
  name: string
  teamAbbr: string
  value: number
  display: string
}

/** Top 15 players in a stat category, minimum 10 games played to qualify. */
export async function getNBALeagueLeaders(stat: string, season: string = NBA_CURRENT_SEASON): Promise<NBALeaderRow[] | null> {
  const all = await getAllNBAPlayerSeasonStats(season)
  if (!all) return null
  const field = NBA_LEADER_STAT_FIELD[stat] ?? 'pts'
  const ascending = field === 'tov'
  const qualified = all.filter((p) => p.gamesPlayed >= 10)
  const sorted = [...qualified]
    .sort((a, b) => (ascending ? Number(a[field]) - Number(b[field]) : Number(b[field]) - Number(a[field])))
    .slice(0, 15)
  const isPct = field === 'fgPct' || field === 'fg3Pct' || field === 'ftPct'

  return sorted.map((p, i) => ({
    rank: i + 1,
    playerId: p.playerId,
    name: p.name,
    teamAbbr: p.teamAbbr,
    value: p[field] as number,
    display: isPct ? `${((p[field] as number) * 100).toFixed(1)}%` : (p[field] as number).toFixed(1),
  }))
}

// ---------------------------------------------------------------------------
// Player game log
// ---------------------------------------------------------------------------

export interface NBAPlayerGameLogRow {
  gameId: string
  gameDate: string
  matchup: string
  opponentAbbr: string
  isHome: boolean
  wl: 'W' | 'L' | null
  min: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  tov: number
  fg3m: number
  fgPct: number
}

function parseOpponent(matchup: string): { opponentAbbr: string; isHome: boolean } {
  const isHome = matchup.includes(' vs. ')
  const parts = matchup.split(isHome ? ' vs. ' : ' @ ')
  return { opponentAbbr: (parts[1] ?? '').trim(), isHome }
}

async function getNBAPlayerGameLogFromStats(playerId: number, season: string): Promise<NBAPlayerGameLogRow[] | null> {
  const data = await fetchNbaStats(
    `playergamelogs?Season=${season}&SeasonType=Regular+Season&PlayerID=${playerId}`,
    season === NBA_CURRENT_SEASON ? 86400 : 604800,
    `nba-player-gamelog-${playerId}-${season}`
  )
  if (!data) return null
  const rows = getResultRows(data, 'PlayerGameLogs')
  return rows.map((r): NBAPlayerGameLogRow => {
    const matchup = s(r.MATCHUP)
    const { opponentAbbr, isHome } = parseOpponent(matchup)
    return {
      gameId: s(r.GAME_ID),
      gameDate: s(r.GAME_DATE),
      matchup,
      opponentAbbr,
      isHome,
      wl: s(r.WL) === 'W' ? 'W' : s(r.WL) === 'L' ? 'L' : null,
      min: n(r.MIN),
      pts: n(r.PTS),
      reb: n(r.REB),
      ast: n(r.AST),
      stl: n(r.STL),
      blk: n(r.BLK),
      tov: n(r.TOV),
      fg3m: n(r.FG3M),
      fgPct: n(r.FG_PCT),
    }
  })
}

/** A player's full-season game log (used for last-N tables and threshold hit rates). */
export async function getNBAPlayerGameLog(playerId: number, season: string = NBA_CURRENT_SEASON): Promise<NBAPlayerGameLogRow[] | null> {
  // ESPN-sourced players carry negated ids (see espnFallback); anything else is a stats.nba.com id.
  if (playerId < 0) return espnNbaPlayerGameLog(playerId, season)
  return getNBAPlayerGameLogFromStats(playerId, season)
}

// ---------------------------------------------------------------------------
// Team stats (base + advanced)
// ---------------------------------------------------------------------------

export interface NBATeamStats {
  teamId: number
  abbr: string
  gamesPlayed: number
  pts: number
  oppPts: number
  fgPct: number
  fg3Pct: number
  ftPct: number
  reb: number
  ast: number
  tov: number
  oppTov: number
  pace: number | null
  offRtg: number | null
  defRtg: number | null
  wins: number
  losses: number
}

let teamStatsCache: { season: string; data: NBATeamStats[]; fetchedAt: number } | null = null
const teamStatsInFlight = new Map<string, Promise<NBATeamStats[] | null>>()

export async function getAllNBATeamStats(season: string = NBA_CURRENT_SEASON): Promise<NBATeamStats[] | null> {
  if (teamStatsCache && teamStatsCache.season === season && Date.now() - teamStatsCache.fetchedAt < 3600 * 1000) {
    return teamStatsCache.data
  }

  const existing = teamStatsInFlight.get(season)
  if (existing) return existing

  const request = fetchAllNBATeamStats(season)
  teamStatsInFlight.set(season, request)
  try {
    return await request
  } finally {
    teamStatsInFlight.delete(season)
  }
}

/** Real offensive/defensive rating and pace from stats.nba.com — the one thing ESPN's feed only lets us estimate. Null while that host is down. */
async function advancedFromStats(season: string): Promise<Map<string, { pace: number; offRtg: number; defRtg: number }> | null> {
  const data = await fetchNbaStats(
    `leaguedashteamstats?Season=${season}&SeasonType=Regular+Season&PerMode=PerGame&MeasureType=Advanced&LeagueID=00`,
    3600,
    `nba-team-adv-${season}`
  )
  const rows = getResultRows(data, 'LeagueDashTeamStats')
  if (rows.length === 0) return null
  return new Map(rows.map((r) => [s(r.TEAM_ABBREVIATION), { pace: n(r.PACE), offRtg: n(r.OFF_RATING), defRtg: n(r.DEF_RATING) }]))
}

async function fetchAllNBATeamStats(season: string): Promise<NBATeamStats[] | null> {
  const fromEspn = await espnNbaTeamStats(season)
  if (fromEspn) {
    // stats.nba.com only supplies advanced metrics here; if it is blocked the circuit breaker answers instantly and ESPN's estimates stand.
    const adv = await advancedFromStats(season).catch(() => null)
    const merged = adv ? fromEspn.map((t) => ({ ...t, ...(adv.get(t.abbr) ?? {}) })) : fromEspn
    teamStatsCache = { season, data: merged, fetchedAt: Date.now() }
    return merged
  }
  const fromStats = await fetchAllNBATeamStatsFromStats(season)
  if (fromStats) console.log('[nba] team stats: ESPN unavailable, served by stats.nba.com')
  return fromStats
}

async function fetchAllNBATeamStatsFromStats(season: string): Promise<NBATeamStats[] | null> {
  const [baseData, advData, oppData] = await Promise.all([
    fetchNbaStats(`leaguedashteamstats?Season=${season}&SeasonType=Regular+Season&PerMode=PerGame&MeasureType=Base&LeagueID=00`, 3600, `nba-team-base-${season}`),
    fetchNbaStats(`leaguedashteamstats?Season=${season}&SeasonType=Regular+Season&PerMode=PerGame&MeasureType=Advanced&LeagueID=00`, 3600, `nba-team-adv-${season}`),
    fetchNbaStats(`leaguedashteamstats?Season=${season}&SeasonType=Regular+Season&PerMode=PerGame&MeasureType=Opponent&LeagueID=00`, 3600, `nba-team-opp-${season}`),
  ])
  if (!baseData) return null

  const baseRows = getResultRows(baseData, 'LeagueDashTeamStats')
  if (baseRows.length === 0) return null
  const advRows = getResultRows(advData, 'LeagueDashTeamStats')
  const oppRows = getResultRows(oppData, 'LeagueDashTeamStats')

  const result = baseRows.map((r): NBATeamStats => {
    const teamId = n(r.TEAM_ID)
    const adv = advRows.find((a) => n(a.TEAM_ID) === teamId)
    const opp = oppRows.find((o) => n(o.TEAM_ID) === teamId)
    return {
      teamId,
      abbr: s(r.TEAM_ABBREVIATION),
      gamesPlayed: n(r.GP),
      pts: n(r.PTS),
      oppPts: opp ? n(pick(opp, 'OPP_PTS')) : 0,
      fgPct: n(r.FG_PCT),
      fg3Pct: n(r.FG3_PCT),
      ftPct: n(r.FT_PCT),
      reb: n(r.REB),
      ast: n(r.AST),
      tov: n(r.TOV),
      oppTov: opp ? n(pick(opp, 'OPP_TOV')) : 0,
      pace: adv ? n(adv.PACE) : null,
      offRtg: adv ? n(adv.OFF_RATING) : null,
      defRtg: adv ? n(adv.DEF_RATING) : null,
      wins: n(r.W),
      losses: n(r.L),
    }
  })

  teamStatsCache = { season, data: result, fetchedAt: Date.now() }
  return result
}

/** One team's offensive/defensive season stats (base + advanced, PerGame). */
export async function getNBATeamStats(teamId: number, season: string = NBA_CURRENT_SEASON): Promise<NBATeamStats | null> {
  const all = await getAllNBATeamStats(season)
  return all?.find((t) => t.teamId === teamId) ?? null
}

export async function getNBATeamStatsByAbbr(abbr: string, season: string = NBA_CURRENT_SEASON): Promise<NBATeamStats | null> {
  return getNBATeamStats(NBA_TEAM_IDS[abbr] ?? 0, season)
}

// ---------------------------------------------------------------------------
// Box score
// ---------------------------------------------------------------------------

export interface NBABoxScorePlayer {
  personId: number
  name: string
  position: string
  starter: boolean
  min: string
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  tov: number
  fg3m: number
}

export interface NBABoxScoreTeam {
  teamId: number
  abbr: string
  score: number
  players: NBABoxScorePlayer[]
}

export interface NBABoxScore {
  gameId: string
  home: NBABoxScoreTeam
  away: NBABoxScoreTeam
}

interface RawBoxScoreV3Player {
  personId: number
  firstName: string
  familyName: string
  position?: string
  starter?: string
  statistics?: {
    minutes?: string
    points?: number
    reboundsTotal?: number
    assists?: number
    steals?: number
    blocks?: number
    turnovers?: number
    threePointersMade?: number
  }
}

interface RawBoxScoreV3Team {
  teamId: number
  teamTricode: string
  score: number
  players: RawBoxScoreV3Player[]
}

interface RawBoxScoreV3Response {
  boxScoreTraditional?: {
    gameId: string
    homeTeam: RawBoxScoreV3Team
    awayTeam: RawBoxScoreV3Team
  }
}

function mapBoxTeam(t: RawBoxScoreV3Team): NBABoxScoreTeam {
  return {
    teamId: t.teamId,
    abbr: t.teamTricode,
    score: t.score,
    players: (t.players ?? []).map((p) => ({
      personId: p.personId,
      name: `${p.firstName} ${p.familyName}`,
      position: p.position ?? '',
      starter: p.starter === '1',
      min: p.statistics?.minutes ?? '0:00',
      pts: p.statistics?.points ?? 0,
      reb: p.statistics?.reboundsTotal ?? 0,
      ast: p.statistics?.assists ?? 0,
      stl: p.statistics?.steals ?? 0,
      blk: p.statistics?.blocks ?? 0,
      tov: p.statistics?.turnovers ?? 0,
      fg3m: p.statistics?.threePointersMade ?? 0,
    })),
  }
}

/** Live/final box score for a game (v3 endpoint — nested shape, not resultSets). */
export async function getNBABoxScore(gameId: string): Promise<NBABoxScore | null> {
  if (isEspnGameId(gameId)) return espnNbaBoxScore(gameId)
  const url = `boxscoretraditionalv3?GameID=${gameId}&StartPeriod=0&EndPeriod=10&StartRange=0&EndRange=55800&RangeType=0`
  const data = (await fetchNbaStats(url, 60, `nba-boxscore-${gameId}`)) as unknown as RawBoxScoreV3Response | null
  const box = data?.boxScoreTraditional
  if (!box) return null

  return {
    gameId: box.gameId,
    home: mapBoxTeam(box.homeTeam),
    away: mapBoxTeam(box.awayTeam),
  }
}

// ---------------------------------------------------------------------------
// Team game log (rest-day calc, Summary/Trends last-N games)
// ---------------------------------------------------------------------------

export interface NBATeamGameLogRow {
  gameId: string
  gameDate: string
  matchup: string
  opponentAbbr: string
  isHome: boolean
  wl: 'W' | 'L' | null
  pts: number
  oppPts: number
  reb: number
  ast: number
  tov: number
  fg3Pct: number
}

export async function getNBATeamGameLog(teamId: number, season: string = NBA_CURRENT_SEASON): Promise<NBATeamGameLogRow[] | null> {
  const fromEspn = await espnNbaTeamGameLog(nbaAbbrFromTeamId(teamId), season)
  if (fromEspn) return fromEspn
  const data = await fetchNbaStats(
    `teamgamelogs?Season=${season}&SeasonType=Regular+Season&TeamID=${teamId}`,
    86400,
    `nba-team-gamelog-${teamId}-${season}`
  )
  if (!data) return null
  const rows = getResultRows(data, 'TeamGameLogs')
  return rows.map((r): NBATeamGameLogRow => {
    const matchup = s(r.MATCHUP)
    const { opponentAbbr, isHome } = parseOpponent(matchup)
    return {
      gameId: s(r.GAME_ID),
      gameDate: s(r.GAME_DATE),
      matchup,
      opponentAbbr,
      isHome,
      wl: s(r.WL) === 'W' ? 'W' : s(r.WL) === 'L' ? 'L' : null,
      pts: n(r.PTS),
      oppPts: n(r.PTS) - n(r.PLUS_MINUS),
      reb: n(r.REB),
      ast: n(r.AST),
      tov: n(r.TOV),
      fg3Pct: n(r.FG3_PCT),
    }
  })
}

export interface NBARestInfo {
  daysRest: number | null
  backToBack: boolean
}

export async function getNBATeamRestInfo(teamId: number, asOfDate: string, season: string = NBA_CURRENT_SEASON): Promise<NBARestInfo> {
  const log = await getNBATeamGameLog(teamId, season)
  if (!log || log.length === 0) return { daysRest: null, backToBack: false }
  const sorted = [...log].sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
  const lastGame = sorted.find((g) => new Date(g.gameDate).getTime() < new Date(asOfDate).getTime())
  if (!lastGame) return { daysRest: null, backToBack: false }
  const daysRest = Math.round((new Date(asOfDate).getTime() - new Date(lastGame.gameDate).getTime()) / (24 * 60 * 60 * 1000)) - 1
  return { daysRest: Math.max(0, daysRest), backToBack: daysRest <= 0 }
}

export type { NbaStatsResponse }
export { NBA_TEAM_NAMES }
