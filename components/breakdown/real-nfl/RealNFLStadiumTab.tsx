'use client'

import { useEffect, useState } from 'react'
import { WeatherPanel } from '@/components/breakdown/WeatherPanel'
import type { NFLStadiumTabData } from '@/lib/nfl/stadiumBreakdown'

export function RealNFLStadiumTab({ gameId }: { gameId: string }) {
  const [data, setData] = useState<NFLStadiumTabData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    fetch(`/api/nfl-breakdown/stadium?gameId=${encodeURIComponent(gameId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((json: NFLStadiumTabData) => {
        if (!cancelled) setData(json)
      })
      .catch((err) => {
        console.error('[RealNFLStadiumTab] fetch failed', err)
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [gameId])

  if (loading) {
    return (
      <div className="px-3.5 pt-3 md:px-8 md:pt-5">
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
          Loading stadium data…
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="px-3.5 pt-3 md:px-8 md:pt-5">
        <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">Stadium data unavailable.</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 px-3.5 pt-3 md:px-8 md:pt-5">
      <div>
        <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">STADIUM</div>
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <div className="mb-1 text-base font-black text-text">{data.stadium.name}</div>
          <div className="mb-3 text-[11px] text-muted">{data.stadium.city}</div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-[10px] bg-card3 p-2 text-center">
              <div className="text-[9px] text-muted">Surface</div>
              <div className="text-[12px] font-bold capitalize text-text">{data.stadium.surface}</div>
            </div>
            <div className="rounded-[10px] bg-card3 p-2 text-center">
              <div className="text-[9px] text-muted">Roof</div>
              <div className="text-[12px] font-bold capitalize text-text">{data.stadium.roof}</div>
            </div>
          </div>
          <p className="mt-2 text-[9px] leading-relaxed text-muted">Capacity isn&apos;t published in the free nflverse schedule release.</p>
        </div>
      </div>

      <div>
        <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">WEATHER</div>
        <WeatherPanel weather={data.weather} indoor={data.stadium.indoor} />
      </div>

      <div>
        <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">HOME EDGE</div>
        <div className="rounded-2xl border border-border bg-card p-3.5">
          {data.homeEdge.homeWinPct !== null && (
            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between text-[10px]">
                <span className="text-muted">Home Win%</span>
                <span className="font-bold text-text">{data.homeEdge.homeWinPct.toFixed(0)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-border2">
                <div className="h-full rounded-full bg-accent" style={{ width: `${data.homeEdge.homeWinPct}%` }} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            {data.homeEdge.atsHome && (
              <div className="rounded-[10px] bg-card3 p-2 text-center">
                <div className="text-[9px] text-muted">ATS at Home</div>
                <div className="text-[12px] font-bold text-text">
                  {data.homeEdge.atsHome.wins}-{data.homeEdge.atsHome.losses} ({data.homeEdge.atsHome.pct}%)
                </div>
              </div>
            )}
            {data.homeEdge.overUnderHome && (
              <div className="rounded-[10px] bg-card3 p-2 text-center">
                <div className="text-[9px] text-muted">O/U at Home</div>
                <div className="text-[12px] font-bold text-text">
                  {data.homeEdge.overUnderHome.wins}-{data.homeEdge.overUnderHome.losses} ({data.homeEdge.overUnderHome.pct}%)
                </div>
              </div>
            )}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-text2">{data.homeEdge.crowdNoiseNote}</p>
        </div>
      </div>

      <div>
        <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">HISTORY</div>
        {data.history.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-8 text-center text-xs text-muted">No prior-season data available.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="grid grid-cols-4 gap-1 border-b border-border bg-card3 px-2.5 py-2 text-[9px] font-bold text-muted">
              <span>SEASON</span>
              <span className="text-center">HOME</span>
              <span className="text-center">ATS</span>
              <span className="text-center">AVG TOTAL</span>
            </div>
            {data.history.map((h) => (
              <div key={h.season} className="grid grid-cols-4 gap-1 border-b border-border px-2.5 py-2 text-[11px] last:border-b-0">
                <span className="text-text2">{h.season}</span>
                <span className="text-center text-text">
                  {h.homeWins}-{h.homeLosses}
                </span>
                <span className="text-center text-text">
                  {h.atsWins}-{h.atsLosses}
                </span>
                <span className="text-center text-text">{h.avgTotalPoints}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">BET IMPACT</div>
        {data.betImpact.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-8 text-center text-xs text-muted">No significant factors right now.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {data.betImpact.map((c, i) => (
              <div key={i} className="rounded-xl border border-accent/25 bg-accent/[0.06] p-3">
                <div className="mb-1 text-[12px] font-bold text-text">{c.title}</div>
                <p className="mb-1.5 text-[10px] leading-relaxed text-text2">{c.detail}</p>
                <div className="flex flex-wrap gap-1">
                  {c.affects.map((a) => (
                    <span key={a} className="rounded-full border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold text-accent">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
