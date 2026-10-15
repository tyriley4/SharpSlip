'use client'

import { useEffect, useState } from 'react'
import type { NflWindowPanel, NflWindowTab } from '@/lib/nfl/windowPanel'

export type NflLens = 'season' | 3 | 5 | 8

export const LENS_OPTIONS: { id: NflLens; label: string }[] = [
  { id: 'season', label: 'Full Season' },
  { id: 8, label: 'Last 8' },
  { id: 5, label: 'Last 5' },
  { id: 3, label: 'Last 3' },
]

export function lensLabel(lens: NflLens): string {
  return lens === 'season' ? 'Full Season' : `Last ${lens} game`
}

/** Chips that choose how many games the Passing / Rushing / Receiving / Defense tabs look back over. */
export function NflLensBar({ lens, onChange }: { lens: NflLens; onChange: (l: NflLens) => void }) {
  return (
    <div className="mx-3.5 mt-3 flex flex-wrap items-center gap-1.5 md:mx-8" role="group" aria-label="Time period">
      <span className="mr-1 text-[9px] font-extrabold tracking-[0.1em] text-muted">TIME PERIOD</span>
      {LENS_OPTIONS.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          aria-pressed={lens === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            lens === o.id ? 'border-accent bg-accent text-white' : 'border-border bg-card text-text2 hover:border-border2 hover:text-text'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function pct(w: number, s: number): number | null {
  return s > 0 ? Math.round(((w - s) / s) * 100) : null
}

function TeamWindow({ panel }: { panel: NflWindowPanel }) {
  return (
    <div className="flex-1 rounded-xl border border-border bg-card2 p-3">
      <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-muted">{panel.team}</div>
      {panel.subjects.length === 0 && <p className="text-[11px] text-muted">No game log in this window.</p>}
      {panel.subjects.map((s) => (
        <div key={s.name} className="mb-2 last:mb-0">
          <div className="text-[12px] font-bold text-text">
            {s.name} <span className="font-normal text-muted">· {s.games} of {s.seasonGames} games</span>
          </div>
          <div className="mt-1 grid grid-cols-[1fr_auto_auto_auto] gap-x-3 text-[10px] text-muted">
            <span>Per game</span>
            <span className="w-12 text-right">Window</span>
            <span className="w-12 text-right">Season</span>
            <span className="w-10 text-right">Δ</span>
          </div>
          {s.metrics.map((m) => {
            const d = pct(m.window, m.season)
            return (
              <div key={m.label} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 border-t border-border/60 py-1 text-[11px]">
                <span className="text-text2">{m.label}</span>
                <span className="stat-number w-12 text-right font-bold text-text">{m.window}</span>
                <span className="stat-number w-12 text-right text-muted">{m.season}</span>
                <span className={`w-10 text-right text-[10px] font-bold ${d === null ? 'text-muted' : d >= 15 ? 'text-positive' : d <= -15 ? 'text-negative' : 'text-muted'}`}>
                  {d === null ? '' : `${d >= 0 ? '+' : ''}${d}%`}
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** Both teams' players for the selected window beside their season averages. Renders nothing at the Full Season default. */
export function NflLensPanel({ gameId, tab, lens }: { gameId: string; tab: NflWindowTab; lens: NflLens }) {
  const [data, setData] = useState<{ key: string; away: NflWindowPanel | null; home: NflWindowPanel | null } | null>(null)
  const [failed, setFailed] = useState(false)
  const key = `${gameId}|${tab}|${lens}`

  useEffect(() => {
    if (lens === 'season') return
    let cancelled = false
    setFailed(false)
    const get = (team: 'away' | 'home') =>
      fetch(`/api/nfl-breakdown/window?gameId=${encodeURIComponent(gameId)}&team=${team}&tab=${tab}&games=${lens}`).then((r) => (r.ok ? (r.json() as Promise<NflWindowPanel>) : null))
    Promise.all([get('away'), get('home')])
      .then(([away, home]) => !cancelled && setData({ key, away, home }))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [gameId, tab, lens, key])

  if (lens === 'season') return null
  const ready = data?.key === key ? data : null
  return (
    <div className="mx-3.5 mt-3 md:mx-8">
      <div className="mb-1.5 text-[10px] font-bold text-muted">
        {lensLabel(lens)}s vs full season. Each player&apos;s own most recent games; the tab below stays on the full season.
      </div>
      {failed ? (
        <p className="text-[11px] text-muted">This time period is unavailable right now.</p>
      ) : !ready ? (
        <p className="text-[11px] text-muted">Calculating…</p>
      ) : (
        <div className="flex flex-col gap-2 md:flex-row">
          {ready.away && <TeamWindow panel={ready.away} />}
          {ready.home && <TeamWindow panel={ready.home} />}
        </div>
      )}
    </div>
  )
}
