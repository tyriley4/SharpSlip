'use client'

import { useEffect, useState } from 'react'
import { PlayerLink } from '@/components/players/PlayerLink'
import { NBA_TEAM_COLORS } from '@/data/nba/teamColors'
import { formatNBAThreshold } from '@/lib/nba/bettingStats'
import type { NBAAssistsTabData } from '@/lib/nba/playerCardsBreakdown'

function ThresholdRow({ label, rows }: { label: string; rows: { threshold: number; hitRate: number; wins: number; losses: number }[] }) {
  return (
    <div className="mb-2">
      <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rows.map((r) => {
          const tone = r.hitRate >= 65 ? 'text-positive' : r.hitRate < 45 ? 'text-negative' : 'text-text2'
          return (
            <div key={r.threshold} className="shrink-0 rounded-xl border border-border bg-card3 p-2 text-center" style={{ minWidth: 68 }}>
              <div className="text-[10px] font-bold text-muted">{formatNBAThreshold(r.threshold)}</div>
              <div className={`text-sm font-black ${tone}`}>{r.hitRate}%</div>
              <div className="text-[9px] text-muted">
                {r.wins}-{r.losses}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function RealNBAAssistsTab({ gameId, awayAbbr, homeAbbr }: { gameId: string; awayAbbr: string; homeAbbr: string }) {
  const [team, setTeam] = useState<'away' | 'home'>('away')
  const [cache, setCache] = useState<Record<string, NBAAssistsTabData>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  const data = cache[team]

  useEffect(() => {
    if (cache[team]) return
    let cancelled = false
    setLoading(true)
    setError(false)

    fetch(`/api/nba-breakdown/assists?gameId=${encodeURIComponent(gameId)}&team=${team}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((json: NBAAssistsTabData) => {
        if (!cancelled) setCache((prev) => ({ ...prev, [team]: json }))
      })
      .catch((err) => {
        console.error('[RealNBAAssistsTab] fetch failed', err)
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

  return (
    <div className="flex flex-col gap-3 px-3.5 pt-3 md:px-8 md:pt-5">
      <div className="grid grid-cols-2 gap-1.5">
        {(['away', 'home'] as const).map((side) => {
          const sideAbbr = side === 'away' ? awayAbbr : homeAbbr
          const active = team === side
          const tc = NBA_TEAM_COLORS[sideAbbr] ?? '#4d9fff'
          return (
            <button
              key={side}
              onClick={() => setTeam(side)}
              className={`rounded-xl border-2 py-2.5 text-center text-[13px] font-bold ${active ? '' : 'border-border text-text2'}`}
              style={active ? { borderColor: tc, background: `${tc}22`, color: tc } : undefined}
            >
              🏀 {sideAbbr}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
          Loading {abbr} playmaking…
        </div>
      ) : error || !data ? (
        <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">Playmaking data unavailable.</div>
      ) : (
        <>
          {data.pace !== null && (
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <div className="text-[9px] text-muted">Team Pace</div>
              <div className="text-lg font-black text-text">{data.pace.toFixed(1)} possessions/g</div>
            </div>
          )}

          {data.players.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card py-8 text-center text-xs text-muted">No qualifying playmakers found.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {data.players.map((p) => {
                const isOpen = expanded === p.playerId
                return (
                  <div key={p.playerId} className="rounded-xl border border-border bg-card p-3">
                    <div className="mb-2">
                      <PlayerLink name={p.name} team={abbr} className="text-[12px] font-bold text-text hover:text-accent hover:underline">
                        {p.name}
                      </PlayerLink>
                    </div>
                    <div className="mb-2 grid grid-cols-4 gap-1.5">
                      <div className="rounded-[10px] border border-border bg-card3 p-2 text-center">
                        <div className="text-[9px] text-muted">AST</div>
                        <div className="text-[13px] font-black text-text">{p.apg.toFixed(1)}</div>
                      </div>
                      <div className="rounded-[10px] border border-border bg-card3 p-2 text-center">
                        <div className="text-[9px] text-muted">TO</div>
                        <div className="text-[13px] font-black text-text">{p.tov.toFixed(1)}</div>
                      </div>
                      <div className="rounded-[10px] border border-border bg-card3 p-2 text-center">
                        <div className="text-[9px] text-muted">AST/TO</div>
                        <div className="text-[13px] font-black text-text">{p.astToRatio.toFixed(2)}</div>
                      </div>
                      <div className="rounded-[10px] border border-border bg-card3 p-2 text-center">
                        <div className="text-[9px] text-muted">MIN</div>
                        <div className="text-[13px] font-black text-text">{p.min.toFixed(1)}</div>
                      </div>
                    </div>
                    <button onClick={() => setExpanded(isOpen ? null : p.playerId)} className="mb-1 text-[10px] font-bold text-accent">
                      {isOpen ? '▲ Hide' : '▼ Show'} betting thresholds
                    </button>
                    {isOpen && (
                      <>
                        <ThresholdRow label="Assists" rows={p.betting.assists} />
                        <ThresholdRow label="PRA (Points + Rebounds + Assists)" rows={p.betting.pra} />
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
