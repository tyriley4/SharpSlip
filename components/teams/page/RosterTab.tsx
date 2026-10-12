'use client'

import { PlayerLink } from '@/components/players/PlayerLink'
import { POSITION_COLORS } from '@/components/leaders/board/theme'
import type { RosterPlayer, TeamPageData } from '@/lib/teams/types'
import { EmptyNote, SectionHeader } from './shared'

function PlayerRow({ p, team, index }: { p: RosterPlayer; team: string; index: number }) {
  const color = POSITION_COLORS[p.position] ?? '#8B909A'
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 ${index % 2 === 0 ? 'bg-card' : 'bg-card2'}`}>
      <span className="w-7 shrink-0 text-center text-[11px] font-bold text-muted">{p.jersey ? `#${p.jersey}` : ''}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <PlayerLink name={p.name} team={team} className="truncate text-[13px] font-bold text-text hover:text-accent hover:underline">
            {p.name}
          </PlayerLink>
          {p.hot && <span title="On a hot streak">🔥</span>}
        </div>
        <span className="mt-0.5 inline-block rounded px-1.5 py-px text-[9px] font-extrabold tracking-wide" style={{ color, background: `${color}22` }}>
          {p.position}
        </span>
      </div>
      <div className="flex shrink-0 gap-3">
        {p.stats.map((s) => (
          <div key={s.label} className="w-[44px] text-right">
            <div className="stat-number text-[13px] text-text">{s.value}</div>
            <div className="text-[9px] font-bold uppercase tracking-wide text-muted">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RosterTab({ data }: { data: TeamPageData }) {
  if (data.roster.length === 0) return <EmptyNote>Roster data is temporarily unavailable.</EmptyNote>
  return (
    <div className="flex flex-col gap-6">
      <p className="text-[11px] leading-relaxed text-muted">Key contributors only — the top players by playing time and production at each spot.</p>
      {data.roster.map((group) => (
        <section key={group.title}>
          <SectionHeader title={`${group.title} (${group.players.length})`} />
          <div className="overflow-hidden rounded-[14px] border border-border">
            {group.players.map((p, i) => (
              <PlayerRow key={`${p.name}-${p.position}`} p={p} team={data.abbr} index={i} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
