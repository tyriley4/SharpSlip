'use client'

import { useEffect, useState } from 'react'
import { PlayerLink } from '@/components/players/PlayerLink'
import { NHL_TEAM_COLORS } from '@/data/nhl/teamColors'
import { formatNHLThreshold } from '@/lib/nhl/bettingStats'
import type { NHLGoalieTabData } from '@/lib/nhl/playerCardsBreakdown'

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function RealNHLGoalieTab({ gameId, awayAbbr, homeAbbr }: { gameId: string; awayAbbr: string; homeAbbr: string }) {
  const [team, setTeam] = useState<'away' | 'home'>('away')
  const [cache, setCache] = useState<Record<string, NHLGoalieTabData>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const data = cache[team]

  useEffect(() => {
    if (cache[team]) return
    let cancelled = false
    setLoading(true)
    setError(false)

    fetch(`/api/nhl-breakdown/goalie?gameId=${encodeURIComponent(gameId)}&team=${team}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((json: NHLGoalieTabData) => {
        if (!cancelled) setCache((prev) => ({ ...prev, [team]: json }))
      })
      .catch((err) => {
        console.error('[RealNHLGoalieTab] fetch failed', err)
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, gameId])

  const abbr = team === 'away' ? awayAbbr : homeAbbr
  const goalie = data?.goalie

  return (
    <div className="flex flex-col gap-3 px-3.5 pt-3 md:px-8 md:pt-5">
      <div className="grid grid-cols-2 gap-1.5">
        {(['away', 'home'] as const).map((side) => {
          const sideAbbr = side === 'away' ? awayAbbr : homeAbbr
          const active = team === side
          const tc = NHL_TEAM_COLORS[sideAbbr] ?? '#4d9fff'
          return (
            <button
              key={side}
              onClick={() => setTeam(side)}
              className={`rounded-xl border-2 py-2.5 text-center text-[13px] font-bold ${active ? '' : 'border-border text-text2'}`}
              style={active ? { borderColor: tc, background: `${tc}22`, color: tc } : undefined}
            >
              🥅 {sideAbbr}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
          Loading {abbr} goalie…
        </div>
      ) : error || !data || !goalie ? (
        <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">Goalie data unavailable.</div>
      ) : (
        <>
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <PlayerLink name={goalie.name} team={abbr} className="text-[13px] font-bold text-text hover:text-accent hover:underline">
                {goalie.name}
              </PlayerLink>
              <span className="text-[11px] font-semibold text-text2">
                {goalie.wins}-{goalie.losses}-{goalie.otLosses}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <div className="rounded-[10px] border border-border bg-card3 p-2 text-center">
                <div className="text-[9px] text-muted">SV%</div>
                <div className="text-[13px] font-black text-text">{(goalie.savePct * 100).toFixed(1)}%</div>
              </div>
              <div className="rounded-[10px] border border-border bg-card3 p-2 text-center">
                <div className="text-[9px] text-muted">GAA</div>
                <div className="text-[13px] font-black text-text">{goalie.gaa.toFixed(2)}</div>
              </div>
              <div className="rounded-[10px] border border-border bg-card3 p-2 text-center">
                <div className="text-[9px] text-muted">SO</div>
                <div className="text-[13px] font-black text-text">{goalie.shutouts}</div>
              </div>
              <div className="rounded-[10px] border border-border bg-card3 p-2 text-center">
                <div className="text-[9px] text-muted">MIN</div>
                <div className="text-[13px] font-black text-text">{goalie.min}</div>
              </div>
            </div>
          </div>

          {goalie.last5.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="grid grid-cols-6 gap-1 border-b border-border bg-card3 px-2.5 py-2 text-[9px] font-bold text-muted">
                <span>DATE</span>
                <span>OPP</span>
                <span className="text-center">DEC</span>
                <span className="text-center">SA</span>
                <span className="text-center">SV</span>
                <span className="text-center">SV%</span>
              </div>
              {goalie.last5.map((g, i) => (
                <div key={i} className={`grid grid-cols-6 gap-1 px-2.5 py-2 text-[11px] ${i < goalie.last5.length - 1 ? 'border-b border-border' : ''}`}>
                  <span className="text-muted">{shortDate(g.date)}</span>
                  <span className="text-text2">{g.opp}</span>
                  <span className={`text-center font-bold ${g.decision === 'W' ? 'text-positive' : 'text-negative'}`}>{g.decision ?? '—'}</span>
                  <span className="text-center text-text">{g.shotsAgainst}</span>
                  <span className="text-center text-text">{g.saves}</span>
                  <span className="text-center text-text2">{(g.savePct * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}

          {goalie.betting.length > 0 && (
            <div>
              <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-muted">Saves</div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {goalie.betting.map((r) => {
                  const tone = r.hitRate >= 65 ? 'text-positive' : r.hitRate < 45 ? 'text-negative' : 'text-text2'
                  return (
                    <div key={r.threshold} className="shrink-0 rounded-xl border border-border bg-card3 p-2 text-center" style={{ minWidth: 68 }}>
                      <div className="text-[10px] font-bold text-muted">{formatNHLThreshold(r.threshold)}</div>
                      <div className={`text-sm font-black ${tone}`}>{r.hitRate}%</div>
                      <div className="text-[9px] text-muted">
                        {r.wins}-{r.losses}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
