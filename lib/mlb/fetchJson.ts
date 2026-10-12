import { reportError } from '@/lib/monitoring/sentry'
const lastGood = new Map<string, unknown>()

/**
 * Fetches JSON with Next.js cache semantics, and falls back to the last
 * successful response (in-memory, per server process) if the request fails.
 * Returns null only when there is no cached fallback to fall back to.
 */
export async function fetchJson<T>(url: string, revalidateSeconds: number, cacheKey: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: revalidateSeconds } })
    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`)
    }
    const json = (await res.json()) as T
    lastGood.set(cacheKey, json)
    return json
  } catch (err) {
    reportError(err, 'mlb')
    console.error(`[fetchJson] "${cacheKey}" failed: ${url}`, err)
    const fallback = lastGood.get(cacheKey)
    if (fallback !== undefined) {
      console.warn(`[fetchJson] "${cacheKey}" serving last-known-good cached data`)
      return fallback as T
    }
    return null
  }
}
