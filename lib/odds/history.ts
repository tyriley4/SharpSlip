import fs from 'node:fs'
import path from 'node:path'
import { fromEspnAbbr, toEspnAbbr } from '@/lib/espn/teams'
import { cached, fetchJsonSafe } from '@/lib/net/ttlCache'
import type { Sport } from '@/lib/sport/SportContext'

/**
 * Real closing lines for FINISHED games, from the odds block ESPN keeps on each game's summary
 * (DraftKings spread / total / moneyline). It is the only free source of historical lines, which is
 * what makes real against-the-spread and over/under records possible for MLB, NBA and NHL.
 *
 * Finished-game lines never change, so each one is fetched once and kept on disk forever.
 */

const BASE = 'https://site.api.espn.com/apis/site/v2/sports'
const PATH: Record<Sport, string> = {
  nfl: 'football/nfl',
  cfb: 'football/college-football',
  mlb: 'baseball/mlb',
  nba: 'basketball/nba',
  cbb: 'basketball/mens-college-basketball',
  nhl: 'hockey/nhl',
}

type Json = Record<string, any>

export interface ClosingLine {
  /** Home team's spread (negative = home favored). */
  homeSpread: number | null
  total: number | null
  homeMl: number | null
  awayMl: number | null
  provider: string
  /** True when ESPN had no odds for the game at all (cached so we don't ask again). */
  none?: boolean
}

export interface LinedGame {
  espnId: string
  date: string
  away: string
  home: string
  awayScore: number
  homeScore: number
  line: ClosingLine | null
}

const DIR = path.join(process.cwd(), '.data')
const FILE = path.join(DIR, 'closing-lines.json')

const g = globalThis as unknown as { __sharpslipClosing?: Record<string, ClosingLine> }

function store(): Record<string, ClosingLine> {
  if (!g.__sharpslipClosing) {
    try {
      g.__sharpslipClosing = JSON.parse(fs.readFileSync(FILE, 'utf8'))
    } catch {
      g.__sharpslipClosing = {}
    }
  }
  return g.__sharpslipClosing!
}

let flushTimer: ReturnType<typeof setTimeout> | null = null
function flushSoon() {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    try {
      fs.mkdirSync(DIR, { recursive: true })
      fs.writeFileSync(FILE, JSON.stringify(store()))
    } catch (err) {
      console.error('[odds-history] write failed', (err as Error).message)
    }
  }, 1500)
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return v === null || v === undefined || v === '' || !Number.isFinite(n) ? null : n
}

async function fetchClosing(sport: Sport, espnId: string): Promise<ClosingLine | null> {
  const res = await fetchJsonSafe<Json>(`${BASE}/${PATH[sport]}/summary?event=${espnId}`, { timeoutMs: 12000, cache: 'no-store' }, 'espn-history')
  if (!res) return null
  const picks: Json[] = res.data.pickcenter ?? []
  const p = picks.find((x) => /draftkings/i.test(x.provider?.name ?? '')) ?? picks[0]
  if (!p) return { homeSpread: null, total: null, homeMl: null, awayMl: null, provider: 'none', none: true }
  return {
    homeSpread: num(p.spread),
    total: num(p.overUnder),
    homeMl: num(p.homeTeamOdds?.moneyLine),
    awayMl: num(p.awayTeamOdds?.moneyLine),
    provider: p.provider?.name ?? 'ESPN',
  }
}

/** Closing line for one finished game (disk-cached). Null only when the lookup itself failed. */
export async function getClosingLine(sport: Sport, espnId: string): Promise<ClosingLine | null> {
  const key = `${sport}:${espnId}`
  const hit = store()[key]
  if (hit) return hit
  const line = await fetchClosing(sport, espnId)
  if (line) {
    store()[key] = line
    flushSoon()
  }
  return line
}

/** The team's finished regular-season games with scores (one ESPN schedule call, cached 6h). */
export async function getTeamResults(sport: Sport, abbr: string, season: number): Promise<Omit<LinedGame, 'line'>[] | null> {
  const slug = toEspnAbbr(sport, abbr).toLowerCase()
  return cached(`espn:teamsched:${sport}:${slug}:${season}`, 6 * 3600, async () => {
    const res = await fetchJsonSafe<Json>(`${BASE}/${PATH[sport]}/teams/${slug}/schedule?season=${season}&seasontype=2`, { timeoutMs: 12000, cache: 'no-store' }, 'espn-history')
    if (!res) return null
    const out: Omit<LinedGame, 'line'>[] = []
    for (const ev of (res.data.events as Json[] | undefined) ?? []) {
      const comp = ev.competitions?.[0]
      if (!comp || comp.status?.type?.state !== 'post') continue
      const cs: Json[] = comp.competitors ?? []
      const home = cs.find((c) => c.homeAway === 'home')
      const away = cs.find((c) => c.homeAway === 'away')
      const hs = num(home?.score?.value ?? home?.score)
      const as = num(away?.score?.value ?? away?.score)
      if (!home || !away || hs === null || as === null) continue
      out.push({
        espnId: String(ev.id),
        date: String(ev.date).slice(0, 10),
        away: fromEspnAbbr(sport, String(away.team?.abbreviation ?? '')),
        home: fromEspnAbbr(sport, String(home.team?.abbreviation ?? '')),
        awayScore: as,
        homeScore: hs,
      })
    }
    return out.sort((a, b) => a.date.localeCompare(b.date))
  })
}

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += size) {
    results.push(...(await Promise.all(items.slice(i, i + size).map(fn))))
  }
  return results
}

