'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { combinedProb, formatProb, probTone } from '@/lib/parlay/math'
import { useParlay } from '@/lib/parlay/ParlayContext'
import type { SuggestedParlay } from '@/lib/parlay/suggest'
import { sportMeta } from '@/lib/sport/meta'
import type { Sport } from '@/lib/sport/SportContext'

interface LegRow {
  key: string
  sport: string
  label: string
  prob: number
}

function LegLine({ leg }: { leg: LegRow }) {
  const meta = sportMeta(leg.sport as Sport)
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-card3 px-2.5 py-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold" style={{ background: `${meta.color}22`, color: meta.color }}>
          {meta.icon}
        </span>
        <span className="truncate text-[11px] font-semibold text-text2">{leg.label}</span>
      </div>
      <span className="stat-number shrink-0 text-[11px] text-text">{Math.round(leg.prob)}%</span>
    </div>
  )
}

export function ParlayTeaser() {
  const { legs } = useParlay()
  const [suggested, setSuggested] = useState<SuggestedParlay | null | undefined>(undefined)

  const hasDraft = legs.length > 0

  useEffect(() => {
    if (hasDraft) return
    let cancelled = false
    fetch('/api/suggested-parlay')
      .then((res) => (res.ok ? res.json() : { parlay: null }))
      .then((data: { parlay: SuggestedParlay | null }) => {
        if (!cancelled) setSuggested(data.parlay ?? null)
      })
      .catch((err) => {
        console.error('[ParlayTeaser] suggestion fetch failed', err)
        if (!cancelled) setSuggested(null)
      })
    return () => {
      cancelled = true
    }
  }, [hasDraft])

  const draftProb = hasDraft ? combinedProb(legs.map((l) => l.prob)) : 0

  return (
    <div className="rounded-[14px] border border-accent/30 bg-card p-3.5">
      <h2 className="section-header mb-2.5 text-sm text-text">Parlay Builder</h2>

      {hasDraft ? (
        <div className="flex flex-col gap-2">
          {legs.slice(0, 3).map((l) => (
            <LegLine key={l.id} leg={{ key: l.id, sport: l.sport, label: l.label, prob: l.prob }} />
          ))}
          {legs.length > 3 && <div className="text-[10px] text-muted">+{legs.length - 3} more leg{legs.length - 3 !== 1 ? 's' : ''}</div>}
          <div className="mt-1 flex items-center justify-between rounded-lg bg-accent/10 px-2.5 py-1.5">
            <span className="text-[10px] text-muted">Combined probability</span>
            <span className="stat-number text-[13px]" style={{ color: probTone(draftProb).color }}>
              {formatProb(draftProb)}
            </span>
          </div>
          <Link href="/parlay" className="rounded-lg bg-accent px-3 py-2 text-center text-[11px] font-bold text-white">
            Open Parlay Builder →
          </Link>
        </div>
      ) : suggested === undefined ? (
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
          Loading suggestion…
        </div>
      ) : suggested === null ? (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] leading-relaxed text-muted">No suggested parlay yet today — build your own from the games on the slate.</p>
          <Link href="/parlay" className="rounded-lg bg-accent px-3 py-2 text-center text-[11px] font-bold text-white">
            Build Full Parlay →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-muted">Today&apos;s top suggested 2-leg parlay</p>
          {suggested.legs.map((l) => (
            <LegLine key={l.lineId} leg={{ key: l.lineId, sport: l.sport, label: `${l.matchup} — ${l.label}`, prob: l.prob }} />
          ))}
          <div className="mt-1 flex items-center justify-between rounded-lg bg-accent/10 px-2.5 py-1.5">
            <span className="text-[10px] text-muted">Combined probability</span>
            <span className="stat-number text-[13px]" style={{ color: probTone(suggested.prob).color }}>
              {formatProb(suggested.prob)}
            </span>
          </div>
          <Link href="/parlay" className="rounded-lg bg-accent px-3 py-2 text-center text-[11px] font-bold text-white">
            Build Full Parlay →
          </Link>
        </div>
      )}
    </div>
  )
}
