'use client'

import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TrendQuery, TrendResult } from '@/lib/trend/types'

const LINE_COLORS = ['#3B9EFF', '#00E5A0', '#FFB800', '#FF6B35', '#C084FC']
const TEXT = '#F0F2F5'

export interface TrendPlayer {
  name: string
  team: string
}

function direction(points: number[], betting: boolean): { arrow: string; color: string } {
  if (points.length < 4) return { arrow: '→', color: '#8B909A' }
  const half = Math.floor(points.length / 2)
  const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length
  const delta = avg(points.slice(-half)) - avg(points.slice(0, half))
  // Hit rates move in percentage points; game stats move relative to their own scale.
  const threshold = betting ? 3 : Math.max(Math.abs(avg(points)) * 0.05, 1e-6)
  if (delta > threshold) return { arrow: '▲', color: '#00E5A0' }
  if (delta < -threshold) return { arrow: '▼', color: '#EF4444' }
  return { arrow: '→', color: '#8B909A' }
}

/** Rolling trend lines for the board's top players — game-stat averages, or hit rates in Betting Stats. */
export function TrendChart({ query, players, career }: { query: TrendQuery; players: TrendPlayer[]; career?: boolean }) {
  const [result, setResult] = useState<TrendResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const key = `${query.sport}|${query.sub}|${query.mode}|${query.category}|${query.threshold ?? ''}|${players.map((p) => p.name).join(',')}`

  useEffect(() => {
    if (players.length === 0) return
    let cancelled = false
    setLoading(true)
    setError(false)

    const params = new URLSearchParams({
      sport: query.sport,
      sub: query.sub,
      mode: query.mode,
      category: query.category,
      players: players.map((p) => `${p.name}|${p.team}`).join(';;'),
    })
    if (query.threshold !== undefined) params.set('threshold', String(query.threshold))

    fetch(`/api/trends?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((data: TrendResult) => {
        if (!cancelled) setResult(data)
      })
      .catch((err) => {
        console.error('[TrendChart] fetch failed', err)
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const series = useMemo(() => (result?.series ?? []).filter((s) => s.points.length >= 2), [result])
  const data = useMemo(() => {
    const longest = Math.max(0, ...series.map((s) => s.points.length))
    return Array.from({ length: longest }, (_, i) => {
      const row: Record<string, number> = { game: i + 1 }
      for (const s of series) {
        // Right-align so every line ends on the player's latest game.
        const idx = i - (longest - s.points.length)
        if (idx >= 0) row[s.name] = s.points[idx]
      }
      return row
    })
  }, [series])

  const betting = query.mode === 'betting'

  return (
    <div className="rounded-xl border border-border bg-card2 p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="section-header text-sm md:text-base" style={{ color: TEXT }}>
          Trend — {betting ? 'hit rate' : query.category}
        </h3>
        <span className="text-[10px] text-muted">{result?.yLabel ?? 'Last 30 games'}</span>
      </div>
      {career && <p className="mb-1 text-[10px] text-muted">Trend lines show the current season’s last 30 games, even in Career view.</p>}

      <div className="h-[260px]">
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-xs" style={{ color: TEXT }}>
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
            Building trend lines…
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center text-xs" style={{ color: TEXT }}>
            Trend data is temporarily unavailable.
          </div>
        ) : series.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-xs" style={{ color: TEXT }}>
            Not enough games played yet to draw a trend. {result?.note ?? ''}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 16, bottom: 22, left: 0 }}>
              <CartesianGrid stroke="#1F2229" strokeDasharray="3 3" />
              <XAxis dataKey="game" type="number" domain={[1, 'dataMax']} allowDecimals={false} tick={{ fill: TEXT, fontSize: 11 }} stroke="#3A3E48" label={{ value: 'Game #', position: 'insideBottom', offset: -12, fill: TEXT, fontSize: 11 }} />
              <YAxis tick={{ fill: TEXT, fontSize: 11 }} stroke="#3A3E48" width={40} domain={betting ? [0, 100] : ['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#16191F', border: '1px solid #2A2D35', borderRadius: 12, color: TEXT, fontSize: 11 }}
                labelStyle={{ color: TEXT }}
                labelFormatter={(g) => `Game ${g}`}
                formatter={(v: number) => (betting ? `${Math.round(v)}%` : String(Math.round(v * 100) / 100))}
              />
              {series.map((s, i) => (
                <Line key={s.name} type="monotone" dataKey={s.name} stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2.25} dot={false} connectNulls isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {series.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
          {series.map((s, i) => {
            const dir = direction(s.points, betting)
            return (
              <span key={s.name} className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: TEXT }}>
                <span className="h-2 w-4 rounded-full" style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
                {s.name}
                <span style={{ color: dir.color }}>{dir.arrow}</span>
              </span>
            )
          })}
        </div>
      )}
      {result?.note && series.length > 0 && <p className="mt-2 text-[10px] text-muted">{result.note}</p>}
    </div>
  )
}
