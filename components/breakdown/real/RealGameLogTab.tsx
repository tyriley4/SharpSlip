'use client'

import { useEffect, useState } from 'react'
import { MLB_TEAM_COLORS } from '@/data/mlb/teamColors'
import type { GameLogTabData } from '@/lib/mlb/gameLogBreakdown'

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function RealGameLogTab({ gamePk, awayAbbr, homeAbbr }: { gamePk: number; awayAbbr: string; homeAbbr: string }) {
  const [team, setTeam] = useState<'away' | 'home'>('away')
  const [data, setData] = useState<GameLogTabData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    fetch(`/api/breakdown/gamelog?gamePk=${gamePk}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((json: GameLogTabData) => {
        if (!cancelled) setData(json)
      })
      .catch((err) => {
        console.error('[RealGameLogTab] fetch failed', err)
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [gamePk])

  const abbr = team === 'away' ? awayAbbr : homeAbbr
  const teamLog = data ? (team === 'away' ? data.away : data.home) : null

  return (
    <div className="flex flex-col gap-3 px-3.5 pt-3 md:px-8 md:pt-5">
      <div className="grid grid-cols-2 gap-1.5">
        {(['away', 'home'] as const).map((side) => {
          const sideAbbr = side === 'away' ? awayAbbr : homeAbbr
          const active = team === side
          const tc = MLB_TEAM_COLORS[sideAbbr] ?? '#4d9fff'
          return (
            <button
              key={side}
              onClick={() => setTeam(side)}
              className={`rounded-xl border-2 py-2.5 text-center text-[13px] font-bold ${active ? '' : 'border-border text-text2'}`}
              style={active ? { borderColor: tc, background: `${tc}22`, color: tc } : undefined}
            >
              ⚾ {sideAbbr}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
          Loading {abbr} game log…
        </div>
      ) : error || !teamLog ? (
        <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">Game log unavailable.</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <div style={{ minWidth: 620 }}>
              <div className="grid gap-1 border-b border-border bg-card3 px-2.5 py-2 text-[9px] font-bold text-muted" style={{ gridTemplateColumns: '1fr 0.7fr 0.5fr 0.8fr 1.5fr 0.6fr 0.5fr 0.5fr 1fr' }}>
                <span>DATE</span>
                <span>OPP</span>
                <span className="text-center">W/L</span>
                <span className="text-center">SCORE</span>
                <span>SP</span>
                <span className="text-center">IP</span>
                <span className="text-center">ER</span>
                <span className="text-center">HR</span>
                <span>NOTES</span>
              </div>
              {teamLog.rows.map((r, i) => (
                <div
                  key={i}
                  className={`grid items-center gap-1 px-2.5 py-2 text-[11px] ${i < teamLog.rows.length - 1 ? 'border-b border-border' : ''}`}
                  style={{ gridTemplateColumns: '1fr 0.7fr 0.5fr 0.8fr 1.5fr 0.6fr 0.5fr 0.5fr 1fr' }}
                >
                  <span className="text-text2">{shortDate(r.date)}</span>
                  <span className="text-text2">{r.opp}</span>
                  <span className={`text-center font-black ${r.result === 'W' ? 'text-positive' : 'text-negative'}`}>{r.result}</span>
                  <span className="text-center text-text">{r.score}</span>
                  <span className="truncate text-text2">{r.sp ?? '—'}</span>
                  <span className="text-center text-text">{r.ip ?? '—'}</span>
                  <span className="text-center text-text">{r.er ?? '—'}</span>
                  <span className="text-center text-text">{r.hr ?? '—'}</span>
                  <span className="text-[9px] font-bold text-accent">{r.notes.join(', ')}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            <div className="rounded-xl bg-card3 px-2 py-2.5 text-center">
              <div className="text-sm font-extrabold text-text">
                {teamLog.summary.wins}-{teamLog.summary.losses}
              </div>
              <div className="text-[9px] text-muted">Record</div>
            </div>
            <div className="rounded-xl bg-card3 px-2 py-2.5 text-center">
              <div className="text-sm font-extrabold text-text">{teamLog.summary.avgRunsScored}</div>
              <div className="text-[9px] text-muted">Avg Runs Scored</div>
            </div>
            <div className="rounded-xl bg-card3 px-2 py-2.5 text-center">
              <div className="text-sm font-extrabold text-text">{teamLog.summary.avgRunsAllowed}</div>
              <div className="text-[9px] text-muted">Avg Runs Allowed</div>
            </div>
            <div className="rounded-xl bg-card3 px-2 py-2.5 text-center">
              <div className="text-sm font-extrabold text-text">
                {teamLog.summary.overWins}-{teamLog.summary.overLosses}
              </div>
              <div className="text-[9px] text-muted">O/U (vs lg avg total)</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
