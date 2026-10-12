'use client'

import { useEffect, useState } from 'react'
import type { NFLLiveState } from '@/lib/nfl/liveBreakdown'

const POLL_LIVE_MS = 30_000
const POLL_IDLE_MS = 120_000

function kickoffText(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function RealNFLLiveTab({ awayAbbr, homeAbbr, url }: { awayAbbr: string; homeAbbr: string; /** Override for leagues with their own live route (college football). */ url?: string }) {
  const [state, setState] = useState<NFLLiveState | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    async function load() {
      let next: NFLLiveState | null = null
      try {
        const res = await fetch(url ?? `/api/nfl-breakdown/live?away=${awayAbbr}&home=${homeAbbr}`)
        if (!res.ok) throw new Error(`status ${res.status}`)
        next = (await res.json()) as NFLLiveState
        if (!cancelled) setState(next)
      } catch (err) {
        console.error('[RealNFLLiveTab] fetch failed', err)
      }
      // Poll fast only while the game is actually in progress.
      if (!cancelled) timer = setTimeout(load, next?.state === 'in' ? POLL_LIVE_MS : POLL_IDLE_MS)
    }

    load()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [awayAbbr, homeAbbr, url])

  if (!state) {
    return (
      <div className="px-3.5 pt-3 md:px-8 md:pt-5">
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
          Checking live status…
        </div>
      </div>
    )
  }

  const live = state.state === 'in'
  const final = state.state === 'post'

  return (
    <div className="flex flex-col gap-4 px-3.5 pt-3 md:px-8 md:pt-5">
      {state.available ? (
        <div className={`rounded-2xl border p-4 text-center ${live ? 'border-negative/25 bg-negative/[0.06]' : 'border-border bg-card'}`}>
          <div className="mb-2 flex items-center justify-center gap-2">
            {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-negative" />}
            <span className={`text-[9px] font-extrabold tracking-[0.1em] ${live ? 'text-negative' : 'text-muted'}`}>{live ? 'LIVE' : final ? 'FINAL' : 'UPCOMING'}</span>
            {state.network && <span className="rounded-md border border-border px-1.5 py-0.5 text-[9px] font-bold text-text2">📺 {state.network}</span>}
          </div>

          {state.state === 'pre' ? (
            <>
              <div className="mb-1 text-xl font-black text-text">
                {awayAbbr} @ {homeAbbr}
              </div>
              <div className="text-[11px] text-muted">Kickoff {kickoffText(state.kickoff)}</div>
              {(state.awayRecord || state.homeRecord) && (
                <div className="mt-1 text-[10px] text-muted">
                  {awayAbbr} {state.awayRecord ?? '—'} · {homeAbbr} {state.homeRecord ?? '—'}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="stat-number mb-1 text-2xl text-text">
                {awayAbbr} {state.awayScore ?? '—'} — {state.homeScore ?? '—'} {homeAbbr}
              </div>
              <div className="text-[12px] font-semibold text-text2">
                {state.statusDetail ?? (state.period ? `Q${state.period}` : '')}
              </div>
            </>
          )}

          {live && (state.possession || state.downDistance) && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {state.possession && <span className="rounded-full bg-card3 px-2.5 py-1 text-[10px] font-bold text-text">🏈 {state.possession} ball</span>}
              {state.downDistance && <span className="rounded-full bg-card3 px-2.5 py-1 text-[10px] font-bold text-text2">{state.downDistance}</span>}
              {state.isRedZone && <span className="rounded-full bg-loss/15 px-2.5 py-1 text-[10px] font-extrabold text-loss">RED ZONE</span>}
            </div>
          )}
          {live && state.lastPlay && <p className="mx-auto mt-3 max-w-[520px] text-[11px] leading-relaxed text-muted">Last play: {state.lastPlay}</p>}
          {state.venue && <div className="mt-3 text-[10px] text-muted">{state.venue}</div>}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <div className="mb-2 text-2xl">🏈</div>
          <div className="mb-1 text-sm font-bold text-text">Live scores updating — check back</div>
          <p className="mx-auto max-w-[420px] text-xs leading-relaxed text-muted">{state.reason}</p>
        </div>
      )}

      <div className="rounded-[10px] border border-accent/25 bg-accent/[0.06] p-3 text-center text-[10px] leading-relaxed text-accent">{state.reason}</div>
    </div>
  )
}
