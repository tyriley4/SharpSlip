'use client'

import type { StatLine, TeamPageData } from '@/lib/teams/types'
import { AMBER, EmptyNote, GREEN, RED, SectionHeader } from './shared'

/** League-rank color: 1–8 green, 9–16 neutral, 17+ red. */
function rankColor(rank: number | null): string {
  if (rank === null) return '#8B909A'
  return rank <= 8 ? GREEN : rank <= 16 ? AMBER : RED
}

function StatRow({ s, index }: { s: StatLine; index: number }) {
  const c = rankColor(s.rank)
  return (
    <div className={`grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2.5 ${index % 2 === 0 ? 'bg-card' : 'bg-card2'}`}>
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-text2">{s.label}</div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="relative h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-card3" title={`League average ${s.leagueAvg}`}>
            <div className="h-full rounded-full" style={{ width: `${Math.max(4, Math.round(s.barPct * 100))}%`, background: c }} />
          </div>
          <span className="shrink-0 text-[9px] text-muted">lg avg {s.leagueAvg}</span>
        </div>
      </div>
      <div className="stat-number w-[64px] text-right text-[14px] text-text">{s.value}</div>
      <div className="w-[60px] text-right">
        {s.rank !== null ? (
          <span className="rounded-md px-1.5 py-0.5 text-[10px] font-extrabold" style={{ color: c, background: `${c}1F` }}>
            #{s.rank} / {s.total}
          </span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </div>
    </div>
  )
}

export function StatsTab({ data }: { data: TeamPageData }) {
  if (data.stats.length === 0 || data.stats.every((s) => s.stats.length === 0)) return <EmptyNote>Team stats are temporarily unavailable.</EmptyNote>
  return (
    <div className="flex flex-col gap-6">
      {data.stats.map((section) => (
        <section key={section.title}>
          <SectionHeader title={section.title} />
          <div className="overflow-hidden rounded-[14px] border border-border">
            {section.stats.map((s, i) => (
              <StatRow key={s.label} s={s} index={i} />
            ))}
          </div>
          {section.note && <p className="mt-2 text-[10px] leading-snug text-muted">{section.note}</p>}
        </section>
      ))}
      <p className="text-[10px] text-muted">Rank 1 = best in the league (lower is better for ERA, goals against, points allowed and the like).</p>
    </div>
  )
}
