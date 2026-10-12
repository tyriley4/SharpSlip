import { espnNflStatRows } from './espnRows'
import { withEspnResults } from './espnSchedule'
import { fetchCsv, fetchCsvGz } from './fetchCsv'

const RELEASES = 'https://github.com/nflverse/nflverse-data/releases/download'
/** nflverse moved the schedule out of the releases area; this is the maintained location (it also carries ESPN event ids). */
const SCHEDULE_URL = 'https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv'

type Row = Record<string, string>

/**
 * The NFL season in progress for a given date. A season spans late summer through the following
 * February, so January/February still belong to the previous year's season.
 */
export function getCurrentNFLSeason(now: Date = new Date()): number {
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
}

/**
 * Full schedule/results for a season (nflverse publishes all seasons combined in one file,
 * so we fetch once and filter). Revalidates hourly.
 */
export async function getNFLSchedule(season: number): Promise<Row[] | null> {
  const rows = await fetchCsv(SCHEDULE_URL, 3600, 'nfl-schedule-all')
  if (!rows) return null
  const mine = rows.filter((r) => r.season === String(season))
  return season === getCurrentNFLSeason() ? withEspnResults(mine, season) : mine
}

function hasPlayedGame(rows: Row[] | null): boolean {
  return !!rows && rows.some((r) => r.game_type === 'REG' && r.home_score !== '' && r.away_score !== '')
}

/**
 * The season the app should present as "current": this year's season once at least one of its
 * games has been played, otherwise the previous season (e.g. during the offseason or preseason).
 */
export async function getActiveNFLSeason(): Promise<number> {
  const current = getCurrentNFLSeason()
  return hasPlayedGame(await getNFLSchedule(current)) ? current : current - 1
}

// ---------------------------------------------------------------------------
// Player stats — nflverse "stats_player" release
// ---------------------------------------------------------------------------

// The release was reorganised: the old `player_stats` tag (separate offense/defense files) is
// gone. `stats_player` has one combined file per season (`_reg_` season totals, `_week_` per game)
// with renamed columns. Rows are normalised back to the field names the breakdown code reads.

const normalizedCache = new WeakMap<Row[], Row[]>()

