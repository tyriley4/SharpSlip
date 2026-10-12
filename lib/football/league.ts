import fs from 'node:fs'
import path from 'node:path'
import { getCollegeDirectory } from '@/lib/college/directory'
import { getGameSummary, getScoreboard, getTeamRoster, type EspnLeagueSlug, type GameSummary } from '@/lib/espn/api'

/**
 * League-wide football game rows built from ESPN box scores.
 *
 * ESPN's league-wide player stat tables are unreliable for college football, but every finished game's
 * box score is complete. This module walks the season's finished games once, keeps one compact row per
 * player per game (plus team rows), and persists them. After the first build, each refresh only fetches
 * games that finished since. Leaders, betting hit rates, national ranks and player pages all read from here.
 */

export type FootballLeague = Extract<EspnLeagueSlug, 'college-football' | 'nfl'>

export interface TeamLine {
  teamId: string
  abbr: string
  score: number
  rank: number | null
  /** Team box stats (totalYards, netPassingYards, rushingYards, turnovers, …). */
  stats: Record<string, string>
}

export interface PlayerGameRow {
  gameId: string
  date: string
  week: number | null
  playerId: string
  name: string
  teamId: string
  team: string
  oppId: string
  opp: string
  oppRank: number | null
  home: boolean
  result: 'W' | 'L' | 'T'
  // passing
  comp?: number
  att?: number
  pyds?: number
  ptd?: number
  int?: number
  // rushing
  car?: number
  ryds?: number
  rtd?: number
  // receiving
  rec?: number
  recyds?: number
  rectd?: number
  tgts?: number
  // defense
  tot?: number
  sacks?: number
  tfl?: number
  pd?: number
  dint?: number
  /** NFL extras: sacks taken / yards lost (passers), solo tackles, fumbles lost, fumble recoveries. */
  sk?: number
  skYds?: number
  solo?: number
  fumLost?: number
  fumRec?: number
  ff?: number
}

export interface LeagueGameRecord {
  eventId: string
  date: string
  week: number | null
  neutral: boolean
  home: TeamLine
  away: TeamLine
  line: { homeSpread: number | null; total: number | null } | null
}

export interface LeagueData {
  league: FootballLeague
  season: number
  games: LeagueGameRecord[]
  rows: PlayerGameRow[]
  /** player id → roster position (QB/RB/WR/TE/…), where known. */
  positions: Record<string, string>
  /** True while the background build is still walking games. */
  building: boolean
  progress: { done: number; total: number }
}

interface Stored {
  season: number
  games: LeagueGameRecord[]
  rows: PlayerGameRow[]
  positions: Record<string, string>
  /** Epoch ms of the last completed refresh. */
  refreshedAt: number
  /** Positions are rebuilt separately, at most daily. */
  positionsAt: number
}

const DIR = path.join(process.cwd(), '.data')
const file = (league: FootballLeague, season: number) => path.join(DIR, `league-${league}-${season}.json`)

type Job = { promise: Promise<void>; progress: { done: number; total: number } }
const g = globalThis as unknown as { __sharpslipLeague?: { stores: Map<string, Stored>; jobs: Map<string, Job> } }
const mem = (g.__sharpslipLeague ??= { stores: new Map(), jobs: new Map() })

