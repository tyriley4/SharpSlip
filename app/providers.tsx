'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { initPostHog, trackPageView } from '@/lib/analytics/posthog'

/** Starts PostHog once and records a page view on every route change. Does nothing without a configured key. */
export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    initPostHog()
  }, [])

  useEffect(() => {
    if (pathname) trackPageView(pathname)
  }, [pathname])

  return <>{children}</>
}
