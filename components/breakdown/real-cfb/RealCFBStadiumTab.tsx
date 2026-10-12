'use client'

import { useEffect, useState } from 'react'
import { WeatherPanel } from '@/components/breakdown/WeatherPanel'
import type { CfbStadiumTabData } from '@/lib/cfb/tabs'

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[10px] bg-card3 p-2 text-center">
      <div className="text-[9px] text-muted">{label}</div>
      <div className="text-[12px] font-bold text-text">{value}</div>
    </div>
  )
}

const ratingColor = (r: number) => (r >= 8.5 ? '#00E5A0' : r >= 7 ? '#A3E635' : r >= 5.5 ? '#FFB800' : r >= 4 ? '#FF6B35' : '#8B909A')

export function RealCFBStadiumTab({ gameId }: { gameId: string }) {
  const [data, setData] = useState<CfbStadiumTabData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    fetch(`/api/cfb-breakdown/stadium?gameId=${encodeURIComponent(gameId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((json: CfbStadiumTabData) => {
        if (!cancelled) setData(json)
      })
      .catch((err) => {
        console.error('[RealCFBStadiumTab] fetch failed', err)
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

  const { atmosphere: atm } = data
  return (
    <div className="flex flex-col gap-4 px-3.5 pt-3 md:px-8 md:pt-5">
      <div>
        <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">VENUE</div>
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <div className="mb-1 text-base font-black text-text">{data.stadium.name}</div>
          <div className="mb-3 text-[11px] text-muted">{data.stadium.city ?? '—'}</div>
          <div className="grid grid-cols-2 gap-1.5">
            <Cell label="Capacity" value={data.stadium.capacity ? data.stadium.capacity.toLocaleString('en-US') : 'Not listed'} />
            <Cell label="Roof" value={data.stadium.indoor === null ? '—' : data.stadium.indoor ? 'Indoor' : 'Open air'} />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">ATMOSPHERE</div>
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-base font-black" style={{ color: ratingColor(atm.rating) }}>
              {atm.label}
            </span>
            <span className="stat-number text-lg text-text">
              {atm.rating.toFixed(1)}
              <span className="text-[11px] text-muted"> / 10</span>
            </span>
          </div>
          <div className="mb-2 h-2 overflow-hidden rounded-full bg-card3">
            <div className="h-full rounded-full" style={{ width: `${atm.rating * 10}%`, background: ratingColor(atm.rating) }} />
          </div>
          <p className="text-[10px] leading-relaxed text-text2">{atm.note}</p>
        </div>
      </div>

      <div>
        <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">WEATHER</div>
        <WeatherPanel weather={data.weather} indoor={data.stadium.indoor === true} indoorLabel="Indoor stadium — weather neutral." />
      </div>

      <div>
        <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">HOME FIELD</div>
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
            <Cell label="Home win %" value={data.homeEdge.homeWinPct !== null ? `${data.homeEdge.homeWinPct.toFixed(0)}%` : '—'} />
            <Cell label="Record at venue" value={data.homeEdge.record ?? '—'} />
            <Cell label="ATS at home" value={data.homeEdge.ats ? `${data.homeEdge.ats.wins}-${data.homeEdge.ats.losses}` : '—'} />
            <Cell label="O/U at home" value={data.homeEdge.overUnder ? `${data.homeEdge.overUnder.wins}-${data.homeEdge.overUnder.losses}` : '—'} />
          </div>
          <p className="mt-2 text-[9px] leading-relaxed text-muted">This season only. ATS and O/U use real DraftKings closing lines.</p>
        </div>
      </div>

      <div>
        <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">HISTORY</div>
        {data.history.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-8 text-center text-xs text-muted">No prior-season data available.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="grid grid-cols-3 gap-1 border-b border-border bg-card3 px-2.5 py-2 text-[9px] font-bold text-muted">
              <span>SEASON</span>
              <span className="text-center">HOME RECORD</span>
              <span className="text-center">AVG TOTAL</span>
            </div>
            {data.history.map((h) => (
              <div key={h.season} className="grid grid-cols-3 gap-1 border-b border-border px-2.5 py-2 text-[11px] last:border-b-0">
                <span className="text-text2">{h.season}</span>
                <span className="text-center text-text">
                  {h.homeWins}-{h.homeLosses}
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
