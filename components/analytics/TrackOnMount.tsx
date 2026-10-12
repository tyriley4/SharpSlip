'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { trackEvent } from '@/lib/analytics/posthog'

/** Sport from a /games/... path: /games/nba/ID, /games/cfb/ID; bare numeric ids are MLB and nflverse ids (2026_05_TB_DAL) are NFL. */
function sportFromPath(path: string): string {
  const seg = path.split('/').filter(Boolean)
  if (seg[0] === 'games' && seg[1] && ['nba', 'nhl', 'cfb', 'cbb'].includes(seg[1])) return seg[1]
  if (seg[0] === 'games' && seg[1]?.includes('_')) return 'nfl'
  return 'mlb'
}

/** Fires one analytics event when it mounts. Renders nothing. */
export function TrackOnMount({ event, properties, gameFromPath }: { event: string; properties?: Record<string, unknown>; gameFromPath?: boolean }) {
  const pathname = usePathname()
  useEffect(() => {
    const extra = gameFromPath ? { sport: properties?.sport ?? sportFromPath(pathname), gameId: pathname.split('/').filter(Boolean).pop() } : {}
    trackEvent(event, { ...properties, ...extra })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
