/**
 * Maps over items with at most `limit` concurrent in-flight calls. Firing 30-70 concurrent
 * fetches at one external API (as a naive Promise.all over "every team" / "every notable player"
 * does) can queue behind that origin's connection pool and stall well past any individual
 * per-request timeout — this bounds the fan-out so requests actually run promptly in waves.
 */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0

  async function worker() {
    while (true) {
      const i = next++
      if (i >= items.length) return
      results[i] = await fn(items[i], i)
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

/**
 * Races a promise against a timeout, returning `fallback` if it doesn't settle in time. Used to
 * hard-bound aggregations that fan out across several external, rate-limited sports APIs — if one
 * leg misbehaves under heavy concurrent load, the whole feature degrades gracefully instead of
 * hanging the page indefinitely.
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer!)
  }
}
