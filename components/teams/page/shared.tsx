'use client'

import type { ReactNode } from 'react'
import type { GameResult, Tone } from '@/lib/teams/types'

export const GREEN = '#00E5A0'
export const RED = '#EF4444'
export const AMBER = '#FFB800'
export const WHITE = '#F0F2F5'

export const toneColor = (t: Tone) => (t === 'good' ? GREEN : t === 'bad' ? RED : WHITE)

export function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="section-header text-sm text-text md:text-base">{title}</h3>
      {right}
    </div>
  )
}

export const resultColor = (r: GameResult | null) => (r === 'W' ? GREEN : r === 'L' ? RED : r === 'OTL' ? AMBER : '#8B909A')

export function ResultBadge({ result }: { result: GameResult | null }) {
  if (!result) return <span className="text-muted">—</span>
  const c = resultColor(result)
  return (
    <span className="inline-flex min-w-[28px] justify-center rounded-md px-1.5 py-0.5 text-[11px] font-extrabold" style={{ color: c, background: `${c}1F` }}>
      {result}
    </span>
  )
}

export function pctColor(pct: number | null): string {
  if (pct === null) return '#8B909A'
  return pct > 55 ? GREEN : pct < 45 ? RED : WHITE
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-xs leading-relaxed text-muted">{children}</div>
}

/** Table shell with the app's alternating row tint. */
export function Table({ head, children, grid }: { head: string[]; children: ReactNode; grid: string }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-border">
      <div className="grid items-center gap-2 border-b border-border bg-card3 px-3 py-2 text-[9px] font-extrabold uppercase tracking-[0.08em] text-muted" style={{ gridTemplateColumns: grid }}>
        {head.map((h) => (
          <div key={h}>{h}</div>
        ))}
      </div>
      {children}
    </div>
  )
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatTime(iso: string | null): string {
  if (!iso) return 'TBD'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'TBD'
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
