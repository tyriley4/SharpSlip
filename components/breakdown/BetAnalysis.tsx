'use client'

import { useEffect, useRef, useState } from 'react'

type State = { state: 'closed' } | { state: 'loading' } | { state: 'open'; text: string }

/**
 * The 📝 Analysis control: a labelled button that writes the explanation inline when tapped (a second tap hides it).
 * `text` is built from evidence already on the card, so tapping makes no request. Nothing renders without text.
 */
export function BetAnalysis({ text, className = '', stopPropagation = false }: { text: string | null | undefined | (() => string | null); className?: string; stopPropagation?: boolean }) {
  const [s, setS] = useState<State>({ state: 'closed' })
  const timer = useRef<number | null>(null)
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
  }, [])

  const resolve = () => (typeof text === 'function' ? text() : text)
  if (!text) return null

  function toggle(e: React.MouseEvent) {
    if (stopPropagation) e.stopPropagation()
    if (s.state !== 'closed') {
      setS({ state: 'closed' })
      return
    }
    setS({ state: 'loading' })
    timer.current = window.setTimeout(() => {
      const t = resolve()
      setS(t ? { state: 'open', text: t } : { state: 'closed' })
    }, 180)
  }

  return (
    <div className={className} onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={s.state === 'open'}
        className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-[11px] font-bold text-accent transition-colors hover:bg-accent/20"
      >
        <span aria-hidden="true">📝</span>
        {s.state === 'open' ? 'Hide analysis' : 'Analysis'}
      </button>
      {s.state === 'loading' && <p className="mt-2 text-[11px] text-muted">Generating analysis...</p>}
      {s.state === 'open' && (
        <div className="mt-2 rounded-xl border border-accent/25 bg-accent/[0.06] p-2.5">
          <div className="mb-1 text-[9px] font-extrabold tracking-[0.08em] text-accent">WRITTEN ANALYSIS</div>
          <p className="text-[11px] leading-relaxed text-text2">{s.text}</p>
        </div>
      )}
    </div>
  )
}
