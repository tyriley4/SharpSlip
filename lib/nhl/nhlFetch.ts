import { reportError } from '@/lib/monitoring/sentry'
// The NHL's api-web.nhle.com is a free, unauthenticated, well-documented JSON API — no special
// headers or auth needed (confirmed by direct testing). A second surface, api.nhle.com's REST
// reporting API, exposes team-level aggregate stats (PP%, PK%, etc.) not available on api-web.
const API_WEB_BASE = 'https://api-web.nhle.com/v1'
const STATS_REST_BASE = 'https://api.nhle.com/stats/rest/en'

/** Fetches an api-web.nhle.com/v1 endpoint. Never throws — callers treat null as "show unavailable state". */
export async function fetchNhlApiWeb<T>(path: string, revalidateSeconds: number): Promise<T | null> {
  try {
    const res = await fetch(`${API_WEB_BASE}${path}`, {
      next: { revalidate: revalidateSeconds },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`status ${res.status}`)
    return (await res.json()) as T
  } catch (err) {
    reportError(err, 'nhl')
    console.error(`[nhl-api] api-web fetch failed for "${path}":`, err)
    return null
  }
}

/** Fetches the api.nhle.com/stats/rest/en reporting API (team/skater/goalie season summaries). */
export async function fetchNhlStatsRest<T>(path: string, revalidateSeconds: number): Promise<T | null> {
  try {
    const res = await fetch(`${STATS_REST_BASE}${path}`, {
      next: { revalidate: revalidateSeconds },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`status ${res.status}`)
    return (await res.json()) as T
  } catch (err) {
    reportError(err, 'nhl')
    console.error(`[nhl-api] stats-rest fetch failed for "${path}":`, err)
    return null
  }
}