function num(v: string | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function normalizeRows(rows: Row[]): Row[] {
  const cached = normalizedCache.get(rows)
  if (cached) return cached
  const out = rows.map((r) => {
    const team = r.recent_team || r.team || ''
    return {
      ...r,
      team,
      recent_team: team,
      interceptions: r.passing_interceptions ?? r.interceptions ?? '0',
      sacks: r.sacks_suffered ?? r.sacks ?? '0',
      sack_yards: r.sack_yards_lost ?? r.sack_yards ?? '0',
      def_tackles: String(num(r.def_tackles_solo) + num(r.def_tackle_assists)),
      def_fumble_recovery_opp: r.fumble_recovery_opp ?? r.def_fumble_recovery_opp ?? '0',
    }
  })
  normalizedCache.set(rows, out)
  return out
}

function hasDefenseStats(r: Row): boolean {
  return (
    num(r.def_tackles_solo) + num(r.def_tackle_assists) + num(r.def_sacks) + num(r.def_interceptions) + num(r.def_pass_defended) + num(r.def_tackles_for_loss) > 0 ||
    num(r.def_fumble_recovery_opp) + num(r.fumble_recovery_opp) > 0
  )
}

async function loadNflverseStatsPlayer(kind: 'reg' | 'week', season: number): Promise<{ rows: Row[]; season: number } | null> {
  for (const yr of [season, season - 1]) {
    const raw = await fetchCsv(`${RELEASES}/stats_player/stats_player_${kind}_${yr}.csv`, 86400, `nfl-stats-player-${kind}-${yr}`)
    // A 404 comes back as null; a published-but-empty file is treated the same way and falls back.
    if (raw && raw.length > 0) {
      return { rows: normalizeRows(raw).filter((r) => r.season_type === 'REG'), season: yr }
    }
  }
  return null
}

/**
 * Player stats for the season in progress come from ESPN box scores (available the moment a game ends); nflverse
 * supplies the advanced columns ESPN doesn't publish and is the fallback if ESPN has nothing yet. Earlier seasons
 * come from nflverse.
 */
const espnMemo = new Map<string, { at: number; value: { weekly: Row[]; season: Row[]; year: number } }>()

async function espnRowsFor(season: number): Promise<{ weekly: Row[]; season: Row[]; year: number } | null> {
  const hit = espnMemo.get(String(season))
  if (hit && Date.now() - hit.at < 60_000) return hit.value
  const nv = await loadNflverseStatsPlayer('week', season)
  const built = espnNflStatRows(nv && nv.season === season ? nv.rows : null, season)
  if (!built || built.weekly.length === 0) return null
  const value = { weekly: normalizeRows(built.weekly), season: normalizeRows(built.season), year: built.year }
  espnMemo.set(String(season), { at: Date.now(), value })
  return value
}

async function loadStatsPlayer(kind: 'reg' | 'week', season: number): Promise<{ rows: Row[]; season: number } | null> {
  if (season === getCurrentNFLSeason()) {
    const espn = await espnRowsFor(season)
    if (espn) return { rows: kind === 'week' ? espn.weekly : espn.season, season: espn.year }
  }
  return loadNflverseStatsPlayer(kind, season)
}

/** Season-aggregated player stats (regular season only), falling back a season if the file is missing/empty. */
export async function getNFLPlayerStats(season: number): Promise<Row[] | null> {
  return (await loadStatsPlayer('reg', season))?.rows ?? null
}

/** The season the player-stat files actually resolved to (may be `season - 1` if `season`'s file isn't published yet). */
export async function getNFLStatsSeason(season: number): Promise<number | null> {
  return (await loadStatsPlayer('reg', season))?.season ?? null
}

/** Season-aggregated defensive stats — defenders' rows from the combined player file. */
export async function getNFLDefenseStats(season: number): Promise<Row[] | null> {
  const rows = (await loadStatsPlayer('reg', season))?.rows
  return rows ? rows.filter(hasDefenseStats) : null
}

/**
 * Per-game (weekly) offensive player stats — one row per player per week, unlike
 * getNFLPlayerStats which is season-aggregated. Used for "last 5 games" tables and
 * game-log-derived hit rates.
 */
export async function getNFLWeeklyPlayerStats(season: number): Promise<Row[] | null> {
  return (await loadStatsPlayer('week', season))?.rows ?? null
}

/**
 * One specific season's weekly offensive stats, with no fallback to another year (Career stitches
 * several seasons together and must not double-count). Finished seasons cache for a week.
 */
export async function getNFLWeeklyPlayerStatsExact(season: number): Promise<Row[] | null> {
  const raw = await fetchCsv(
    `${RELEASES}/stats_player/stats_player_week_${season}.csv`,
    season < getCurrentNFLSeason() ? 604800 : 86400,
    `nfl-stats-player-week-${season}`
  )
  return raw && raw.length > 0 ? normalizeRows(raw).filter((r) => r.season_type === 'REG') : null
}

/** Per-game (weekly) defensive player stats. */
export async function getNFLWeeklyDefenseStats(season: number): Promise<Row[] | null> {
  const rows = (await loadStatsPlayer('week', season))?.rows
  return rows ? rows.filter(hasDefenseStats) : null
}

// ---------------------------------------------------------------------------
// Rosters / advanced stats
// ---------------------------------------------------------------------------

/** Full roster for a season, falling back a season if the file is missing/empty. Revalidates every 24h. */
export async function getNFLRosters(season: number): Promise<Row[] | null> {
  for (const yr of [season, season - 1]) {
    const rows = await fetchCsv(`${RELEASES}/rosters/roster_${yr}.csv`, 86400, `nfl-rosters-${yr}`)
    if (rows && rows.length > 0) return rows
  }
  return null
}

/**
 * Season-level Next Gen Stats for a position ('passing' | 'rushing' | 'receiving').
 * nflverse only publishes these as gzipped, all-seasons-combined files with per-week AND a
 * week=0 season-aggregate row per player — this keeps only the season-aggregate rows, and
 * falls back a season when the requested one has none yet. Revalidates every 24h.
 */
export async function getNFLAdvancedStats(position: 'passing' | 'rushing' | 'receiving', season: number): Promise<Row[] | null> {
  const rows = await fetchCsvGz(`${RELEASES}/nextgen_stats/ngs_${position}.csv.gz`, 86400, `nfl-ngs-${position}-all`)
  if (!rows) return null
  for (const yr of [season, season - 1]) {
    const seasonRows = rows.filter((r) => r.season === String(yr) && r.week === '0')
    if (seasonRows.length > 0) return seasonRows
  }
  return []
}
