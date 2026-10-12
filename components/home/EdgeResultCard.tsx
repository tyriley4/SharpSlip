import { MatchupLinks } from '@/components/teams/MatchupLinks'
import { CardOverlayLink } from '@/components/ui/CardOverlayLink'
import { ConfBar } from '@/components/ui/ConfBar'
import { GradeACard, GradeBCard, GradeCCard } from '@/components/ui/Cards'
import { GradeChip } from '@/components/ui/GradeChip'
import type { TopEdgeResult } from '@/lib/home/topEdges'
import { sportMeta } from '@/lib/sport/meta'

function gradeCardFor(grade: string) {
  if (grade === 'A' || grade === 'A+' || grade === 'A-') return GradeACard
  if (grade === 'B' || grade === 'B+') return GradeBCard
  return GradeCCard
}

/** Shared read-only edge card used by the home dashboard, the Best Bets drawer, and /edges. */
export function EdgeResultCard({
  result,
  className = '',
  onClick,
}: {
  result: TopEdgeResult
  className?: string
  onClick?: () => void
}) {
  const meta = sportMeta(result.sport)
  const { edge } = result
  const GradeCard = gradeCardFor(edge.grade)

  return (
    <div className={`relative block transition-colors ${className}`}>
      <CardOverlayLink
        href={result.href}
        onClick={onClick}
        track={{ event: 'edge_card_clicked', properties: { sport: result.sport, grade: edge.grade, edgeTitle: edge.bet } }}
        label={`${result.matchup} game breakdown`}
      />
      <GradeCard className="pointer-events-none h-full">
        <div className="mb-2 flex items-center justify-between">
          <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: `${meta.color}22`, color: meta.color }}>
            {meta.icon} {meta.label}
          </span>
          <GradeChip grade={edge.grade} />
        </div>
        <div className="mb-1 text-[11px] font-semibold text-muted">
          <MatchupLinks sport={result.sport} matchup={result.matchup} />
        </div>
        <div className="mb-2 flex items-center gap-2">
          <span className="text-base">{edge.icon}</span>
          <span className="text-[14px] font-extrabold text-text">{edge.bet}</span>
        </div>
        <ConfBar pct={edge.conf} grade={edge.grade} />
        <div className="mt-2 flex flex-col gap-1">
          {edge.bullets.slice(0, 2).map((b) => (
            <div key={b} className="flex items-start gap-1.5">
              <span className="mt-0.5 shrink-0 text-[10px] text-win">•</span>
              <span className="text-[10px] leading-relaxed text-text2">{b}</span>
            </div>
          ))}
        </div>
        <div className="mt-2.5 text-[11px] font-semibold text-accent">View Breakdown →</div>
      </GradeCard>
    </div>
  )
}
