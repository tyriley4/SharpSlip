'use client'

import { useEffect, useState } from 'react'
import type { LeaderRow } from '@/data/leaders/types'
import type { Sport } from '@/lib/sport/SportContext'

/**
 * Game-stat leaderboard for a non-Season window (Last 30/14/7, Career) on NFL, NBA and NHL — recomputed
 * server-side from game logs. Season boards come pre-built, so this stays idle (`enabled: false`) for them.
 */
export function useWindowedLeaders({
  sport,
  sub,
  category,
  window,
  enabled,
}: {
  sport: Exclude<Sport, 'mlb'>
  sub: string
  category: string
  window: string
  enabled: boolean
}) {
  const key = `${sport}|${sub}|${category}|${window}`
  const [cache, setCache] = useState<Record<string, LeaderRow[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!enabled || !category || cache[key]) return
    let cancelled = false
    setLoading(true)
    setError(false)

    fetch(`/api/game-leaders?${new URLSearchParams({ sport, sub, category, window }).toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((data: { rows: LeaderRow[] }) => {
        if (!cancelled) setCache((prev) => ({ ...prev, [key]: data.rows }))
      })
      .catch((err) => {
        console.error('[useWindowedLeaders] fetch failed', err)
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key])

  return { rows: enabled ? (cache[key] ?? null) : null, loading: enabled && loading && !cache[key], error: enabled && error && !cache[key] }
}
