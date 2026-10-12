'use client'

import { useEffect, useState } from 'react'
import { PlayerLink } from '@/components/players/PlayerLink'
import { NHL_TEAM_COLORS } from '@/data/nhl/teamColors'
import { formatNHLThreshold } from '@/lib/nhl/bettingStats'
import type { NHLScoringTabData } from '@/lib/nhl/playerCardsBreakdown'

function formatToi(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function ThresholdRow({ label, rows }: { label: string; rows: { threshold: number; hitRate: number; wins: number; losses: number }[] }) {
  return (
    <div className="mb-2">
      <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rows.map((r) => {
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
  )
}

export function RealNHLScoringTab({ gameId, awayAbbr, homeAbbr }: { gameId: string; awayAbbr: string; homeAbbr: string }) {
  const [team, setTeam] = useState<'away' | 'home'>('away')
  const [cache, setCache] = useState<Record<string, NHLScoringTabData>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  const data = cache[team]

  useEffect(() => {
    if (cache[team]) return
    let cancelled = false
    setLoading(true)
    setError(false)

    fetch(`/api/nhl-breakdown/scoring?gameId=${encodeURIComponent(gameId)}&team=${team}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((json: NHLScoringTabData) => {
        if (!cancelled) setCache((prev) => ({ ...prev, [team]: json }))
      })
      .catch((err) => {
        console.error('[RealNHLScoringTab] fetch failed', err)
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
          const tc = NHL_TEAM_COLORS[sideAbbr] ?? '#4d9fff'
          return (
            <button
              key={side}
              onClick={() => setTeam(side)}
              className={`rounded-xl border-2 py-2.5 text-center text-[13px] font-bold ${active ? '' : 'border-border text-text2'}`}
              style={active ? { borderColor: tc, background: `${tc}22`, color: tc } : undefined}
            >
              🏒 {sideAbbr}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
          Loading {abbr} scoring…
        </div>
      ) : error || !data ? (
        <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">Scoring data unavailable.</div>
      ) : data.players.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">No qualifying scorers found.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {data.players.map((p) => {
            const isOpen = expanded === p.playerId
            return (
              <div key={p.playerId} className="rounded-xl border border-border bg-card p-3">
                <div className="mb-2 flex items-center justify-between">
                  <PlayerLink name={p.name} team={abbr} className="text-[12px] font-bold text-text hover:text-accent hover:underline">
                    {p.name}
                  </PlayerLink>
                  <div className="flex gap-1">
                    {p.last5.map((d, i) => (
                      <span key={i} className={`h-2 w-2 rounded-full ${d.hit ? 'bg-positive' : 'bg-negative'}`} />
                    ))}
                  </div>
                </div>
                <div className="mb-2 grid grid-cols-6 gap-1.5">
                  <div className="rounded-[10px] border border-border bg-card3 p-2 text-center">
                    <div className="text-[9px] text-muted">G</div>
                    <div className="text-[13px] font-black text-text">{p.goals}</div>
                  </div>
                  <div className="rounded-[10px] border border-border bg-card3 p-2 text-center">
                    <div className="text-[9px] text-muted">A</div>
                    <div className="text-[13px] font-black text-text">{p.assists}</div>
                  </div>
                  <div className="rounded-[10px] border border-border bg-card3 p-2 text-center">
                    <div className="text-[9px] text-muted">PTS</div>
                    <div className="text-[13px] font-black text-text">{p.points}</div>
                  </div>
                  <div className="rounded-[10px] border border-border bg-card3 p-2 text-center">
                    <div className="text-[9px] text-muted">+/-</div>
                    <div className={`text-[13px] font-black ${p.plusMinus >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {p.plusMinus >= 0 ? `+${p.plusMinus}` : p.plusMinus}
                    </div>
                  </div>
                  <div className="rounded-[10px] border border-border bg-card3 p-2 text-center">
                    <div className="text-[9px] text-muted">SOG</div>
                    <div className="text-[13px] font-black text-text">{p.shots}</div>
                  </div>
                  <div className="rounded-[10px] border border-border bg-card3 p-2 text-center">
                    <div className="text-[9px] text-muted">TOI</div>
                    <div className="text-[13px] font-black text-text">{formatToi(p.avgToiSeconds)}</div>
                  </div>
                </div>
                <button onClick={() => setExpanded(isOpen ? null : p.playerId)} className="mb-1 text-[10px] font-bold text-accent">
                  {isOpen ? '▲ Hide' : '▼ Show'} betting thresholds
                </button>
                {isOpen && (
                  <>
                    <ThresholdRow label="Points" rows={p.betting.points} />
                    <ThresholdRow label="Goals" rows={p.betting.goals} />
                    <ThresholdRow label="Assists" rows={p.betting.assists} />
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
