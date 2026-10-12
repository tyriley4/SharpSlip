'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { StreakBadge } from '@/components/standings/board/StreakBadge'
import { chronological, finals } from '@/lib/teams/analysis'
import type { StatLine, TeamGame, TeamPageData } from '@/lib/teams/types'
import { AMBER, EmptyNote, formatDate, formatTime, GREEN, RED, ResultBadge, SectionHeader, Table } from './shared'

function runningRecords(games: TeamGame[], hasOtl: boolean): Map<string, string> {
  const out = new Map<string, string>()
  let w = 0
  let l = 0
  let o = 0
  let t = 0
  for (const g of chronological(finals(games))) {
    if (g.result === 'W') w++
    else if (g.result === 'OTL') o++
    else if (g.result === 'T') t++
    else l++
    out.set(g.id, hasOtl ? `${w}-${l}-${o}` : t > 0 ? `${w}-${l}-${t}` : `${w}-${l}`)
  }
  return out
}

function FormDots({ form }: { form: TeamPageData['form'] }) {
  // Newest on the right so the row reads like a timeline.
  const ordered = [...form].reverse()
  return (
    <div className="flex items-center gap-1.5" aria-label="Last 10 results">
      {ordered.map((r, i) => {
        const c = r === 'W' ? GREEN : r === 'OTL' ? AMBER : r === 'T' ? '#8B909A' : RED
        return <span key={i} title={r} className="h-3.5 w-3.5 rounded-full" style={{ background: c, boxShadow: `0 0 8px ${c}55` }} />
      })}
    </div>
  )
}

function ComparisonRow({ s }: { s: StatLine }) {
  const color = s.better === true ? GREEN : s.better === false ? RED : '#8B909A'
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border px-3 py-2.5 last:border-0">
      <div className="text-[12px] font-semibold text-text2">{s.label}</div>
      <div className="stat-number w-[64px] text-right text-[13px] text-text">{s.value}</div>
      <div className="flex w-[84px] items-center justify-end gap-1.5">
        <span className="stat-number text-[12px] text-muted">{s.leagueAvg}</span>
        <span className="w-3 text-[13px] font-extrabold" style={{ color }}>
          {s.better === true ? '↑' : s.better === false ? '↓' : '–'}
        </span>
      </div>
    </div>
  )
}

export function OverviewTab({ data }: { data: TeamPageData }) {
  const hasOtl = data.sport === 'nhl'
  const records = useMemo(() => runningRecords(data.games, hasOtl), [data.games, hasOtl])
  const last5 = useMemo(() => chronological(finals(data.games)).slice(-5).reverse(), [data.games])
  const next5 = useMemo(() => chronological(data.games.filter((g) => g.state === 'Upcoming' || g.state === 'Live')).slice(0, 5), [data.games])

  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionHeader title="Recent Form" right={data.streak ? <StreakBadge streak={data.streak} /> : undefined} />
        {data.form.length === 0 ? <EmptyNote>No completed games yet.</EmptyNote> : (
          <div className="flex flex-wrap items-center gap-4 rounded-[14px] border border-border bg-card p-4">
            <FormDots form={data.form} />
            <span className="text-[11px] text-muted">Last {data.form.length} · oldest → newest</span>
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Last 5 Games" />
        {last5.length === 0 ? (
          <EmptyNote>No completed games yet.</EmptyNote>
        ) : (
          <Table head={['Date', 'Opp', 'Record', 'Score', data.keyStatLabel, 'Res']} grid="52px 64px 62px 66px 1fr 34px">
            {last5.map((g, i) => (
              <Link key={g.id} href={g.href} className={`grid items-center gap-2 px-3 py-2.5 text-[12px] transition-colors hover:bg-card3 ${i % 2 === 0 ? 'bg-card' : 'bg-card2'}`} style={{ gridTemplateColumns: '52px 64px 62px 66px 1fr 34px' }}>
                <span className="text-muted">{formatDate(g.date)}</span>
                <span className="font-bold text-text">
                  {g.home ? 'vs' : '@'} {g.oppAbbr}
                </span>
                <span className="stat-number text-text2">{records.get(g.id) ?? '—'}</span>
                <span className="stat-number text-text">
                  {g.us}-{g.them}
                  {g.extra ? <span className="ml-1 text-[9px] text-muted">{data.sport === 'mlb' ? 'F/X' : 'OT'}</span> : null}
                </span>
                <span className="truncate text-[11px] text-text2">{g.keyStat ?? '—'}</span>
                <ResultBadge result={g.result} />
              </Link>
            ))}
          </Table>
        )}
      </section>

      <section>
        <SectionHeader title="Next 5 Games" />
        {next5.length === 0 ? (
          <EmptyNote>No upcoming games on the schedule — the regular season is complete.</EmptyNote>
        ) : (
          <Table head={['Date', 'Opp', 'Time', 'TV', 'H/A']} grid="52px 72px 72px 1fr 40px">
            {next5.map((g, i) => (
              <Link key={g.id} href={g.href} className={`grid items-center gap-2 px-3 py-2.5 text-[12px] transition-colors hover:bg-card3 ${i % 2 === 0 ? 'bg-card' : 'bg-card2'}`} style={{ gridTemplateColumns: '52px 72px 72px 1fr 40px' }}>
                <span className="text-muted">{formatDate(g.date)}</span>
                <span className="font-bold text-text">{g.oppAbbr}</span>
                <span className="text-text2">{formatTime(g.startTime)}</span>
                <span className="truncate text-muted">{g.tv ?? '—'}</span>
                <span className="text-[11px] font-bold text-text2">{g.home ? 'H' : 'A'}</span>
              </Link>
            ))}
          </Table>
        )}
      </section>

      <section>
        <SectionHeader title="Key Stats vs League Average" />
        {data.keyStats.length === 0 ? (
          <EmptyNote>League comparison is temporarily unavailable.</EmptyNote>
        ) : (
          <div className="overflow-hidden rounded-[14px] border border-border bg-card">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border bg-card3 px-3 py-2 text-[9px] font-extrabold uppercase tracking-[0.08em] text-muted">
              <span>Stat</span>
              <span className="w-[64px] text-right">{data.abbr}</span>
              <span className="w-[84px] text-right">League avg</span>
            </div>
            {data.keyStats.map((s) => (
              <ComparisonRow key={s.label} s={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
