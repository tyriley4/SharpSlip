'use client'

import { useEffect, useState } from 'react'
import { SegmentTabs } from '@/components/ui/PillTabs'
import { MLB_TEAM_COLORS } from '@/data/mlb/teamColors'
import type { BettingRecordLine, SummaryTabData, TeamSummaryCard } from '@/lib/mlb/summaryBreakdown'

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function StatCell({ label, val }: { label: string; val: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-card3 p-2 text-center">
      <div className="mb-0.5 text-[9px] text-muted">{label}</div>
      <div className="text-[12px] font-black text-text">{val}</div>
    </div>
  )
}

function TeamCard({ team }: { team: TeamSummaryCard }) {
  const [expanded, setExpanded] = useState(false)
  const tc = MLB_TEAM_COLORS[team.abbr] ?? '#4d9fff'

  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-base font-black" style={{ color: tc }}>
          {team.abbr}
        </span>
        <span className="text-[11px] font-semibold text-text2">
          {team.record.wins}-{team.record.losses} ({team.record.pct}%)
        </span>
      </div>

      <div className="mb-2.5 flex items-center gap-3 text-[10px] text-muted">
        {team.homeRecord && (
          <span>
            Home {team.homeRecord.wins}-{team.homeRecord.losses}
          </span>
        )}
        {team.awayRecord && (
          <span>
            Away {team.awayRecord.wins}-{team.awayRecord.losses}
          </span>
        )}
      </div>

      <div className="mb-2.5">
        <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-muted">Last 10</div>
        <div className="flex gap-1">
          {team.last10Dots.map((d, i) => (
            <span key={i} className={`h-2.5 w-2.5 rounded-full ${d === 'W' ? 'bg-positive' : 'bg-negative'}`} />
          ))}
        </div>
      </div>

      <div className="mb-2">
        <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-muted">Offense</div>
        <div className="grid grid-cols-3 gap-1.5">
          <StatCell label="R/G" val={team.offense.runsPerGame.toFixed(2)} />
          <StatCell label="AVG" val={team.offense.avg} />
          <StatCell label="OBP" val={team.offense.obp} />
          <StatCell label="SLG" val={team.offense.slg} />
          <StatCell label="HR" val={String(team.offense.hr)} />
          <StatCell label="K%" val={`${team.offense.kPct}%`} />
        </div>
      </div>

      {team.defense && (
        <div className="mb-2">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-muted">Defense</div>
          <div className="grid grid-cols-3 gap-1.5">
            <StatCell label="ERA" val={team.defense.era.toFixed(2)} />
            <StatCell label="WHIP" val={team.defense.whip.toFixed(2)} />
            <StatCell label="K/9" val={team.defense.k9.toFixed(1)} />
            <StatCell label="BB/9" val={team.defense.bb9.toFixed(1)} />
            <StatCell label="HR Allowed" val={String(team.defense.hrAllowed)} />
          </div>
        </div>
      )}

      <button onClick={() => setExpanded((v) => !v)} className="mt-1 text-[10px] font-bold text-accent">
        {expanded ? '▲ Hide' : '▼ Show'} last 5 games
      </button>

      {expanded && (
        <div className="mt-2 overflow-hidden rounded-xl border border-border">
          {team.last5.map((g, i) => (
            <div
              key={i}
              className={`grid grid-cols-5 gap-1 px-2 py-1.5 text-[10px] ${i < team.last5.length - 1 ? 'border-b border-border' : ''}`}
            >
              <span className="text-muted">{shortDate(g.date)}</span>
              <span className="text-text2">{g.opp}</span>
              <span className={`font-bold ${g.result === 'W' ? 'text-positive' : 'text-negative'}`}>{g.result}</span>
              <span className="text-text">{g.score}</span>
              <span className="truncate text-text2">
                {g.sp ?? '—'} {g.spEra !== null ? `(${g.spEra.toFixed(2)})` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BettingLine({ line }: { line: BettingRecordLine }) {
  return (
    <div className="rounded-xl border border-border bg-card3 p-2.5 text-center">
      <div className="mb-0.5 text-[9px] text-muted">{line.label}</div>
      <div className="text-[12px] font-black text-text">
        {line.wins}-{line.losses}
      </div>
      <div className="text-[9px] font-semibold text-accent">{line.pct}%</div>
    </div>
  )
}

export function RealSummaryTab({ gamePk }: { gamePk: number }) {
  const [view, setView] = useState<'Game Stats' | 'Betting Stats'>('Game Stats')
  const [data, setData] = useState<SummaryTabData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    fetch(`/api/breakdown/summary?gamePk=${gamePk}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((json: SummaryTabData) => {
        if (!cancelled) setData(json)
      })
      .catch((err) => {
        console.error('[RealSummaryTab] fetch failed', err)
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [gamePk])

  return (
    <div className="flex flex-col gap-3 px-3.5 pt-3 md:px-8 md:pt-5">
      <SegmentTabs options={['Game Stats', 'Betting Stats']} active={view} onChange={(v) => setView(v as 'Game Stats' | 'Betting Stats')} />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
          Loading team summary…
        </div>
      ) : error || !data ? (
        <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">Summary unavailable.</div>
      ) : view === 'Game Stats' ? (
        <div className="flex flex-col gap-3 md:grid md:grid-cols-2">
          {data.away && <TeamCard team={data.away} />}
          {data.home && <TeamCard team={data.home} />}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {[data.awayBetting, data.homeBetting].map(
            (b, i) =>
              b && (
                <div key={i}>
                  <div className="mb-2 grid grid-cols-3 gap-2 md:grid-cols-5">
                    <BettingLine line={b.moneyline} />
                    <BettingLine line={b.runLine} />
                    <BettingLine line={b.overUnder} />
                    <BettingLine line={b.last10OverUnder} />
                    <BettingLine line={b.f5OverUnder} />
                  </div>
                  <p className="text-[10px] leading-relaxed text-muted">{b.note}</p>
                </div>
              )
          )}
        </div>
      )}
    </div>
  )
}
