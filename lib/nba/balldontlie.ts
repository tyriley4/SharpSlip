// Fallback data source used only when stats.nba.com is unreachable. Requires the user's own
// free API key (stats.nba.com's usage terms don't allow redistributing a shared key). Returns
// null immediately if no key is configured — callers fall through to the next source.
//
// The free tier only serves teams, players and games (5 requests/minute). Standings, season
// averages, stats and box scores answer 401, so those routes are remembered as paid-only and skipped
// instead of being re-tried (and re-logged) on every page view; a 429 pauses all calls for a minute.
const BASE = 'https://api.balldontlie.io/v1'

const lastGood = new Map<string, unknown>()
const state = globalThis as unknown as { __bdlPaidOnly?: Map<string, number>; __bdlCoolUntil?: number }
const paidOnly = (state.__bdlPaidOnly ??= new Map<string, number>())
const PAID_MEMO_MS = 24 * 3600 * 1000

const routeOf = (path: string) => path.split('?')[0]

export async function fetchBdl<T>(path: string, revalidateSeconds: number, cacheKey: string): Promise<T | null> {
  const apiKey = process.env.BALLDONTLIE_API_KEY
  if (!apiKey) return null
  if ((paidOnly.get(routeOf(path)) ?? 0) > Date.now()) return null
  if ((state.__bdlCoolUntil ?? 0) > Date.now()) return (lastGood.get(cacheKey) as T | undefined) ?? null

  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: apiKey },
      next: { revalidate: revalidateSeconds },
      signal: AbortSignal.timeout(10000),
    })
    if (res.status === 401 || res.status === 403) {
      paidOnly.set(routeOf(path), Date.now() + PAID_MEMO_MS)
      console.warn(`[balldontlie] ${routeOf(path)} needs a paid plan (HTTP ${res.status}) — skipping it for 24h`)
      return null
    }
    if (res.status === 429) state.__bdlCoolUntil = Date.now() + 60_000
    if (!res.ok) throw new Error(`status ${res.status}`)
    const json = (await res.json()) as T
    lastGood.set(cacheKey, json)
    return json
  } catch (err) {
    console.error(`[balldontlie] "${cacheKey}" failed: ${BASE}${path}`, err)
    const fallback = lastGood.get(cacheKey)
    if (fallback !== undefined) return fallback as T
    return null
  }
}

export interface BdlTeam {
  id: number
  abbreviation: string
  city: string
  name: string
  full_name: string
  conference: string
  division: string
}

export interface BdlGame {
  id: number
  date: string
  season: number
  status: string
  period: number
  time: string | null
  postseason: boolean
  home_team: BdlTeam
  home_team_score: number
  visitor_team: BdlTeam
  visitor_team_score: number
}

export interface BdlPlayer {
  id: number
  first_name: string
  last_name: string
  position: string
  team: BdlTeam
}

export interface BdlSeasonAverage {
  player_id: number
  games_played: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  turnover: number
  fg_pct: number
  fg3_pct: number
  ft_pct: number
  min: string
}

export interface BdlStandingRow {
  team: BdlTeam
  wins: number
  losses: number
  conference_rank: number
  division_rank: number
  home_record: string
  road_record: string
}
