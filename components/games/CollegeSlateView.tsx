'use client'

import { useEffect, useMemo, useState } from 'react'
import { LiveCollegeGameCard, type EdgeBadge } from '@/components/games/LiveCollegeGameCard'
import { DataUnavailable } from '@/components/ui/DataUnavailable'
import type { CollegeSlate, SlateGame } from '@/lib/college/slate'

const LABEL = { cfb: 'College Football', cbb: 'College Basketball' } as const

function dayHeading(day: string): string {
  const d = new Date(`${day}T12:00:00`)
  const today = new Date().toLocaleDateString('en-CA')
  const base = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  return day === today ? `Today · ${base}` : base
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 86400000))
}

/** Slate for college football (full week, grouped by day) or college basketball (with a clean pre-season state). */
export function CollegeSlateView({ slate, sport }: { slate: CollegeSlate | null; sport: 'cfb' | 'cbb' }) {
  const [edges, setEdges] = useState<Record<string, EdgeBadge>>({})

  const groups = useMemo(() => {
    const m = new Map<string, SlateGame[]>()
    for (const g of slate?.games ?? []) m.set(g.day, [...(m.get(g.day) ?? []), g])
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [slate])

  // Edge badges arrive after the page renders: ranked/live games first, a few at a time.
  useEffect(() => {
    if (sport !== 'cfb' || !slate) return
    let cancelled = false
    const ids = [...slate.games]
      .filter((g) => g.state !== 'post' || true)
      .sort((a, b) => Math.min(a.away.rank ?? 99, a.home.rank ?? 99) - Math.min(b.away.rank ?? 99, b.home.rank ?? 99))
      .slice(0, 24)
      .map((g) => g.id)
    ;(async () => {
      for (let i = 0; i < ids.length && !cancelled; i += 6) {
        try {
          const res = await fetch(`/api/college-edges?sport=cfb&ids=${ids.slice(i, i + 6).join(',')}`)
          if (!res.ok) continue
          const json = (await res.json()) as { edges: Record<string, EdgeBadge> }
          if (!cancelled) setEdges((prev) => ({ ...prev, ...json.edges }))
        } catch {
          // badges are decoration; ignore failures
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slate, sport])

  const title = sport === 'cfb' ? (slate?.week ? `Week ${slate.week} Slate` : "This Week's Slate") : "Today's CBB Slate"
  const sub = sport === 'cfb' ? `${slate?.seasonYear ?? ''} College Football${slate?.week ? ` · Week ${slate.week}` : ''}` : `${slate?.seasonYear ? `${slate.seasonYear - 1}-${String(slate.seasonYear).slice(2)}` : ''} season`

  return (
    <div className="flex flex-col gap-4 px-3.5 pt-1 md:gap-6 md:px-0 md:pt-0">
      <div>
        <h1 className="text-base font-extrabold text-text md:text-2xl">{title}</h1>
        <p className="mt-0.5 text-[11px] text-muted md:mt-1 md:text-[13px]">{sub}</p>
      </div>

      {slate === null ? (
        <DataUnavailable label={`${LABEL[sport]} schedule`} />
      ) : (
        <>
          {sport === 'cbb' && slate.preseason && slate.seasonOpens && (
            <div className="rounded-2xl border border-accent/25 bg-accent/[0.06] px-4 py-5 text-center">
              <div className="mb-1 text-2xl">🏀</div>
              <div className="text-sm font-extrabold text-text">
                CBB season begins {new Date(slate.seasonOpens).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/New_York' })}
              </div>
              <div className="mt-1 text-[11px] text-muted">
                {daysUntil(slate.seasonOpens) === 0 ? 'Tip-off is today.' : `${daysUntil(slate.seasonOpens)} day${daysUntil(slate.seasonOpens) === 1 ? '' : 's'} to go.`} Check back for the full slate — the first games are listed below.
              </div>
            </div>
          )}

          {groups.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card px-6 py-14 text-center text-xs text-muted">
              {sport === 'cfb' ? 'No college football games on the board right now. The next slate appears here as soon as ESPN publishes it.' : 'No college basketball games scheduled yet.'}
            </div>
          ) : (
            groups.map(([day, games]) => (
              <section key={day} className="flex flex-col gap-2.5">
                <h2 className="section-header text-[12px] text-text md:text-sm">
                  {dayHeading(day)} <span className="text-[10px] font-semibold text-muted">({games.length} games)</span>
                </h2>
                <div className="flex flex-col gap-2.5 md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-3">
                  {games.map((g) => (
                    <LiveCollegeGameCard key={g.id} game={g} edge={edges[g.id]} />
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}
    </div>
  )
}
