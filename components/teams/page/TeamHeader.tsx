'use client'

import { useRouter } from 'next/navigation'
import { readableTeamColor } from '@/components/leaders/board/theme'
import { TeamCircle } from '@/components/standings/board/TeamRow'
import { SPORT_META } from '@/lib/sport/meta'
import type { SummaryCard, TeamPageData } from '@/lib/teams/types'
import { toneColor } from './shared'

/** Full-width banner: back button, team circle, name, record, standing pill and conference/division. */
export function TeamHeader({ data }: { data: TeamPageData }) {
  const router = useRouter()
  const accent = readableTeamColor(data.color)
  const meta = SPORT_META[data.sport]

  function back() {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push('/standings')
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border" style={{ background: `${data.color}14`, borderLeft: `4px solid ${accent}` }}>
      <div className="p-4 md:p-6">
        <button
          onClick={back}
          className="mb-3 flex h-8 items-center gap-1.5 rounded-[10px] border border-border bg-card3 px-3 text-[12px] font-bold text-text2 transition-colors hover:border-border2 hover:text-text"
          aria-label="Go back"
        >
          ← Back
        </button>
        <div className="flex flex-wrap items-center gap-4 md:gap-5">
          <TeamCircle abbr={data.abbr} color={data.color} size={64} />
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-extrabold leading-tight text-white md:text-[24px]">{data.name}</h1>
            <div className="text-[12px] text-muted">
              {data.city} · {meta.icon} {meta.label}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {data.rank && (
                <span className="rounded-full bg-warning px-3 py-1 text-[11px] font-extrabold text-bg" title={data.rank.poll + ' poll'}>
                  #{data.rank.value} {data.rank.poll}
                </span>
              )}
              <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-extrabold text-white shadow-[0_0_12px_rgba(59,158,255,0.4)]">{data.standing}</span>
              <span className="text-[11px] text-muted">{data.conferenceDivision}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="stat-number text-[2rem] leading-none text-white md:text-[2.4rem]">{data.record}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Record</div>
          </div>
        </div>
        {data.rankHistory && data.rankHistory.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
            <span className="font-bold uppercase tracking-wide">Ranking history</span>
            {data.rankHistory.map((r, i) => (
              <span key={i} className="rounded-md border border-border bg-card3 px-1.5 py-0.5 font-semibold text-text2">
                {r.label}: {r.rank ? '#' + r.rank : 'NR'}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Always-visible 2×4 stats grid under the header. */
export function SummaryGrid({ cards }: { cards: SummaryCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-border bg-[#111318] p-3.5">
          <div className="stat-number text-[1.35rem] leading-none md:text-[1.55rem]" style={{ color: toneColor(c.tone) }}>
            {c.value}
          </div>
          <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{c.label}</div>
          {c.sub && <div className="mt-0.5 text-[10px] text-muted">{c.sub}</div>}
        </div>
      ))}
    </div>
  )
}
