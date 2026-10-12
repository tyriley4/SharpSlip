'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ColdCard, HotCard } from '@/components/ui/Cards'
import { PlayerLink } from '@/components/players/PlayerLink'
import { TeamLink } from '@/components/teams/TeamLink'
import { MOVER_WINDOWS, type CondensedMover, type MoverWindow } from '@/lib/home/movers'
import { sportMeta } from '@/lib/sport/meta'
import type { Sport } from '@/lib/sport/SportContext'

function MoverRow({ mover }: { mover: CondensedMover }) {
  const meta = sportMeta(mover.sport)
  const Wrapper = mover.isHot ? HotCard : ColdCard
  return (
    <Wrapper className="flex items-center justify-between !p-2.5">
      <div className="flex items-center gap-2">
        <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold" style={{ background: `${meta.color}22`, color: meta.color }}>
          {meta.icon}
        </span>
        <div>
          <PlayerLink name={mover.player} team={mover.team} className="text-[11px] font-bold text-text hover:text-accent hover:underline">
            {mover.player}
          </PlayerLink>
          <div className="stat-number text-[9px] text-muted">
            <TeamLink sport={mover.sport} abbr={mover.team} className="hover:text-accent hover:underline">
              {mover.team}
            </TeamLink>{' '}
            · {mover.value}
          </div>
        </div>
      </div>
      <div className={`stat-number flex items-center gap-1 text-[12px] font-extrabold ${mover.isHot ? 'text-hot' : 'text-cold'}`}>
        <span>{mover.isHot ? '▲' : '▼'}</span>
        <span>
          {mover.changePct !== null ? `${mover.changePct > 0 ? '+' : ''}${mover.changePct}%` : '—'}
        </span>
      </div>
    </Wrapper>
  )
}

export function MoversCondensed({
  initialData,
  sportFilter,
}: {
  initialData: { hot: CondensedMover[]; cold: CondensedMover[] }
  sportFilter: Sport | 'all'
}) {
  const [window, setWindow] = useState<MoverWindow>('7D')
  const [cache, setCache] = useState<Record<MoverWindow, { hot: CondensedMover[]; cold: CondensedMover[] }>>({ '7D': initialData, '14D': initialData, '30D': initialData })
  const [seeded, setSeeded] = useState<Set<MoverWindow>>(new Set<MoverWindow>(['7D']))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (seeded.has(window)) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/home-movers?window=${window}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((data: { hot: CondensedMover[]; cold: CondensedMover[] }) => {
        if (cancelled) return
        setCache((prev) => ({ ...prev, [window]: data }))
        setSeeded((prev) => new Set(prev).add(window))
      })
      .catch((err) => console.error('[MoversCondensed] fetch failed', err))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [window, seeded])

  const data = cache[window]
  const hot = sportFilter === 'all' ? data.hot : data.hot.filter((m) => m.sport === sportFilter)
  const cold = sportFilter === 'all' ? data.cold : data.cold.filter((m) => m.sport === sportFilter)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="section-header text-sm text-text md:text-base">Hot and Cold</h2>
        <div className="flex gap-1">
          {MOVER_WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition-colors ${window === w ? 'border-accent bg-accent text-white' : 'border-border text-muted'}`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-10 text-xs text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
          Loading movers…
        </div>
      ) : (
        <div className="grid grid-cols-2 items-stretch gap-2 md:gap-3">
          <div className="flex flex-col">
            <div className="mb-1.5 text-[9px] font-extrabold tracking-[0.1em] text-hot">🔥 HOT</div>
            <div className="flex flex-1 flex-col gap-1.5">
              {hot.length === 0 ? <div className="flex-1 rounded-xl border border-border bg-card py-6 text-center text-[10px] text-muted">No movers.</div> : hot.map((m) => <MoverRow key={`${m.sport}-${m.player}`} mover={m} />)}
            </div>
          </div>
          <div className="flex flex-col">
            <div className="mb-1.5 text-[9px] font-extrabold tracking-[0.1em] text-cold">❄️ COLD</div>
            <div className="flex flex-1 flex-col gap-1.5">
              {cold.length === 0 ? <div className="flex-1 rounded-xl border border-border bg-card py-6 text-center text-[10px] text-muted">No movers.</div> : cold.map((m) => <MoverRow key={`${m.sport}-${m.player}`} mover={m} />)}
            </div>
          </div>
        </div>
      )}

      <Link href="/leaders" className="text-[11px] font-semibold text-accent">
        See full movers →
      </Link>
    </div>
  )
}
