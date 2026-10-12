/**
 * Small in-process cache for upstream calls that are too large for Next's fetch cache (>2MB) or
 * that need their own source/credit bookkeeping. Survives dev hot-reloads via globalThis.
 *
 * Resolution order for every read: fresh cache → loader → stale cache (last known good) → null.
 * Concurrent callers for the same key share one in-flight load.
 */

interface Entry {
  value: unknown
  at: number
}

type CacheStore = { entries: Map<string, Entry>; inflight: Map<string, Promise<unknown>> }

const g = globalThis as unknown as { __sharpslipTtl?: CacheStore }
const store: CacheStore = (g.__sharpslipTtl ??= { entries: new Map(), inflight: new Map() })

export type CacheOrigin = 'fresh' | 'live' | 'stale' | 'none'

export interface CachedResult<T> {
  value: T | null
  origin: CacheOrigin
  /** Epoch ms the value was produced, or null when there is none. */
  at: number | null
}

/** A fixed lifetime in seconds, or a function of the cached value (e.g. shorter while a game is live). */
export type Ttl<T> = number | ((value: T) => number)

export async function cachedResult<T>(
  key: string,
  ttlSeconds: Ttl<T>,
  loader: () => Promise<T | null>,
  options: { maxStaleSeconds?: number } = {}
): Promise<CachedResult<T>> {
  const now = Date.now()
  const hit = store.entries.get(key)
  if (hit) {
    const ttl = typeof ttlSeconds === 'function' ? ttlSeconds(hit.value as T) : ttlSeconds
    if (now - hit.at < ttl * 1000) return { value: hit.value as T, origin: 'fresh', at: hit.at }
  }

  const running = store.inflight.get(key)
  if (running) {
    const value = (await running) as T | null
    const entry = store.entries.get(key)
    return { value, origin: value === null ? 'none' : 'live', at: entry?.at ?? null }
  }

  const promise = (async () => {
    try {
      const value = await loader()
      if (value !== null) store.entries.set(key, { value, at: Date.now() })
      return value
    } catch (err) {
      console.error(`[cache] loader for "${key}" threw`, err)
      return null
    }
  })()
  store.inflight.set(key, promise)
  try {
    const value = await promise
    if (value !== null) return { value, origin: 'live', at: store.entries.get(key)?.at ?? Date.now() }
  } finally {
    store.inflight.delete(key)
  }

  const maxStale = (options.maxStaleSeconds ?? 24 * 3600) * 1000
  if (hit && now - hit.at < maxStale) {
    console.warn(`[cache] "${key}" serving last-known-good value (${Math.round((now - hit.at) / 1000)}s old)`)
    return { value: hit.value as T, origin: 'stale', at: hit.at }
  }
  return { value: null, origin: 'none', at: null }
}

export async function cached<T>(key: string, ttlSeconds: Ttl<T>, loader: () => Promise<T | null>, options?: { maxStaleSeconds?: number }): Promise<T | null> {
  return (await cachedResult(key, ttlSeconds, loader, options)).value
}

/** Fetch JSON with a timeout; returns null (and logs) on any failure instead of throwing. */
export async function fetchJsonSafe<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}, tag = 'fetch'): Promise<{ data: T; headers: Headers; status: number } | null> {
  const { timeoutMs = 10000, ...rest } = init
  try {
    const res = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) {
      console.error(`[${tag}] ${res.status} ${redact(url)}`)
      return null
    }
    return { data: (await res.json()) as T, headers: res.headers, status: res.status }
  } catch (err) {
    console.error(`[${tag}] failed ${redact(url)}`, (err as Error)?.message ?? err)
    return null
  }
}

/** Strips API keys from URLs before they reach logs. */
export function redact(url: string): string {
  return url.replace(/([?&](?:apiKey|appid|api_key|key)=)[^&]+/gi, '$1***')
}