const num = (v: string | undefined) => {
  const x = Number(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(x) ? x : 0
}
const frac = (v: string | undefined): [number, number] => {
  const [a, b] = String(v ?? '0/0').split('/')
  return [num(a), num(b)]
}

function load(league: FootballLeague, season: number): Stored {
  const key = `${league}:${season}`
  let s = mem.stores.get(key)
  if (!s) {
    try {
      s = JSON.parse(fs.readFileSync(file(league, season), 'utf8')) as Stored
    } catch {
      s = { season, games: [], rows: [], positions: {}, refreshedAt: 0, positionsAt: 0 }
    }
    mem.stores.set(key, s)
  }
  return s
}

function save(league: FootballLeague, season: number) {
  try {
    fs.mkdirSync(DIR, { recursive: true })
    fs.writeFileSync(file(league, season), JSON.stringify(load(league, season)))
  } catch (err) {
    console.error('[league] persist failed', (err as Error).message)
  }
}

function col(labels: string[], ...names: string[]): number {
  for (const n of names) {
    const i = labels.indexOf(n)
    if (i >= 0) return i
  }
  return -1
}

/** One finished game → its game record plus a row per player who recorded a stat. */
export function digest(s: GameSummary): { game: LeagueGameRecord; rows: PlayerGameRow[] } | null {
  const home = s.teams.find((t) => t.homeAway === 'home')
  const away = s.teams.find((t) => t.homeAway === 'away')
  if (!home || !away || home.score === null || away.score === null || s.state !== 'post') return null
  const line = (t: typeof home): TeamLine => ({ teamId: t.id, abbr: t.abbr, score: t.score ?? 0, rank: t.rank, stats: s.teamStats[t.id] ?? {} })
  const rows: PlayerGameRow[] = []

  for (const t of [home, away]) {
    const opp = t === home ? away : home
    const byId = new Map<string, PlayerGameRow>()
    const row = (id: string, name: string): PlayerGameRow => {
      let r = byId.get(id)
      if (!r) {
        r = {
          gameId: s.gameId,
          date: s.date ?? '',
          week: s.week,
          playerId: id,
          name,
          teamId: t.id,
          team: t.abbr,
          oppId: opp.id,
          opp: opp.abbr,
          oppRank: opp.rank,
          home: t === home,
          result: (t.score ?? 0) > (opp.score ?? 0) ? 'W' : (t.score ?? 0) < (opp.score ?? 0) ? 'L' : 'T',
        }
        byId.set(id, r)
      }
      return r
    }
    for (const grp of s.players[t.id] ?? []) {
      const L = grp.labels
      for (const a of grp.athletes) {
        const st = a.stats
        if (grp.name === 'passing') {
          const [comp, att] = frac(st[col(L, 'C/ATT')])
          const r = row(a.id, a.name)
          r.comp = comp; r.att = att; r.pyds = num(st[col(L, 'YDS')]); r.ptd = num(st[col(L, 'TD')]); r.int = num(st[col(L, 'INT')])
          const sk = col(L, 'SACKS')
          if (sk >= 0) {
            const [n, y] = String(st[sk] ?? '0-0').split('-')
            r.sk = num(n); r.skYds = num(y)
          }
        } else if (grp.name === 'rushing') {
          const r = row(a.id, a.name)
          r.car = num(st[col(L, 'CAR')]); r.ryds = num(st[col(L, 'YDS')]); r.rtd = num(st[col(L, 'TD')])
        } else if (grp.name === 'receiving') {
          const r = row(a.id, a.name)
          r.rec = num(st[col(L, 'REC')]); r.recyds = num(st[col(L, 'YDS')]); r.rectd = num(st[col(L, 'TD')])
          const ti = col(L, 'TGTS')
          if (ti >= 0) r.tgts = num(st[ti])
        } else if (grp.name === 'defensive') {
          const r = row(a.id, a.name)
          r.tot = num(st[col(L, 'TOT')]); r.sacks = num(st[col(L, 'SACKS')]); r.tfl = num(st[col(L, 'TFL')]); r.pd = num(st[col(L, 'PD')])
          const so = col(L, 'SOLO')
          if (so >= 0) r.solo = num(st[so])
        } else if (grp.name === 'fumbles') {
          const r = row(a.id, a.name)
          r.fumLost = num(st[col(L, 'LOST')]); r.fumRec = num(st[col(L, 'REC')])
        } else if (grp.name === 'interceptions') {
          const r = row(a.id, a.name)
          r.dint = num(st[col(L, 'INT')])
        }
      }
    }
    rows.push(...Array.from(byId.values()))
  }

  return {
    game: { eventId: s.gameId, date: s.date ?? '', week: s.week, neutral: s.neutralSite, home: line(home), away: line(away), line: s.odds ? { homeSpread: s.odds.homeSpread, total: s.odds.total } : null },
    rows,
  }
}

async function pool<T>(items: T[], size: number, fn: (t: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn))
}

