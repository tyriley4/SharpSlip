'use client'

import { useEffect, useState } from 'react'
import { PillTabs } from '@/components/ui/PillTabs'
import type { NFLTrend, NFLTrendCategory } from '@/lib/nfl/trendsEngine'

const CATEGORIES: NFLTrendCategory[] = ['Form', 'Passing', 'Rushing', 'Situational', 'H2H']

const CATEGORY_COLOR: Record<NFLTrendCategory, string> = {
  Form: 'text-accent border-accent/40 bg-accent/15',
  Passing: 'text-positive border-positive/40 bg-positive/15',
  Rushing: 'text-warning border-warning/40 bg-warning/15',
  Situational: 'text-negative border-negative/40 bg-negative/15',
  H2H: 'text-muted border-border bg-card3',
}

function TrendCard({ trend }: { trend: NFLTrend }) {
  return (
    <div className={`mb-2 rounded-2xl border bg-card p-3.5 ${trend.hot ? 'border-positive/30' : 'border-border'}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${CATEGORY_COLOR[trend.category]}`}>{trend.category}</span>
        {trend.hot && <span className="text-[10px] font-bold text-positive">🔥 Strong Signal</span>}
      </div>
      <div className="mb-1 text-[13px] font-bold text-text">{trend.title}</div>
      <div className="mb-1.5 text-[11px] font-semibold text-text2">{trend.stat}</div>
      <p className="text-[10px] leading-relaxed text-muted">{trend.note}</p>
    </div>
  )
}

export function RealNFLTrendsTab({ gameId, apiBase = '/api/nfl-breakdown' }: { gameId: string; apiBase?: string }) {
  const [filter, setFilter] = useState<'All' | NFLTrendCategory>('All')
  const [trends, setTrends] = useState<NFLTrend[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    fetch(`${apiBase}/trends?gameId=${encodeURIComponent(gameId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((json: { trends: NFLTrend[] }) => {
        if (!cancelled) setTrends(json.trends)
      })
      .catch((err) => {
        console.error('[RealNFLTrendsTab] fetch failed', err)
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [gameId, apiBase])

  const filtered = !trends ? [] : filter === 'All' ? trends : trends.filter((t) => t.category === filter)

  return (
    <div className="flex flex-col gap-3 px-3.5 pt-3 md:px-8 md:pt-5">
      <PillTabs options={['All', ...CATEGORIES]} active={filter} onChange={(v) => setFilter(v as 'All' | NFLTrendCategory)} />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
          Analyzing real stats for trends…
        </div>
      ) : error || !trends ? (
        <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">Trends unavailable.</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">
          No {filter === 'All' ? '' : `${filter} `}trends clear our thresholds for this matchup right now.
        </div>
      ) : (
        filtered.map((t) => <TrendCard key={t.id} trend={t} />)
      )}
    </div>
  )
}
