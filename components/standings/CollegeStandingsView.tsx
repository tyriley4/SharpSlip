'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TeamLink } from '@/components/teams/TeamLink'
import type { CollegeConferenceTable, CollegeStandingsData, PollView } from '@/lib/college/standings'

const pct = (p: number) => (p === 0 ? '.000' : p === 1 ? '1.000' : p.toFixed(3).replace(/^0/, ''))

function Logo({ src, abbr, color }: { src: string | null; abbr: string; color: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={28} height={28} className="h-7 w-7 shrink-0 object-contain" />
  ) : (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold text-white" style={{ background: color }}>
      {abbr.slice(0, 3)}
    </span>
  )
}

function Movement({ m }: { m: number | null }) {
  if (m === null) return <span className="text-[10px] font-bold text-accent">NEW</span>
  if (m > 0) return <span className="text-[11px] font-bold text-win">↑{m}</span>
  if (m < 0) return <span className="text-[11px] font-bold text-loss">↓{Math.abs(m)}</span>
  return <span className="text-[11px] text-muted">—</span>
}

function ConferenceTable({ conf, sport }: { conf: CollegeConferenceTable; sport: 'cfb' | 'cbb' }) {
  return (
    <section className="flex flex-col gap-3">
      {conf.groups.map((g, gi) => (
        <div key={gi} className="overflow-hidden rounded-[14px] border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border bg-card3 px-3 py-2">
            <h3 className="section-header text-[12px] text-text">
              {conf.name}
              {g.title ? <span className="text-muted"> · {g.title}</span> : null}
            </h3>
            <span className="text-[9px] font-bold text-muted">{g.rows.length} teams</span>
          </div>
          <div className="grid grid-cols-[22px_minmax(0,1fr)_38px_38px_46px_46px_46px] items-center gap-x-1.5 px-3 py-1.5 text-[9px] font-extrabold tracking-wide text-muted md:grid-cols-[26px_minmax(0,1fr)_44px_44px_56px_56px_60px_60px_50px]">
            <span>#</span>
            <span>TEAM</span>
            <span className="text-center">W</span>
            <span className="text-center">L</span>
            <span className="text-center">CONF</span>
            <span className="text-center">PCT</span>
            <span className="text-center">STRK</span>
            <span className="hidden text-center md:block">HOME</span>
            <span className="hidden text-center md:block">AWAY</span>
          </div>
          {g.rows.map((r, i) => (
            <div key={r.teamId} className={`grid grid-cols-[22px_minmax(0,1fr)_38px_38px_46px_46px_46px] items-center gap-x-1.5 px-3 py-2 text-[12px] md:grid-cols-[26px_minmax(0,1fr)_44px_44px_56px_56px_60px_60px_50px] ${i % 2 === 0 ? 'bg-card' : 'bg-card2'}`}>
              <span className="stat-number text-[11px] text-muted">{r.rank}</span>
              <div className="flex min-w-0 items-center gap-2">
                <Logo src={r.logo} abbr={r.abbr} color={r.color} />
                <TeamLink sport={sport} abbr={r.abbr} className="min-w-0 truncate font-bold text-text hover:text-accent hover:underline">
                  {r.apRank !== null && <span className="mr-1 text-[10px] font-extrabold text-accent">#{r.apRank}</span>}
                  {r.name}
                </TeamLink>
              </div>
              <span className="stat-number text-center font-extrabold text-text">{r.w}</span>
              <span className="stat-number text-center text-muted">{r.l}</span>
              <span className="stat-number text-center text-text2">
                {r.confW}-{r.confL}
              </span>
              <span className="stat-number text-center text-text2">{pct(r.confPct)}</span>
              <span className={`stat-number text-center text-[11px] ${r.streak.startsWith('W') ? 'text-win' : r.streak.startsWith('L') ? 'text-loss' : 'text-muted'}`}>{r.streak}</span>
              <span className="stat-number hidden text-center text-[11px] text-muted md:block">{r.home}</span>
              <span className="stat-number hidden text-center text-[11px] text-muted md:block">{r.away}</span>
            </div>
          ))}
        </div>
      ))}
    </section>
  )
}

function Rankings({ polls, sport }: { polls: PollView[]; sport: 'cfb' | 'cbb' }) {
  const firstAvailable = polls.find((p) => p.available) ?? polls[0]
  const [key, setKey] = useState<PollView['key']>(firstAvailable.key)
  const poll = polls.find((p) => p.key === key) ?? firstAvailable

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Poll">
        {polls.map((p) => (
          <button
            key={p.key}
            role="tab"
            aria-selected={key === p.key}
            onClick={() => setKey(p.key)}
            className={`rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition-colors ${key === p.key ? 'border-accent bg-accent text-white' : 'border-border bg-card text-muted hover:text-text'}`}
          >
            {p.key === 'cfp' ? 'CFP Rankings' : p.key === 'ap' ? 'AP Poll' : 'Coaches Poll'}
            {!p.available && <span className="ml-1 opacity-60">·soon</span>}
          </button>
        ))}
      </div>

      {!poll.available ? (
        <div className="rounded-2xl border border-accent/25 bg-accent/[0.06] px-4 py-8 text-center">
          <div className="mb-1 text-2xl">🏆</div>
          <div className="text-sm font-extrabold text-text">{poll.name} not released yet</div>
          <p className="mx-auto mt-1 max-w-[420px] text-[11px] leading-relaxed text-muted">{poll.note}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border bg-card3 px-3 py-2">
            <h3 className="section-header text-[12px] text-text">
              {poll.name}
              {poll.week ? <span className="text-muted"> · Week {poll.week}</span> : null}
            </h3>
            <span className="text-[9px] text-muted">{poll.rows.length} teams</span>
          </div>
          <div className="grid grid-cols-[30px_minmax(0,1fr)_56px_44px_50px] items-center gap-x-2 px-3 py-1.5 text-[9px] font-extrabold tracking-wide text-muted md:grid-cols-[34px_minmax(0,1fr)_80px_70px_56px_60px]">
            <span>#</span>
            <span>TEAM</span>
            <span className="text-center">RECORD</span>
            <span className="text-center">CONF</span>
            <span className="text-center">PREV</span>
            <span className="hidden text-center md:block">PTS</span>
          </div>
          {poll.rows.map((r, i) => (
            <div key={r.teamId} className={`grid grid-cols-[30px_minmax(0,1fr)_56px_44px_50px] items-center gap-x-2 px-3 py-2 text-[12px] md:grid-cols-[34px_minmax(0,1fr)_80px_70px_56px_60px] ${i % 2 === 0 ? 'bg-card' : 'bg-card2'}`}>
              <span className="stat-number text-[13px] font-extrabold text-text">{r.rank}</span>
              <div className="flex min-w-0 items-center gap-2">
                <Logo src={r.logo} abbr={r.abbr} color={r.color} />
                <TeamLink sport={sport} abbr={r.abbr} className="min-w-0 truncate font-bold text-text hover:text-accent hover:underline">
                  {r.name}
                </TeamLink>
              </div>
              <span className="stat-number text-center text-text2">{r.record ?? '—'}</span>
              <span className="text-center text-[10px] font-bold text-muted">{r.conferenceAbbr}</span>
              <span className="flex items-center justify-center gap-1">
                <Movement m={r.movement} />
                {r.previous !== null && <span className="text-[9px] text-muted">({r.previous})</span>}
              </span>
              <span className="stat-number hidden text-center text-[11px] text-muted md:block">{r.points ?? '—'}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] leading-relaxed text-muted">
        Rankings update weekly (AP and Coaches polls come out Sunday or Monday; CFP rankings Tuesday evenings from early November).
        {poll.updated ? ` Latest ${poll.name} posted ${new Date(poll.updated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.` : ''}
      </p>
    </div>
  )
}

/** College standings: conference tables (Power 4 first) and the AP / Coaches / CFP polls, with a clear note when the data is last season's. */
export function CollegeStandingsView({ data, sport }: { data: CollegeStandingsData; sport: 'cfb' | 'cbb' }) {
  const [view, setView] = useState<'conferences' | 'rankings'>('conferences')
  const [openConf, setOpenConf] = useState<string>(data.conferences[0]?.name ?? '')
  const power = data.conferences.filter((c) => c.power)
  const rest = data.conferences.filter((c) => !c.power)
  const selected = data.conferences.find((c) => c.name === openConf) ?? data.conferences[0]

  return (
    <div className="flex flex-col gap-3">
      {data.lastSeason && (
        <div className="rounded-xl border border-accent/25 bg-accent/[0.06] px-3.5 py-2.5 text-[11px] leading-relaxed text-text2">
          Showing final {data.seasonLabel} season standings. The {sport === 'cbb' ? 'next' : 'new'} season updates automatically once games begin.
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-card p-1 md:w-[320px]">
        {(['conferences', 'rankings'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} className={`rounded-lg px-3 py-2 text-[12px] font-bold capitalize transition-colors ${view === v ? 'bg-accent text-white' : 'text-muted hover:text-text'}`}>
            {v === 'conferences' ? 'Conferences' : 'Rankings'}
          </button>
        ))}
      </div>

      {view === 'rankings' ? (
        <Rankings polls={data.polls} sport={sport} />
      ) : data.conferences.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-14 text-center text-xs text-muted">Conference standings are temporarily unavailable.</div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {power.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {power.map((c) => (
                  <ConfChip key={c.name} c={c} active={selected?.name === c.name} onClick={() => setOpenConf(c.name)} />
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {rest.map((c) => (
                <ConfChip key={c.name} c={c} active={selected?.name === c.name} onClick={() => setOpenConf(c.name)} subtle />
              ))}
            </div>
          </div>
          {selected && <ConferenceTable conf={selected} sport={sport} />}
          {sport === 'cfb' && (
            <p className="text-[10px] text-muted">
              Conference order follows conference record, then overall. <Link href="/games" className="text-accent">See this week&apos;s slate →</Link>
            </p>
          )}
        </>
      )}
    </div>
  )
}

function ConfChip({ c, active, onClick, subtle = false }: { c: CollegeConferenceTable; active: boolean; onClick: () => void; subtle?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${active ? 'border-accent bg-accent/15 text-accent' : subtle ? 'border-border bg-transparent text-muted hover:text-text' : 'border-border2 bg-card text-text2 hover:text-text'}`}
    >
      {c.abbr}
    </button>
  )
}
