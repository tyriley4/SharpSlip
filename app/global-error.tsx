'use client'

import { useEffect } from 'react'
import { reportError } from '@/lib/monitoring/sentry'

/** Last-resort boundary for errors in the root layout itself (inline styles: the app's CSS may not have loaded). */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    reportError(error, 'global-error')
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#08090C', color: '#E8EAF0', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 360, textAlign: 'center', background: '#111318', border: '1px solid #1F2229', borderRadius: 16, padding: 24 }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>Something went wrong loading this section.</div>
            <p style={{ color: '#8B909A', fontSize: 12, margin: '6px 0 0' }}>Try refreshing the page.</p>
            <button onClick={() => window.location.reload()} style={{ marginTop: 20, background: '#3B9EFF', color: '#fff', border: 0, borderRadius: 999, padding: '8px 24px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              Refresh
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
