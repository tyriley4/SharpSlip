'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { atsOutcome, chronological, finals, lineOutcome, moneyline, pctOf, recordString, tally, totalOutcome, type Outcome } from '@/lib/teams/analysis'
import type { TeamGame, TeamPageData } from '@/lib/teams/types'
import { EmptyNote, formatDate, formatTime, GREEN, RED, ResultBadge, SectionHeader } from './shared'

type Filter = 'All' | 'Home' | 'Away' | 'Wins' | 'Losses' | 'Covered' | "Didn't Cover" | 'Over' | 'Under'

/** How "ATS" is judged per sport: real spreads for the NFL, the standard ±1.5 line for MLB and NHL, none for the NBA. */
function atsFor(sport: TeamPageData['sport']): { fn: ((g: TeamGame) => Outcome) | null; label: string } {
  if (sport === 'nfl') return { fn: atsOutcome, label: 'ATS' }
  if (sport === 'mlb') return { fn: (g) => lineOutcome(g, -1.5), label: 'RL −1.5' }
  if (sport === 'nhl') return { fn: (g) => lineOutcome(g, -1.5), label: 'PL −1.5' }
  return { fn: null, label: 'ATS' }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function Mark({ ok, label }: { ok: boolean | null; label: string }) {
  if (ok === null) return <span className="text-muted">—</span>
  return (
    <span className="text-[11px] font-bold" style={{ color: ok ? GREEN : RED }}>
      {label}
    </span>
  )
}

function FooterStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-[#111318] p-3">
      <div className="stat-number text-[1.1rem] text-text">{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{label}</div>
    </div>
  )
}

export function ScheduleTab({ data }: { data: TeamPageData }) {
  const ats = atsFor(data.sport)
  const [filter, setFilter] = useState<Filter>('All')
  const [month, setMonth] = useState<string>('All')

  const ordered = useMemo(() => chronological(data.games), [data.games])
  const months = useMemo(() => Array.from(new Set(ordered.map((g) => g.date.slice(0, 7)))), [ordered])
  const filters: Filter[] = ['All', 'Home', 'Away', 'Wins', 'Losses', ...(ats.fn ? (['Covered', "Didn't Cover"] as Filter[]) : []), 'Over', 'Under']

  const shown = useMemo(() => {
    return ordered.filter((g) => {
      if (month !== 'All' && g.date.slice(0, 7) !== month) return false
      switch (filter) {
        case 'Home':
          return g.home
        case 'Away':
          return !g.home
        case 'Wins':
          return g.result === 'W'
        case 'Losses':
          return g.result === 'L' || g.result === 'OTL'
        case 'Covered':
          return ats.fn?.(g) === 'W'
        case "Didn't Cover":
          return ats.fn?.(g) === 'L'
        case 'Over':
          return totalOutcome(g) === 'O'
        case 'Under':
          return totalOutcome(g) === 'U'
        default:
          return true
      }
    })
  }, [ordered, filter, month, ats])

  const played = finals(data.games)
  const home = played.filter((g) => g.home)
  const away = played.filter((g) => !g.home)
  const homeRec = tally(home, moneyline)
  const awayRec = tally(away, moneyline)
  const overs = tally(played, (g) => (totalOutcome(g) === 'O' ? 'W' : totalOutcome(g) === 'U' ? 'L' : null))
  const atsHome = ats.fn ? tally(home, ats.fn) : null
  const atsAway = ats.fn ? tally(away, ats.fn) : null
  const scored = data.sport === 'nfl' || data.sport === 'nba' ? 'Points' : data.sport === 'mlb' ? 'Runs' : 'Goals'

  if (data.games.length === 0) return <EmptyNote>The schedule is temporarily unavailable.</EmptyNote>

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex gap-1.5 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${filter === f ? 'border-accent bg-accent text-white' : 'border-border bg-card text-text2 hover:border-border2 hover:text-text'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
          Jump to
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-border bg-card3 px-3 py-1.5 text-[12px] font-semibold normal-case tracking-normal text-text focus:border-accent focus:outline-none [color-scheme:dark]"
          >
            <option value="All">Full season</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {MONTHS[parseInt(m.slice(5), 10) - 1]} {m.slice(0, 4)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section>
        <SectionHeader title="Schedule" right={<span className="text-[11px] text-muted">{shown.length} games</span>} />
        {shown.length === 0 ? (
          <EmptyNote>No games match this filter.</EmptyNote>
        ) : (
          <div className="overflow-hidden rounded-[14px] border border-border">
            {shown.map((g, i) => {
              const final = g.state === 'Final'
              const a = final && ats.fn ? ats.fn(g) : null
              const t = final ? totalOutcome(g) : null
              return (
                <Link key={g.id} href={g.href} className={`grid items-center gap-2 px-3 py-2.5 text-[12px] transition-colors hover:bg-card3 ${i % 2 === 0 ? 'bg-card' : 'bg-card2'}`} style={{ gridTemplateColumns: '48px 1fr 78px 52px 36px' }}>
                  <span className="text-muted">{formatDate(g.date)}</span>
                  <span className="truncate font-bold text-text">
                    <span className="mr-1 text-[10px] font-semibold text-muted">{g.home ? 'vs' : '@'}</span>
                    {g.oppAbbr}
                    {g.state === 'Postponed' && <span className="ml-1.5 text-[9px] text-warning">PPD</span>}
                  </span>
                  {final ? (
                    <span className="flex items-center gap-1.5">
                      <ResultBadge result={g.result} />
                      <span className="stat-number text-text">
                        {g.us}-{g.them}
                      </span>
                    </span>
                  ) : (
                    <span className="text-text2">{g.state === 'Live' ? 'LIVE' : formatTime(g.startTime)}</span>
                  )}
                  {final ? (
                    <span title={ats.label}>
                      <Mark ok={a === 'W' ? true : a === 'L' ? false : null} label={a === 'W' ? '✓' : a === 'L' ? '✗' : '—'} />
                    </span>
                  ) : (
                    <span className="truncate text-[10px] text-muted">{g.tv ?? ''}</span>
                  )}
                  <span title={`Total (${g.totalIsProxy ? 'vs league avg' : 'closing line'})`}>
                    {final && t ? <span className="text-[11px] font-bold text-text2">{t}</span> : null}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
        <p className="mt-2 text-[10px] leading-relaxed text-muted">
          ✓ / ✗ = {ats.fn ? `${ats.label} ${data.sport === 'nfl' ? 'against the closing spread' : 'standard line'}` : 'ATS not available (no spread feed)'} · O / U = {data.games.some((g) => g.totalIsProxy) ? 'vs the league-average total' : 'vs the closing total'}
        </p>
      </section>

      <section>
        <SectionHeader title="Season Splits" />
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <FooterStat label="Home record" value={recordString(homeRec)} />
          <FooterStat label="Away record" value={recordString(awayRec)} />
          <FooterStat label={`${ats.label} home`} value={atsHome ? recordString(atsHome) : '—'} />
          <FooterStat label={`${ats.label} away`} value={atsAway ? recordString(atsAway) : '—'} />
          <FooterStat label="Over record" value={`${overs.wins}-${overs.losses}`} />
          <FooterStat label="Under record" value={`${overs.losses}-${overs.wins}`} />
          <FooterStat label={`Avg ${scored.toLowerCase()} scored`} value={data.avgFor !== null ? data.avgFor.toFixed(1) : '—'} />
          <FooterStat label={`Avg ${scored.toLowerCase()} allowed`} value={data.avgAgainst !== null ? data.avgAgainst.toFixed(1) : '—'} />
        </div>
        {pctOf(homeRec) !== null && <p className="mt-2 text-[10px] text-muted">Home win rate {pctOf(homeRec)}% · away {pctOf(awayRec) ?? '—'}%</p>}
      </section>
    </div>
  )
}