/**
 * A team's finished games joined to their closing lines. Looks up at most `maxNewLookups` uncached
 * games per call (newest first) so a cold page never blocks on 160 requests; the rest fill in on
 * later views because every lookup is kept.
 */
export async function getTeamLinedGames(sport: Sport, abbr: string, season: number, maxNewLookups = 40): Promise<LinedGame[] | null> {
  const results = await getTeamResults(sport, abbr, season)
  if (!results) return null
  const known = store()
  const missing = results.filter((r) => !known[`${sport}:${r.espnId}`]).reverse().slice(0, maxNewLookups)
  if (missing.length > 0) {
    console.log(`[odds-history] ${sport} ${abbr}: looking up ${missing.length} closing lines`)
    await pool(missing, 10, (r) => getClosingLine(sport, r.espnId))
  }
  return results.map((r) => ({ ...r, line: known[`${sport}:${r.espnId}`] && !known[`${sport}:${r.espnId}`].none ? known[`${sport}:${r.espnId}`] : null }))
}

// ---------------------------------------------------------------------------
// Records from lined games
// ---------------------------------------------------------------------------

export interface Tally {
  wins: number
  losses: number
  pushes: number
}

export interface LineRecords {
  /** Games that have a posted line, out of `games` finished games. */
  withLines: number
  games: number
  ats: Tally
  overUnder: { over: number; under: number; push: number }
  /** Same, over the last 5 and last 10 lined games. */
  last5: { ats: Tally; overUnder: { over: number; under: number; push: number } }
  last10: { ats: Tally; overUnder: { over: number; under: number; push: number } }
}

/** ATS / O-U for `abbr` across lined games (spread is stored from the home side, so flip it for the away team). */
export function lineRecords(games: LinedGame[], abbr: string): LineRecords {
  const mine = games.filter((g) => g.home === abbr || g.away === abbr)
  const empty = (): Tally => ({ wins: 0, losses: 0, pushes: 0 })
  const rec: LineRecords = {
    withLines: 0,
    games: mine.length,
    ats: empty(),
    overUnder: { over: 0, under: 0, push: 0 },
    last5: { ats: empty(), overUnder: { over: 0, under: 0, push: 0 } },
    last10: { ats: empty(), overUnder: { over: 0, under: 0, push: 0 } },
  }
  const lined = mine.filter((g) => g.line && (g.line.homeSpread !== null || g.line.total !== null))
  rec.withLines = lined.length
  lined.forEach((g, i, arr) => {
    const isHome = g.home === abbr
    const us = isHome ? g.homeScore : g.awayScore
    const them = isHome ? g.awayScore : g.homeScore
    const in5 = i >= arr.length - 5
    const in10 = i >= arr.length - 10
    if (g.line!.homeSpread !== null) {
      const teamSpread = isHome ? g.line!.homeSpread : -g.line!.homeSpread
      const m = us - them + teamSpread
      const bucket = m > 0 ? 'wins' : m < 0 ? 'losses' : 'pushes'
      rec.ats[bucket]++
      if (in5) rec.last5.ats[bucket]++
      if (in10) rec.last10.ats[bucket]++
    }
    if (g.line!.total !== null) {
      const t = us + them
      const bucket = t > g.line!.total! ? 'over' : t < g.line!.total! ? 'under' : 'push'
      rec.overUnder[bucket]++
      if (in5) rec.last5.overUnder[bucket]++
      if (in10) rec.last10.overUnder[bucket]++
    }
  })
  return rec
}


/** Minimum lined games before a record is shown as "real"; below this the UI keeps its labelled proxy. */
export const MIN_LINED_GAMES = 10

/** Real ATS / over-under records for a team, or null when too few of its games have a recorded closing line. */
export async function getRealLineRecords(sport: Sport, abbr: string, season: number): Promise<LineRecords | null> {
  try {
    const games = await getTeamLinedGames(sport, abbr, season)
    if (!games) return null
    const rec = lineRecords(games, abbr)
    return rec.withLines >= MIN_LINED_GAMES ? rec : null
  } catch (err) {
    console.error(`[odds-history] real records failed for ${sport} ${abbr}`, err)
    return null
  }
}
