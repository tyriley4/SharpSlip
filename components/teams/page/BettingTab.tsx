'use client'

import type { LineRecord, TeamPageData, TrendCard } from '@/lib/teams/types'
import { AMBER, EmptyNote, GREEN, pctColor, RED, SectionHeader, toneColor } from './shared'

function LineCard({ r }: { r: LineRecord }) {
  const decided = r.wins + r.losses > 0
  return (
    <div className="rounded-xl border border-border bg-[#111318] p-3.5">
      <div className="text-[11px] font-bold text-text2">{r.label}</div>
      {decided ? (
        <>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="stat-number text-[1.5rem] leading-none text-white">
              {r.wins}-{r.losses}
              {r.pushes > 0 ? `-${r.pushes}` : ''}
            </span>
            <span className="stat-number text-[1.05rem]" style={{ color: pctColor(r.pct) }}>
              {r.pct}%
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted">
            <span>Last 10: <span className="stat-number text-text2">{r.last10}</span></span>
            {r.streak && (
              <span className="rounded-full px-2 py-0.5 text-[9px] font-extrabold" style={{ color: r.streak.startsWith('Missed') ? RED : GREEN, background: r.streak.startsWith('Missed') ? 'rgba(239,68,68,0.12)' : 'rgba(0,229,160,0.12)' }}>
                {r.streak}
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="mt-2 text-[11px] text-muted">No decided games yet.</div>
      )}
      {r.note && <p className="mt-2 text-[9px] leading-snug text-muted">{r.note}</p>}
    </div>
  )
}

function Trend({ t }: { t: TrendCard }) {
  const c = t.tone === 'good' ? GREEN : t.tone === 'bad' ? RED : AMBER
  return (
    <div className="rounded-xl border border-border bg-card p-3.5" style={{ borderLeft: `3px solid ${c}` }}>
      <div className="flex items-start gap-2.5">
        <span className="text-lg">{t.icon}</span>
        <div className="min-w-0">
          <div className="text-[13px] font-extrabold" style={{ color: toneColor(t.tone) === '#F0F2F5' ? '#F0F2F5' : c }}>
            {t.headline}
          </div>
          <div className="mt-0.5 text-[11px] leading-snug text-muted">{t.detail}</div>
        </div>
      </div>
    </div>
  )
}

export function BettingTab({ data }: { data: TeamPageData }) {
  const { lines, situational, trends, notes } = data.betting
  if (data.games.length === 0) return <EmptyNote>Betting records need the schedule, which is temporarily unavailable.</EmptyNote>

  return (
    <div className="flex flex-col gap-7">
      <section>
        <SectionHeader title="Game Line Records" />
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {lines.map((r) => (
            <LineCard key={r.label} r={r} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Situational Records" />
        {situational.length === 0 ? (
          <EmptyNote>Not enough games to split by situation yet.</EmptyNote>
        ) : (
          <div className="overflow-hidden rounded-[14px] border border-border">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-border bg-card3 px-3 py-2 text-[9px] font-extrabold uppercase tracking-[0.08em] text-muted">
              <span>Situation</span>
              <span className="w-[62px] text-right">W-L</span>
              <span className="w-[44px] text-right">Win %</span>
              <span className="w-[62px] text-right">{situational.some((s) => s.ats) ? 'ATS' : ''}</span>
            </div>
            {situational.map((s, i) => (
              <div key={s.label} className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-3 py-2.5 text-[12px] ${i % 2 === 0 ? 'bg-card' : 'bg-card2'}`}>
                <span className="font-semibold text-text2">{s.label}</span>
                <span className="stat-number w-[62px] text-right text-text">{s.record}</span>
                <span className="stat-number w-[44px] text-right" style={{ color: pctColor(s.pct) }}>
                  {s.pct !== null ? `${Math.round(s.pct)}%` : '—'}
                </span>
                <span className="stat-number w-[62px] text-right text-text2">{s.ats ?? ''}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Trends" />
        {trends.length === 0 ? (
          <EmptyNote>Trends appear once the team has played a handful of games.</EmptyNote>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {trends.map((t) => (
              <Trend key={t.headline} t={t} />
            ))}
          </div>
        )}
      </section>

      {notes.length > 0 && (
        <div className="rounded-xl border border-accent/25 bg-accent/[0.06] p-3.5 text-[11px] leading-relaxed text-text2">
          {notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
          <p className="mt-1 text-[10px] text-muted">These are historical results, not betting advice.</p>
        </div>
      )}
    </div>
  )
}
