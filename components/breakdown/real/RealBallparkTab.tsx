'use client'

import { useEffect, useState } from 'react'
import { WeatherPanel } from '@/components/breakdown/WeatherPanel'
import type { BallparkTabData } from '@/lib/mlb/ballparkBreakdown'

function factorColor(n: number): string {
  if (n >= 105) return 'text-positive'
  if (n <= 95) return 'text-negative'
  return 'text-text2'
}

export function RealBallparkTab({ gamePk }: { gamePk: number }) {
  const [data, setData] = useState<BallparkTabData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    fetch(`/api/breakdown/ballpark?gamePk=${gamePk}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((json: BallparkTabData) => {
        if (!cancelled) setData(json)
      })
      .catch((err) => {
        console.error('[RealBallparkTab] fetch failed', err)
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [gamePk])

  if (loading) {
    return (
      <div className="px-3.5 pt-3 md:px-8 md:pt-5">
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
          Loading ballpark data…
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="px-3.5 pt-3 md:px-8 md:pt-5">
        <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">Ballpark data unavailable.</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 px-3.5 pt-3 md:px-8 md:pt-5">
      <div>
        <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">STADIUM</div>
        {data.stadium ? (
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <div className="mb-1 text-base font-black text-text">{data.stadium.name}</div>
            <div className="mb-3 text-[11px] text-muted">
              {data.stadium.city}
              {data.stadium.state ? `, ${data.stadium.state}` : ''}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <div className="rounded-[10px] bg-card3 p-2 text-center">
                <div className="text-[9px] text-muted">Capacity</div>
                <div className="text-[12px] font-bold text-text">{data.stadium.capacity?.toLocaleString() ?? '—'}</div>
              </div>
              <div className="rounded-[10px] bg-card3 p-2 text-center">
                <div className="text-[9px] text-muted">Surface</div>
                <div className="text-[12px] font-bold text-text">{data.stadium.surface ?? '—'}</div>
              </div>
              <div className="rounded-[10px] bg-card3 p-2 text-center">
                <div className="text-[9px] text-muted">Roof</div>
                <div className="text-[12px] font-bold text-text">{data.stadium.roofType ?? '—'}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card py-8 text-center text-xs text-muted">Venue data unavailable.</div>
        )}
      </div>

      <div>
        <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">PARK FACTORS</div>
        {data.parkFactors ? (
          <>
            <div className="grid grid-cols-3 gap-1.5">
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <div className={`text-lg font-black ${factorColor(data.parkFactors.runsFactor)}`}>{data.parkFactors.runsFactor}</div>
                <div className="text-[9px] text-muted">Runs Factor</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <div className={`text-lg font-black ${factorColor(data.parkFactors.hrFactor)}`}>{data.parkFactors.hrFactor}</div>
                <div className="text-[9px] text-muted">HR Factor</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <div className={`text-lg font-black ${factorColor(data.parkFactors.hitsFactor)}`}>{data.parkFactors.hitsFactor}</div>
                <div className="text-[9px] text-muted">Hits Factor</div>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted">
              100 = league neutral. Above 100 (green) favors hitters, below 100 (red) favors pitchers. {data.parkFactors.method}
            </p>
          </>
        ) : (
          <div className="rounded-2xl border border-border bg-card py-8 text-center text-xs text-muted">
            Not enough home/road games played yet this season to derive a park factor.
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">WEATHER</div>
        <WeatherPanel weather={data.weather} indoor={data.stadium?.roofType === 'Dome'} indoorLabel="Indoor ballpark — weather neutral." />
      </div>

      <div>
        <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">BETTING IMPACT</div>
        {data.bettingImpact.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-8 text-center text-xs text-muted">
            No significant park/weather combinations right now.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {data.bettingImpact.map((c, i) => (
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