function seasonYear(): number {
  const now = new Date()
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
}

async function refresh(league: FootballLeague, season: number, job: Job['progress']) {
  const store = load(league, season)
  const dir = league === 'college-football' ? await getCollegeDirectory('cfb') : null
  const known = new Set(store.games.map((x) => x.eventId))

  // 1. Walk the weeks up to the current one and collect finished games.
  const first = await getScoreboard('football', league, undefined, { ttl: 60 })
  const currentWeek = first?.week ?? 1
  const wanted: string[] = []
  for (let wk = 1; wk <= currentWeek; wk++) {
    const board = await getScoreboard('football', league, undefined, { week: wk, seasonType: 2, ttl: wk === currentWeek ? 120 : 6 * 3600 })
    for (const game of board?.games ?? []) {
      if (game.state !== 'post' || known.has(game.id)) continue
      // College: keep games with at least one FBS team so FCS non-conference games don't swamp the build.
      if (dir && !dir.byId.has(game.home.id) && !dir.byId.has(game.away.id)) continue
      wanted.push(game.id)
    }
  }
  job.total = known.size + wanted.length
  job.done = known.size
  console.log(`[league] ${league} ${season}: ${known.size} games on disk, fetching ${wanted.length} more`)

  let sinceSave = 0
  await pool(wanted, 8, async (id) => {
    const summary = await getGameSummary('football', league, id)
    const d = summary ? digest(summary) : null
    if (d) {
      store.games.push(d.game)
      store.rows.push(...d.rows)
      sinceSave++
    }
    job.done++
    if (sinceSave >= 25) {
      sinceSave = 0
      save(league, season)
    }
  })

  // 2. Positions from rosters (box scores don't carry them), refreshed daily.
  if (Date.now() - store.positionsAt > 86400 * 1000) {
    const teamIds = Array.from(new Set(store.games.flatMap((x) => [x.home.teamId, x.away.teamId])))
    await pool(teamIds, 8, async (tid) => {
      const roster = await getTeamRoster('football', league, tid).catch(() => null)
      for (const p of roster?.players ?? []) if (p.position) store.positions[p.id] = p.position
    })
    store.positionsAt = Date.now()
  }
  store.refreshedAt = Date.now()
  save(league, season)
  console.log(`[league] ${league} ${season}: ${store.games.length} games, ${store.rows.length} player rows`)
}

const REFRESH_MS = 20 * 60 * 1000

/**
 * League data, from disk/memory immediately. If it's stale a background refresh starts (one at a time) and
 * `building`/`progress` say so; callers show whatever exists plus a "still building" note.
 */
export function getLeagueData(league: FootballLeague = 'college-football', season: number = seasonYear()): LeagueData {
  const store = load(league, season)
  const key = `${league}:${season}`
  let job = mem.jobs.get(key)
  if (!job && Date.now() - store.refreshedAt > REFRESH_MS) {
    const progress = { done: store.games.length, total: store.games.length }
    const promise = refresh(league, season, progress)
      .catch((err) => console.error(`[league] ${league} refresh failed`, err))
      .finally(() => mem.jobs.delete(key))
    job = { promise, progress }
    mem.jobs.set(key, job)
  }
  return { league, season, games: store.games, rows: store.rows, positions: store.positions, building: !!job, progress: job?.progress ?? { done: store.games.length, total: store.games.length } }
}

/** Resolves once any in-flight build finishes (used by warm-up routes and tests). */
export async function whenLeagueReady(league: FootballLeague = 'college-football', season: number = seasonYear(), maxMs = 120000): Promise<LeagueData> {
  const first = getLeagueData(league, season)
  const job = mem.jobs.get(`${league}:${season}`)
  if (job) await Promise.race([job.promise, new Promise((r) => setTimeout(r, maxMs))])
  return getLeagueData(league, season)
}
