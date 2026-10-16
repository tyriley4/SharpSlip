'use client'

import { useEffect, useState } from 'react'
import { BetAnalysis } from '@/components/breakdown/BetAnalysis'
import { GradeBadge, InsightList, SharpFindBadge } from '@/components/breakdown/BetCard'
import type { PlayerConviction, ThresholdConviction } from '@/lib/edges/playerEdge'
import type { Sport } from '@/lib/sport/SportContext'

export interface ConvictionQuery {
  sport: Sport
  name: string
  team: string
  category: string
  thresholds: number[]
  pitching?: boolean
}

const memo = new Map<string, PlayerConviction>()

/** Conviction per threshold for one prop category against tonight's game; null while loading or when no query applies. */
export function usePlayerConviction(query: ConvictionQuery | null): { data: PlayerConviction | null; loading: boolean } {
  const key = query ? `${query.sport}|${query.name}|${query.team}|${query.category}|${query.thresholds.join(',')}|${query.pitching ? 1 : 0}` : ''
  const [data, setData] = useState<PlayerConviction | null>(key ? memo.get(key) ?? null : null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query || !key) return
    const hit = memo.get(key)
    if (hit) {
      setData(hit)
      return
    }
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams({ sport: query.sport, name: query.name, team: query.team, category: query.category, thresholds: query.thresholds.join(',') })
    if (query.pitching) params.set('pitching', '1')
    fetch(`/api/player-conviction?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
      .then((d: PlayerConviction) => {
        memo.set(key, d)
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { data, loading }
}

export function ConvictionSummary({ row, matchup }: { row: ThresholdConviction; matchup?: string }) {
  const [all, setAll] = useState(false)
  const shown = all ? row.insights : row.insights.slice(0, 2)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <GradeBadge grade={row.grade} />
        <div className="flex flex-col">
          <span className="text-[11px] font-bold text-text">
            {row.grade ? `Grade ${row.grade}` : 'Insufficient data'}
            {row.historicalHitRate !== null && <span className="ml-1.5 font-semibold text-text2">{Math.round(row.historicalHitRate)}% historical</span>}
          </span>
          {matchup && <span className="text-[10px] text-muted">vs. tonight&apos;s matchup · {matchup}</span>}
        </div>
        {row.isSharpFind && <SharpFindBadge />}
        {row.limitedSample && <span className="text-[10px] font-semibold text-warning">Limited sample</span>}
      </div>
      {shown.length > 0 && <InsightList insights={shown} />}
      {row.explanation && <BetAnalysis text={row.explanation} />}
      {row.insights.length > 2 && (
        <button onClick={() => setAll((v) => !v)} className="self-start text-[11px] font-semibold text-accent hover:underline">
          {all ? 'Show fewer insights ↑' : `View all ${row.insights.length} insights →`}
        </button>
      )}
    </div>
  )
}

/**
 * Conviction for the threshold picked in a prop calculator, with the most valuable threshold called out.
 * Renders nothing until there is a game tonight and enough history to speak to.
 */
export function PropConviction({ conviction, selected, onSelect, format }: { conviction: { data: PlayerConviction | null; loading: boolean }; selected: number; onSelect?: (t: number) => void; format: (t: number) => string }) {
  const { data, loading } = conviction
  if (loading && !data) return <div className="text-[10px] text-muted">Checking tonight&apos;s matchup…</div>
  if (!data) return null
  if (!data.available) return <div className="text-[10px] text-muted">{data.reason === 'No game today' ? 'No game tonight — conviction grades appear on game days.' : 'Conviction analysis unavailable for this player.'}</div>
  const row = data.thresholds.find((r) => r.threshold === selected)
  const best = data.thresholds.find((r) => r.threshold === data.best)
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2.5">
      {best && (
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-text2">
          <span className="font-extrabold tracking-wide text-accent">MOST VALUABLE TONIGHT</span>
          <button onClick={() => onSelect?.(best.threshold)} className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-bold text-accent">
            {format(best.threshold)} · Grade {best.grade}
          </button>
          {best.isSharpFind && <SharpFindBadge />}
        </div>
      )}
      {row ? <ConvictionSummary row={row} matchup={data.matchup} /> : null}
    </div>
  )
}

export interface ConvictionPlayer {
  name: string
  team: string
}
