'use client'

import { useEffect } from 'react'
import { reportError } from '@/lib/monitoring/sentry'

/** Dark recovery card shown by the route error boundaries: never a bare React error screen. */
export function SectionError({ error, area }: { error: Error & { digest?: string }; area: string }) {
  useEffect(() => {
    console.error(`[${area}]`, error)
    reportError(error, area)
  }, [error, area])

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center">
        <div className="mb-3 text-3xl">⚠️</div>
        <div className="text-sm font-black text-text">Something went wrong loading this section.</div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">Try refreshing the page.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-5 rounded-full bg-accent px-6 py-2 text-[12px] font-bold text-white shadow-[0_0_12px_rgba(59,158,255,0.3)] transition-opacity hover:opacity-90"
        >
          Refresh
        </button>
      </div>
    </div>
  )
}
