'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { trackEvent } from '@/lib/analytics/posthog'
import { ConfBar } from '@/components/ui/ConfBar'
import { GradeACard, GradeBCard, GradeCCard } from '@/components/ui/Cards'
import { GradeChip } from '@/components/ui/GradeChip'
import type { Edge } from '@/data/breakdown/types'
import { edgeToProb } from '@/lib/parlay/math'
import { useParlay } from '@/lib/parlay/ParlayContext'

function gradeCardFor(grade: string): (props: { className?: string; children?: ReactNode }) => JSX.Element {
  if (grade === 'A' || grade === 'A+' || grade === 'A-') return GradeACard
  if (grade === 'B' || grade === 'B+') return GradeBCard
  return GradeCCard
}

export function EdgeCard({ edge, teamColors, sportsbook, sport }: { edge: Edge; teamColors: Record<string, string>; sportsbook?: string; sport?: string }) {
  const [open, setOpen] = useState(false)
  const { addLeg } = useParlay()
  const [added, setAdded] = useState(false)
  const tc = edge.team ? (teamColors[edge.team] ?? '#4d9fff') : null
  const GradeCard = gradeCardFor(edge.grade)

  return (
    <GradeCard className="mb-2 overflow-hidden !p-0">
      <button
        onClick={() => {
          if (!open) trackEvent('edge_card_clicked', { sport: sport ?? 'unknown', grade: edge.grade, edgeTitle: edge.bet })
          setOpen((v) => !v)
        }}
        className="w-full p-3 text-left"
      >
        <div className="mb-1.5 flex items-center justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="shrink-0 text-base">{edge.icon}</span>
            <span className="truncate text-[13px] font-bold text-text">{edge.bet}</span>
          </div>
          <div className="ml-2 flex shrink-0 items-center gap-2">
            <GradeChip grade={edge.grade} />
            <span className="text-[11px] text-text2">{open ? '▲' : '▼'}</span>
          </div>
        </div>
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          {edge.team && (
            <span
              className="rounded-md px-1.5 py-0.5 text-[9px] font-bold"
              style={{ background: `${tc}22`, color: tc ?? undefined }}
            >
              {edge.team}
            </span>
          )}
          <span className="rounded-full border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold text-accent">
            📊 {edge.typeLabel}
          </span>
          {sportsbook && <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px] font-semibold text-muted">via {sportsbook}</span>}
        </div>
        <ConfBar pct={edge.conf} grade={edge.grade} />
        <div className="mt-1.5 flex items-center justify-between">
          <span className="stat-number text-[10px] text-win">{edge.supporting} supporting</span>
          <span className="stat-number text-[10px] text-muted">{edge.line}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-border p-3">
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="text-[10px]">🤖</span>
            <span className="text-[9px] font-extrabold tracking-[0.1em] text-accent">
              EDGEVIEW ANALYSIS
            </span>
          </div>
          <p className="mb-2.5 text-[11px] leading-relaxed text-text2">{edge.analysis}</p>
          <div className="mb-2.5 flex flex-col gap-1">
            {edge.bullets.map((b) => (
              <div key={b} className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0 text-[10px] text-win">•</span>
                <span className="text-[10px] leading-relaxed text-text2">{b}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              addLeg({
                sport: sport ?? 'mlb',
                label: edge.bet,
                typeLabel: edge.typeLabel,
                oddsAmerican: -110,
                prob: edgeToProb(edge.conf),
                grade: edge.grade,
                lineId: `insight:${sport ?? 'mlb'}:${edge.team ?? ''}:${edge.bet}`,
              })
              setAdded(true)
              setTimeout(() => setAdded(false), 1500)
            }}
            className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-[11px] font-bold text-accent"
          >
            {added ? '✓ Added to Parlay' : '+ Add to Parlay'}
          </button>
        </div>
      )}
    </GradeCard>
  )
}
