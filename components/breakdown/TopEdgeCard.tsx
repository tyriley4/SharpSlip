import type { ReactNode } from 'react'
import { ConfBar } from '@/components/ui/ConfBar'
import { GradeACard, GradeBCard, GradeCCard } from '@/components/ui/Cards'
import { GradeChip } from '@/components/ui/GradeChip'
import type { Edge } from '@/data/breakdown/types'

function gradeCardFor(grade: string): (props: { className?: string; children?: ReactNode }) => JSX.Element {
  if (grade === 'A' || grade === 'A+' || grade === 'A-') return GradeACard
  if (grade === 'B' || grade === 'B+') return GradeBCard
  return GradeCCard
}

export function TopEdgeCard({
  edge,
  teamColors,
  sportsbook,
}: {
  edge: Edge
  teamColors: Record<string, string>
  sportsbook?: string
}) {
  const tc = edge.team ? (teamColors[edge.team] ?? '#4d9fff') : null
  const GradeCard = gradeCardFor(edge.grade)

  return (
    <GradeCard className="mb-2.5">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-[9px] font-extrabold tracking-[0.1em] text-grade-c">
          🏆 TOP INSIGHT TONIGHT
        </span>
        <span className="rounded-full border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold text-accent">
          📈 {edge.typeLabel}
        </span>
        {sportsbook && <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px] font-semibold text-muted">via {sportsbook}</span>}
      </div>
      <div className="mb-1 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{edge.icon}</span>
          <span className="text-base font-black text-text">{edge.bet}</span>
        </div>
        <div className="ml-2 shrink-0">
          <GradeChip grade={edge.grade} />
        </div>
      </div>
      {edge.team && (
        <span
          className="mb-2 inline-block rounded-md px-1.5 py-0.5 text-[9px] font-bold"
          style={{ background: `${tc}22`, color: tc ?? undefined }}
        >
          {edge.team}
        </span>
      )}
      <p className="mb-2.5 mt-1 text-[11px] leading-relaxed text-text2">{edge.analysis}</p>
      <div className="mb-2.5 flex flex-col gap-1">
        {edge.bullets.map((b) => (
          <div key={b} className="flex items-start gap-1.5">
            <span className="mt-0.5 shrink-0 text-[10px] text-win">•</span>
            <span className="text-[10px] leading-relaxed text-text2">{b}</span>
          </div>
        ))}
      </div>
      <ConfBar pct={edge.conf} grade={edge.grade} />
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <div className="rounded-[10px] bg-card3 px-2.5 py-2">
          <div className="mb-0.5 text-[9px] text-muted">Key Trend</div>
          <div className="stat-number text-[11px] text-accent">{edge.line}</div>
        </div>
        <div className="rounded-[10px] bg-card3 px-2.5 py-2">
          <div className="mb-0.5 text-[9px] text-muted">Supporting Insight</div>
          <div className="text-[10px] font-semibold leading-tight text-text2">{edge.altPlay}</div>
        </div>
      </div>
    </GradeCard>
  )
}
