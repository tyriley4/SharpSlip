'use client'

import { PropConviction, usePlayerConviction, type ConvictionPlayer } from '@/components/players/PropConviction'
import { WindowCompareFromCareer } from '@/components/research/TimeWindow'
import { CareerProvider, SeasonVsCareer } from '@/components/players/CareerCompare'
import { useEffect, useState } from 'react'
import { NBA_BETTING_CATEGORIES, NBA_BETTING_THRESHOLDS, type NBABettingCategory } from '@/lib/nba/leaderCategories'
import { formatNBAThreshold } from '@/lib/nba/bettingStats'
import type { NBAGameDot } from '@/lib/nba/bettingStats'

interface CategoryStatsResponse {
  hitRate: number
  wins: number
  losses: number
  gamesPlayed: number
  last10: NBAGameDot[]
  leagueAverage: number
}

function toneClasses(hitRate: number): { text: string; bar: string; border: string; bg: string } {
  if (hitRate >= 65) return { text: 'text-positive', bar: 'bg-positive', border: 'border-positive/25', bg: 'bg-positive/[0.06]' }
  if (hitRate < 45) return { text: 'text-negative', bar: 'bg-negative', border: 'border-negative/25', bg: 'bg-negative/[0.06]' }
  return { text: 'text-text2', bar: 'bg-accent', border: 'border-border', bg: 'bg-card3' }
}

function PropCategoryCard({ playerId, category, player }: { playerId: number; category: NBABettingCategory; player?: ConvictionPlayer }) {
  const thresholds = NBA_BETTING_THRESHOLDS[category]
  const [threshold, setThreshold] = useState(thresholds[0])
  const [expanded, setExpanded] = useState(false)
  const [cache, setCache] = useState<Record<number, CategoryStatsResponse>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const conviction = usePlayerConviction(expanded && player ? { sport: 'nba', name: player.name, team: player.team, category, thresholds } : null)

  useEffect(() => {
    if (cache[threshold]) return
    let cancelled = false
    setLoading(true)
    setError(false)

    const params = new URLSearchParams({
      playerId: String(playerId),
      category,
      threshold: String(threshold),
    })

    fetch(`/api/nba-betting-stats?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((data: CategoryStatsResponse) => {
        if (cancelled) return
        setCache((prev) => ({ ...prev, [threshold]: data }))
      })
      .catch((err) => {
        console.error('[NbaPropBettingRecord] fetch failed', err)
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold, playerId, category])

  const stats = cache[threshold]
  const tone = toneClasses(stats?.hitRate ?? 0)
  const diff = stats ? Math.round((stats.hitRate - stats.leagueAverage) * 10) / 10 : 0

  return (
    <div className={`rounded-xl border transition-colors ${expanded ? tone.border : 'border-border'} ${expanded ? tone.bg : 'bg-card3'}`}>
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between gap-3 p-3 text-left">
        <span className="text-[11px] font-bold text-text md:text-xs">{category}</span>
        <div className="flex items-center gap-2">
          {stats && <span className={`text-sm font-black md:text-base ${tone.text}`}>{stats.hitRate}%</span>}
          <span className={`text-[10px] text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/60 p-3 pt-2.5">
          <div className="mb-2.5 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {thresholds.map((t) => {
              const isActive = t === threshold
              return (
                <button
                  key={t}
                  onClick={() => setThreshold(t)}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                    isActive ? 'border-accent bg-accent text-white' : 'border-border bg-transparent text-muted'
                  }`}
                >
                  {formatNBAThreshold(t)}
                  {conviction.data?.best === t && ' ★'}
                </button>
              )
            })}
          </div>

          {player && (
            <div className="mb-2.5">
              <PropConviction conviction={conviction} selected={threshold} onSelect={setThreshold} format={formatNBAThreshold} />
            </div>
          )}

          {loading && !stats ? (
            <div className="flex items-center gap-2 py-3 text-[11px] text-muted">
              <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-muted border-t-accent" />
              Calculating…
            </div>
          ) : error && !stats ? (
            <div className="py-3 text-[11px] text-muted">Stats unavailable for this threshold.</div>
          ) : stats ? (
            <div className="flex flex-col gap-2.5">
              <SeasonVsCareer season={stats} category={category} threshold={threshold} />
              <WindowCompareFromCareer category={category} threshold={threshold} />

              <div>
                <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-muted">Last 10</div>
                <div className="flex gap-1">
                  {[...stats.last10].reverse().map((d, i) => (
                    <span key={i} className={`h-2.5 w-2.5 rounded-full ${d.hit ? 'bg-positive' : 'bg-negative'}`} />
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-[9px] font-bold uppercase tracking-wide text-muted">
                  <span>vs. league avg ({stats.leagueAverage}%)</span>
                  <span className={diff >= 0 ? 'text-positive' : 'text-negative'}>
                    {diff >= 0 ? '+' : ''}
                    {diff}%
                  </span>
                </div>
                <div className="relative h-1.5 overflow-hidden rounded-full bg-border2">
                  <div className={`absolute h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(100, stats.hitRate)}%` }} />
                  <div className="absolute top-0 h-full w-px bg-text2/70" style={{ left: `${Math.min(100, stats.leagueAverage)}%` }} />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export function NbaPropBettingRecord({ playerId, player }: { playerId: number; player?: ConvictionPlayer }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 md:p-6">
      <div className="mb-3 text-[9px] font-extrabold tracking-[0.1em] text-muted md:mb-4 md:text-[10px]">PROP BETTING RECORD</div>
      <CareerProvider params={{ sport: 'nba', playerId: String(playerId) }}>
        <div className="flex flex-col gap-2">
          {NBA_BETTING_CATEGORIES.map((category) => (
            <PropCategoryCard key={category} playerId={playerId} category={category} player={player} />
          ))}
        </div>
      </CareerProvider>
    </div>
  )
}
