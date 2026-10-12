'use client'

import { useEffect, useState } from 'react'
import { SegmentTabs } from '@/components/ui/PillTabs'
import { NHL_TEAM_COLORS } from '@/data/nhl/teamColors'
import type { NHLBettingLine, NHLSummaryTabData, NHLTeamSummaryCard } from '@/lib/nhl/summaryBreakdown'

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

function TeamCard({ team }: { team: NHLTeamSummaryCard }) {
  const [expanded, setExpanded] = useState(false)
  const tc = NHL_TEAM_COLORS[team.abbr] ?? '#4d9fff'

  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-base font-black" style={{ color: tc }}>
          {team.abbr}
        </span>
        <span className="text-[11px] font-semibold text-text2">
          {team.record.wins}-{team.record.losses}-{team.record.otLosses} ({(team.record.pointPct * 100).toFixed(1)}%)
        </span>
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
        <div className="grid grid-cols-4 gap-1.5">
          <StatCell label="GPG" val={team.offense.gpg.toFixed(1)} />
          <StatCell label="SH%" val={`${(team.offense.shPct * 100).toFixed(1)}%`} />
          <StatCell label="SOG/G" val={team.offense.sogPerGame.toFixed(1)} />
          <StatCell label="PP%" val={`${(team.offense.ppPct * 100).toFixed(1)}%`} />
        </div>
      </div>

      <div className="mb-2">
        <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-muted">Defense</div>
        <div className="grid grid-cols-4 gap-1.5">
          <StatCell label="GAA" val={team.defense.gaa.toFixed(2)} />
          <StatCell label="SV%" val={`${(team.defense.svPct * 100).toFixed(1)}%`} />
          <StatCell label="SA/G" val={team.defense.saPerGame.toFixed(1)} />
          <StatCell label="PK%" val={`${(team.defense.pkPct * 100).toFixed(1)}%`} />
        </div>
      </div>

      <button onClick={() => setExpanded((v) => !v)} className="mt-1 text-[10px] font-bold text-accent">
        {expanded ? '▲ Hide' : '▼ Show'} last 5 games
      </button>

      {expanded && (
        <div className="mt-2 overflow-hidden rounded-xl border border-border">
          {team.last5.map((g, i) => (
            <div key={i} className={`grid grid-cols-4 gap-1 px-2 py-1.5 text-[10px] ${i < team.last5.length - 1 ? 'border-b border-border' : ''}`}>
              <span className="text-muted">{shortDate(g.date)}</span>
              <span className="text-text2">{g.opp}</span>
              <span className={`font-bold ${g.result === 'W' ? 'text-positive' : 'text-negative'}`}>{g.result}</span>
              <span className="text-text">{g.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BettingLine({ line }: { line: NHLBettingLine }) {
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

export function RealNHLSummaryTab({ gameId }: { gameId: string }) {
  const [view, setView] = useState<'Game Stats' | 'Betting Stats'>('Game Stats')
  const [data, setData] = useState<NHLSummaryTabData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    fetch(`/api/nhl-breakdown/summary?gameId=${encodeURIComponent(gameId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((json: NHLSummaryTabData) => {
        if (!cancelled) setData(json)
      })
      .catch((err) => {
        console.error('[RealNHLSummaryTab] fetch failed', err)
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [gameId])

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
        !data.away && !data.home ? (
          <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">Team stats unavailable.</div>
        ) : (
          <div className="flex flex-col gap-3 md:grid md:grid-cols-2">
            {data.away && <TeamCard team={data.away} />}
            {data.home && <TeamCard team={data.home} />}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-4">
          {[data.awayBetting, data.homeBetting].map(
            (b, i) =>
              b && (
                <div key={i}>
                  <div className="mb-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <BettingLine line={b.moneyline} />
                    <BettingLine line={b.puckLine} />
                    <BettingLine line={b.overUnder} />
                    <BettingLine line={b.last5OverUnder} />
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
