'use client'

import Link from 'next/link'
import { trackEvent } from '@/lib/analytics/posthog'

/**
 * Whole-card link that can coexist with links inside the card (anchors can't nest). Place it as the
 * first child of a `relative` card; give the card's content `pointer-events-none` and any inner link
 * `relative z-10 pointer-events-auto`. `track` records an analytics event when the card is clicked.
 */
export function CardOverlayLink({
  href,
  label,
  onClick,
  track,
}: {
  href: string
  label: string
  onClick?: () => void
  track?: { event: string; properties?: Record<string, unknown> }
}) {
  return (
    <Link
      href={href}
      onClick={() => {
        if (track) trackEvent(track.event, track.properties)
        onClick?.()
      }}
      aria-label={label}
      className="absolute inset-0 z-0 rounded-[14px]"
    />
  )
}
