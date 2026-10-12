import { reportError } from '@/lib/monitoring/sentry'
// stats.nba.com blocks requests that don't carry these two extra headers (undocumented in NBA's
// own materials, but required — confirmed by direct testing and consistent with the open-source
// `nba_api` community's findings). Without them the server accepts the TLS handshake and then
// never responds, so requests just hang until timeout instead of failing fast.
const NBA_STATS_HEADERS: Record<string, string> = {
  Host: 'stats.nba.com',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Connection: 'keep-alive',
  Referer: 'https://www.nba.com/',
  Origin: 'https://www.nba.com',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
}

export interface NbaResultSet {
  name: string
  headers: string[]
  rowSet: (string | number | null)[][]
}

export interface NbaStatsResponse {
  resultSets?: NbaResultSet[]
  resultSet?: NbaResultSet
}

const lastGood = new Map<string, NbaStatsResponse>()

/**
 * Circuit breaker. stats.nba.com tends to be down in long stretches (it blocks cloud/datacenter IPs), and
 * every call to a dead host costs a full timeout. After a failed call we skip the host for a few minutes
 * and let callers fall straight through to balldontlie / ESPN.
 */
const BREAKER_MS = 3 * 60 * 1000
const breaker = globalThis as unknown as { __nbaStatsDownUntil?: number }
export function nbaStatsIsDown(): boolean {
  return (breaker.__nbaStatsDownUntil ?? 0) > Date.now()
}

async function fetchOnce(url: string, revalidateSeconds: number, timeoutMs: number): Promise<NbaStatsResponse> {
  const res = await fetch(url, {
    headers: NBA_STATS_HEADERS,
    next: { revalidate: revalidateSeconds },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`status ${res.status}`)
  return (await res.json()) as NbaStatsResponse
}

/**
 * Fetches a stats.nba.com endpoint. Retries once after a short delay (the API is aggressively
 * rate-limited and single transient failures are common), then falls back to the last
 * successful response for this key, then null. Callers should treat null as "try balldontlie.io
 * next, then show an unavailable state" — never crash on it.
 */
export async function fetchNbaStats(path: string, revalidateSeconds: number, cacheKey: string): Promise<NbaStatsResponse | null> {
  const url = `https://stats.nba.com/stats/${path}`
  if (nbaStatsIsDown()) {
    const fallback = lastGood.get(cacheKey)
    if (fallback) return fallback
    return null
  }
  try {
    const json = await fetchOnce(url, revalidateSeconds, 8000)
    lastGood.set(cacheKey, json)
    return json
  } catch (err) {
    reportError(err, 'nba')
    // One quick retry only for rate limiting; timeouts and 5xx mean the host is down, so trip the breaker.
    const rateLimited = /status 429/.test(String(err))
    console.error(`[nba-stats] "${cacheKey}" failed: ${url} — ${(err as Error).message}`)
    if (rateLimited) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1500))
        const json = await fetchOnce(url, revalidateSeconds, 8000)
        lastGood.set(cacheKey, json)
        return json
      } catch {
        // fall through to the breaker below
      }
    }
    breaker.__nbaStatsDownUntil = Date.now() + BREAKER_MS
    console.warn(`[nba-stats] marking stats.nba.com down for ${BREAKER_MS / 60000} min — using balldontlie / ESPN fallbacks`)
    const fallback = lastGood.get(cacheKey)
    if (fallback) {
      console.warn(`[nba-stats] "${cacheKey}" serving last-known-good cached data`)
      return fallback
    }
    return null
  }
}

/** Converts one resultSet's rowSet (parallel-array rows) into an array of keyed objects. */
export function rowsToObjects(rs: NbaResultSet | undefined): Record<string, string | number | null>[] {
  if (!rs) return []
  return rs.rowSet.map((row) => {
    const obj: Record<string, string | number | null> = {}
    rs.headers.forEach((h, i) => {
      obj[h] = row[i]
    })
    return obj
  })
}

export function getResultSet(data: NbaStatsResponse | null, name: string): NbaResultSet | undefined {
  if (!data) return undefined
  if (data.resultSets) return data.resultSets.find((r) => r.name === name)
  if (data.resultSet?.name === name) return data.resultSet
  return undefined
}

export function getResultRows(data: NbaStatsResponse | null, name: string): Record<string, string | number | null>[] {
  return rowsToObjects(getResultSet(data, name))
}
