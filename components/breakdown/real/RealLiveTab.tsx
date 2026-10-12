'use client'

import { useEffect, useState } from 'react'
import { PlayerLink } from '@/components/players/PlayerLink'
import type { LiveGameState } from '@/lib/mlb/liveBreakdown'

export function RealLiveTab({ gamePk, awayAbbr, homeAbbr }: { gamePk: number; awayAbbr: string; homeAbbr: string }) {
  const [state, setState] = useState<LiveGameState | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    function load() {
      fetch(`/api/breakdown/live?gamePk=${gamePk}`)
        .then((res) => {
          if (!res.ok) throw new Error(`status ${res.status}`)
          return res.json()
        })
        .then((json: LiveGameState) => {
          if (!cancelled) {
            setState(json)
            setError(false)
          }
        })
        .catch((err) => {
          console.error('[RealLiveTab] fetch failed', err)
          if (!cancelled) setError(true)
        })
    }

    load()
    const interval = setInterval(load, 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [gamePk])

  if (error && !state) {
    return (
      <div className="px-3.5 pt-3 md:px-8 md:pt-5">
        <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">Live data unavailable.</div>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="px-3.5 pt-3 md:px-8 md:pt-5">
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
          Loading live game state…
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 px-3.5 pt-3 md:px-8 md:pt-5">
      <div className="rounded-2xl border border-negative/25 bg-negative/[0.06] p-4 text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-negative" />
          <span className="text-[9px] font-extrabold tracking-[0.1em] text-negative">LIVE</span>
        </div>
        <div className="mb-1 text-2xl font-black text-text">
          {awayAbbr} {state.awayScore} — {state.homeScore} {homeAbbr}
        </div>
        <div className="text-[11px] text-muted">
          {state.inningState} {state.inning} · {state.outs} out{state.outs !== 1 ? 's' : ''} · {state.balls}-{state.strikes} count
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-muted">Current Pitcher</div>
          {state.currentPitcher ? (
            <>
              <PlayerLink name={state.currentPitcher.name} className="text-[12px] font-bold text-text hover:text-accent hover:underline">
                {state.currentPitcher.name}
              </PlayerLink>
              <div className="mt-1 text-[10px] text-text2">
                {state.currentPitcher.ip} IP · {state.currentPitcher.h} H · {state.currentPitcher.er} ER · {state.currentPitcher.k} K ·{' '}
                {state.currentPitcher.bb} BB
              </div>
            </>
          ) : (
            <div className="text-[11px] text-muted">—</div>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-muted">Current Batter</div>
          {state.currentBatter ? (
            <>
              <PlayerLink name={state.currentBatter.name} className="text-[12px] font-bold text-text hover:text-accent hover:underline">
                {state.currentBatter.name}
              </PlayerLink>
              <div className="mt-1 text-[10px] text-text2">
                {state.currentBatter.seasonAvg} AVG · {state.currentBatter.todaySummary}
              </div>
            </>
          ) : (
            <div className="text-[11px] text-muted">—</div>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">LAST 5 PLAYS</div>
        {state.lastPlays.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-4 text-center text-[11px] text-muted">No plays yet.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {state.lastPlays.map((p, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-2.5 text-[11px] leading-relaxed text-text2">
                {p}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">LIVE PROP TRACKER — 1+ HITS</div>
        {state.propTracker.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-4 text-center text-[11px] text-muted">No at-bats yet.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {state.propTracker.map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-card p-2.5">
                <span className="text-[11px] font-semibold text-text">
                  <PlayerLink name={p.name} className="hover:text-accent hover:underline">{p.name}</PlayerLink> <span className="text-[9px] font-normal text-muted">({p.team === 'away' ? awayAbbr : homeAbbr})</span>
                </span>
                <span className={`text-[10px] font-bold ${p.hits >= 1 ? 'text-positive' : 'text-muted'}`}>{p.note}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-[9px] text-muted">Auto-refreshing every 30 seconds</p>
    </div>
  )
}
