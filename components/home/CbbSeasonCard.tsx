'use client'

import Link from 'next/link'
import type { CbbHomeInfo } from '@/lib/home/cbbHome'
import type { Sport } from '@/lib/sport/SportContext'

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 86400000))
}

/** College basketball before tip-off: the opening date with a countdown, plus the latest AP poll for context. */
export function CbbSeasonCard({ info, sportFilter }: { info: CbbHomeInfo; sportFilter: Sport | 'all' }) {
  if (sportFilter !== 'cbb' || !info.preseason) return null
  const opens = info.opens
  const days = opens ? daysUntil(opens) : null
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4" style={{ borderLeft: '3px solid #FF9F1C' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="section-header text-sm text-text md:text-base">🏀 College Basketball</h2>
          <p className="mt-1 text-[12px] font-bold text-text">
            {opens ? `Season begins ${new Date(opens).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/New_York' })}` : 'Season opens in early November'}
          </p>
        </div>
        {days !== null && (
          <div className="rounded-xl bg-card3 px-3.5 py-2 text-center">
            <div className="stat-number text-2xl text-text">{days}</div>
            <div className="text-[9px] font-bold uppercase tracking-wide text-muted">day{days === 1 ? '' : 's'} to tip-off</div>
          </div>
        )}
      </div>
      {info.top.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted">
            {info.pollName ?? 'AP Top 25'}
            {info.pollUpdated ? ` · updated ${new Date(info.pollUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
            {info.lastSeasonLabel ? ` · standings below are from ${info.lastSeasonLabel}` : ''}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {info.top.map((t) => (
              <Link key={t.abbr} href={`/teams/cbb/${t.abbr}`} className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card3 px-3 py-2 hover:border-border2">
                <span className="stat-number text-sm text-muted">#{t.rank}</span>
                {t.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.logo} alt="" width={22} height={22} className="h-[22px] w-[22px] object-contain" />
                )}
                <span className="text-[12px] font-bold text-text">{t.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2 text-[11px] font-bold">
        <Link href="/standings" className="rounded-full border border-accent/40 bg-accent/15 px-3 py-1.5 text-accent hover:bg-accent/25">Last season’s standings</Link>
        <Link href="/leaders" className="rounded-full border border-border bg-card3 px-3 py-1.5 text-text2 hover:text-text">Last season’s leaders</Link>
        <Link href="/games" className="rounded-full border border-border bg-card3 px-3 py-1.5 text-text2 hover:text-text">Opening-week preview</Link>
      </div>
    </div>
  )
}
