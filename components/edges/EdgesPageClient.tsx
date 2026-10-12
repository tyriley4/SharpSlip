'use client'

import { useMemo, useState } from 'react'
import { EdgeResultCard } from '@/components/home/EdgeResultCard'
import { SPORTS } from '@/lib/sport/SportContext'
import type { Sport } from '@/lib/sport/SportContext'
import type { TopEdgeResult } from '@/lib/home/topEdges'
import { sportMeta } from '@/lib/sport/meta'
import { AppShell } from '@/components/layout/AppShell'
import { EdgeDisclaimer } from '@/components/ui/EdgeDisclaimer'

const GRADE_TIERS = ['A', 'B', 'C'] as const
type GradeTier = (typeof GRADE_TIERS)[number]

function gradeTier(grade: string): GradeTier {
  if (grade.startsWith('A')) return 'A'
  if (grade.startsWith('B')) return 'B'
  return 'C'
}

export function EdgesPageClient({ edges }: { edges: TopEdgeResult[] }) {
  const [sportFilter, setSportFilter] = useState<Sport | 'all'>('all')
  const [gradeFilter, setGradeFilter] = useState<GradeTier | 'All'>('All')
  const [categoryFilter, setCategoryFilter] = useState<string>('All')

  const categories = useMemo(() => {
    const set = new Set(edges.map((e) => e.edge.typeLabel))
    return Array.from(set).sort()
  }, [edges])

  const dateLabel = useMemo(
    () => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
    []
  )

  const filtered = edges.filter((e) => {
    if (sportFilter !== 'all' && e.sport !== sportFilter) return false
    if (gradeFilter !== 'All' && gradeTier(e.edge.grade) !== gradeFilter) return false
    if (categoryFilter !== 'All' && e.edge.typeLabel !== categoryFilter) return false
    return true
  })

  const sportsToShow: Sport[] = sportFilter === 'all' ? ['mlb', 'nfl', 'nba', 'nhl'] : [sportFilter]

  return (
    <AppShell>
      <div className="flex flex-col gap-4 px-3.5 pt-1 md:gap-6 md:px-0 md:pt-0">
        <div>
          <h1 className="text-base font-extrabold text-text md:text-2xl">Today&apos;s Edges</h1>
          <p className="mt-0.5 text-[11px] text-muted md:mt-1 md:text-[13px]">Auto-generated from real stats — {dateLabel}</p>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => setSportFilter('all')}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition-colors ${sportFilter === 'all' ? 'border-accent bg-accent text-white' : 'border-border bg-card text-muted'}`}
            >
              All
            </button>
            {SPORTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSportFilter(s.id)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition-colors ${sportFilter === s.id ? 'border-accent bg-accent text-white' : 'border-border bg-card text-muted'}`}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(['All', ...GRADE_TIERS] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGradeFilter(g)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${gradeFilter === g ? 'border-accent bg-accent text-white' : 'border-border bg-card text-muted'}`}
              >
                {g === 'All' ? 'All Grades' : `Grade ${g}`}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => setCategoryFilter('All')}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${categoryFilter === 'All' ? 'border-accent bg-accent text-white' : 'border-border bg-card text-muted'}`}
            >
              All Categories
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${categoryFilter === c ? 'border-accent bg-accent text-white' : 'border-border bg-card text-muted'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {sportsToShow.map((sport) => {
            const meta = sportMeta(sport)
            const sportEdges = filtered.filter((e) => e.sport === sport).sort((a, b) => b.edge.conf - a.edge.conf)
            return (
              <div key={sport}>
                <h2 className="section-header mb-3 text-sm text-text md:text-base">
                  {meta.icon} {meta.label}
                </h2>
                {sportEdges.length === 0 ? (
                  <div className="rounded-[14px] border border-border bg-card py-8 text-center text-xs text-muted">
                    No qualifying insights for {meta.label} today
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
                    {sportEdges.map((r) => (
                      <EdgeResultCard key={`${r.sport}-${r.gameId}-${r.edge.id}`} result={r} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <EdgeDisclaimer />
      </div>
    </AppShell>
  )
}
