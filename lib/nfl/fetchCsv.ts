import * as zlib from 'zlib'
import { parseCsv } from './csv'
import { reportError } from '@/lib/monitoring/sentry'

// nflverse CSV releases can exceed Next.js's built-in fetch-cache size ceiling (2MB), so these
// large assets are cached manually here (by TTL) instead of via `next: { revalidate }`.
const cache = new Map<string, { data: Record<string, string>[]; fetchedAt: number }>()
const lastGood = new Map<string, Record<string, string>[]>()
// Remembers recent failures (e.g. a 404 for a season file that isn't published yet) so a missing
// asset isn't re-requested on every call.
const failedAt = new Map<string, number>()
const FAILURE_BACKOFF_MS = 5 * 60 * 1000

async function fetchWithFallback(
  url: string,
  revalidateSeconds: number,
  cacheKey: string,
  parse: (buf: ArrayBuffer) => Record<string, string>[]
): Promise<Record<string, string>[] | null> {
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt < revalidateSeconds * 1000) {
    return cached.data
  }

  const lastFailure = failedAt.get(cacheKey)
  if (lastFailure && Date.now() - lastFailure < FAILURE_BACKOFF_MS) {
    return lastGood.get(cacheKey) ?? null
  }

  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`)
    }
    const buf = await res.arrayBuffer()
    const rows = parse(buf)
    cache.set(cacheKey, { data: rows, fetchedAt: Date.now() })
    lastGood.set(cacheKey, rows)
    failedAt.delete(cacheKey)
    return rows
  } catch (err) {
    reportError(err, 'nfl')
    failedAt.set(cacheKey, Date.now())
    console.error(`[nflverse] "${cacheKey}" failed: ${url}`, err)
    const fallback = lastGood.get(cacheKey)
    if (fallback) {
      console.warn(`[nflverse] "${cacheKey}" serving last-known-good cached data`)
      return fallback
    }
    return null
  }
}

/** Fetches a plain (uncompressed) nflverse CSV release asset. */
export function fetchCsv(url: string, revalidateSeconds: number, cacheKey: string) {
  return fetchWithFallback(url, revalidateSeconds, cacheKey, (buf) =>
    parseCsv(Buffer.from(buf).toString('utf8'))
  )
}

/** Fetches a gzip-compressed nflverse CSV release asset (nextgen stats are only published as .csv.gz). */
export function fetchCsvGz(url: string, revalidateSeconds: number, cacheKey: string) {
  return fetchWithFallback(url, revalidateSeconds, cacheKey, (buf) => {
    const text = zlib.gunzipSync(Buffer.from(buf)).toString('utf8')
    return parseCsv(text)
  })
}
