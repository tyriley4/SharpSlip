import Link from 'next/link'
import { PlayerLink } from '@/components/players/PlayerLink'
import { TeamLink } from '@/components/teams/TeamLink'
import type { Injury, InjuryStatus } from '@/lib/home/injuries'
import { sportMeta } from '@/lib/sport/meta'
import type { Sport } from '@/lib/sport/SportContext'

const STATUS_STYLE: Record<InjuryStatus, { label: string; bg: string; text: string }> = {
  out: { label: 'OUT', bg: 'bg-loss/15', text: 'text-loss' },
  doubtful: { label: 'DOUBTFUL', bg: 'bg-orange-500/15', text: 'text-orange-400' },
  questionable: { label: 'QUESTIONABLE', bg: 'bg-yellow-400/15', text: 'text-yellow-300' },
  gtd: { label: 'GTD', bg: 'bg-warning/15', text: 'text-warning' },
  probable: { label: 'PROBABLE', bg: 'bg-win/15', text: 'text-win' },
  ir: { label: 'IR', bg: 'bg-loss/15', text: 'text-loss' },
}

function InjuryCard({ injury }: { injury: Injury }) {
  const meta = sportMeta(injury.sport)
  const status = STATUS_STYLE[injury.status]

  return (
    <div className="flex h-full w-[230px] flex-col rounded-[14px] border border-border bg-card p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: `${meta.color}22`, color: meta.color }}>
            {meta.icon} {meta.label}
          </span>
          <span className="text-[10px] font-semibold text-muted">{injury.position}</span>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${status.bg} ${status.text}`}>{status.label}</span>
      </div>
      <div className="mb-1 text-[13px] font-bold text-text">
        <PlayerLink name={injury.player} team={injury.team} className="hover:text-accent hover:underline">
          {injury.player}
        </PlayerLink>{' '}
        <span className="font-semibold text-muted">
          ·{' '}
          <TeamLink sport={injury.sport} abbr={injury.team} className="hover:text-accent hover:underline">
            {injury.team}
          </TeamLink>
        </span>
      </div>
      <div className="mb-1.5 text-[11px] text-text2">
        {injury.injury}
        {injury.returnDate ? <span className="text-muted"> · est. return {injury.returnDate}</span> : null}
      </div>
      <p className="mt-auto text-[10px] leading-relaxed text-muted">{injury.comment ?? injury.impact}</p>
    </div>
  )
}

export function InjuryReport({ injuries, sportFilter }: { injuries: Injury[]; sportFilter: Sport | 'all' }) {
  const relevant = sportFilter === 'all' ? injuries : injuries.filter((i) => i.sport === sportFilter)
  if (relevant.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="section-header text-sm text-text md:text-base">Injury Report</h2>
        <p className="mt-0.5 text-[10px] text-muted">Live designations from ESPN</p>
      </div>
      <div className="grid grid-flow-col auto-cols-[230px] items-stretch gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {relevant.map((injury) => (
          <InjuryCard key={`${injury.sport}-${injury.team}-${injury.player}`} injury={injury} />
        ))}
      </div>
      <Link href="/injuries" className="text-[11px] font-semibold text-accent">
        See full report →
      </Link>
    </div>
  )
}
