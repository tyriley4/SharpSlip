'use client'

import { useState } from 'react'
import { PillTabs } from '@/components/ui/PillTabs'
import type { StadiumData } from '@/data/breakdown/stadiumTypes'

const SECTIONS = ['🏟 Stadium', '🌤 Weather', '🏠 Home Edge', '📈 History', '🎯 Bet Impact']

const DIRECTION_LABEL: Record<string, string> = {
  for: '✓ Supports',
  against: '✕ Works Against',
  neutral: '— Neutral',
}

function RatingBar({ value }: { value: number }) {
  const color = value >= 75 ? 'bg-positive' : value >= 50 ? 'bg-accent' : 'bg-warning'
  return (
    <div className="h-2 overflow-hidden rounded-full bg-border2">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  )
}

export function StadiumContent({ stadium }: { stadium: StadiumData }) {
  const [section, setSection] = useState(SECTIONS[0])

  return (
    <div className="flex flex-col gap-3 px-3.5 pt-3 md:px-8 md:pt-5">
      <div className="rounded-2xl border border-border bg-card p-3.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[15px] font-black text-text">{stadium.name}</div>
            <div className="mt-0.5 text-[10px] text-muted">
              {stadium.location} · {stadium.surface} · {stadium.roof}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-black text-accent">{stadium.capacity.toLocaleString()}</div>
            <div className="text-[9px] text-muted">Capacity</div>
          </div>
        </div>
      </div>

      <PillTabs options={SECTIONS} active={section} onChange={setSection} />

      {section === '🏟 Stadium' && (
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[9px] font-extrabold tracking-[0.1em] text-muted">CROWD NOISE RATING</div>
            <div className="text-sm font-black text-accent">{stadium.crowdNoise}/100</div>
          </div>
          <RatingBar value={stadium.crowdNoise} />
          <div className="mt-3.5 grid grid-cols-3 gap-1.5">
            <div className="rounded-lg bg-card3 py-2 text-center">
              <div className="text-[11px] font-bold text-text">{stadium.surface}</div>
              <div className="mt-0.5 text-[8px] text-muted">Surface</div>
            </div>
            <div className="rounded-lg bg-card3 py-2 text-center">
              <div className="text-[11px] font-bold text-text">{stadium.roof}</div>
              <div className="mt-0.5 text-[8px] text-muted">Roof</div>
            </div>
            <div className="rounded-lg bg-card3 py-2 text-center">
              <div className="text-[11px] font-bold text-text">{stadium.capacity.toLocaleString()}</div>
              <div className="mt-0.5 text-[8px] text-muted">Capacity</div>
            </div>
          </div>
        </div>
      )}

      {section === '🌤 Weather' && (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-border bg-card p-3.5 text-center">
            <div className="text-3xl font-black text-text">{stadium.weather.temp}</div>
            <div className="mt-0.5 text-[11px] text-text2">{stadium.weather.conditions}</div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="rounded-lg border border-border bg-card p-2.5 text-center">
              <div className="text-[11px] font-bold text-text">{stadium.weather.wind}</div>
              <div className="mt-0.5 text-[8px] text-muted">Wind</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-2.5 text-center">
              <div className="text-[11px] font-bold text-text">{stadium.weather.humidity}</div>
              <div className="mt-0.5 text-[8px] text-muted">Humidity</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-2.5 text-center">
              <div className="text-[11px] font-bold text-text">{stadium.weather.precip}</div>
              <div className="mt-0.5 text-[8px] text-muted">Precip</div>
            </div>
          </div>
          <div className="rounded-[10px] border border-accent/20 bg-accent/10 p-2.5">
            <div className="mb-1 text-[9px] font-extrabold tracking-[0.1em] text-accent">BETTING IMPACT</div>
            <p className="text-[10px] leading-relaxed text-text2">{stadium.weather.impact}</p>
          </div>
        </div>
      )}

      {section === '🏠 Home Edge' && (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[9px] font-extrabold tracking-[0.1em] text-muted">HOME-FIELD RATING</div>
              <div className="text-sm font-black text-accent">{stadium.homeEdge.rating}/100</div>
            </div>
            <RatingBar value={stadium.homeEdge.rating} />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="rounded-xl border border-border bg-card p-2.5 text-center">
              <div className="text-[13px] font-bold text-text">{stadium.homeEdge.ats}</div>
              <div className="mt-0.5 text-[9px] font-bold text-text2">{stadium.homeEdge.atsPct}%</div>
              <div className="mt-0.5 text-[8px] text-muted">ATS</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-2.5 text-center">
              <div className="text-[13px] font-bold text-text">{stadium.homeEdge.ou}</div>
              <div className="mt-0.5 text-[9px] font-bold text-text2">{stadium.homeEdge.ouPct}%</div>
              <div className="mt-0.5 text-[8px] text-muted">Over</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-2.5 text-center">
              <div className="text-[13px] font-bold text-positive">{stadium.homeEdge.homeWinPct}%</div>
              <div className="mt-0.5 text-[8px] text-muted">Home Win Rate</div>
            </div>
          </div>
        </div>
      )}

      {section === '📈 History' && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <div style={{ minWidth: 420 }}>
            <div className="grid grid-cols-6 gap-1 border-b border-border bg-card3 px-3.5 py-2">
              {['SEASON', 'W', 'L', 'PF', 'PA', 'ATS/OU'].map((h) => (
                <div key={h} className="text-[9px] font-bold text-muted">{h}</div>
              ))}
            </div>
            {stadium.history.map((row, i) => (
              <div
                key={row.season}
                className={`grid grid-cols-6 items-center gap-1 px-3.5 py-2.5 ${i < stadium.history.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div className="text-xs font-bold text-text">{row.season}</div>
                <div className="text-xs font-semibold text-positive">{row.w}</div>
                <div className="text-xs font-semibold text-negative">{row.l}</div>
                <div className="text-xs text-text2">{row.pf}</div>
                <div className="text-xs text-text2">{row.pa}</div>
                <div className="text-[10px] font-semibold text-text2">{row.ats} · {row.ou}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === '🎯 Bet Impact' && (
        <div>
          <div className="mb-2.5 text-[9px] font-extrabold tracking-[0.1em] text-muted">
            HOW THIS STADIUM AFFECTS TONIGHT&apos;S BETS
          </div>
          <div className="flex flex-col gap-2">
            {stadium.betImpact.map((item) => {
              const dirColor = item.direction === 'for' ? 'text-positive' : item.direction === 'against' ? 'text-negative' : 'text-muted'
              const dirBorder = item.direction === 'for' ? 'border-positive/20' : item.direction === 'against' ? 'border-negative/20' : 'border-border'
              const dirBg = item.direction === 'for' ? 'bg-positive/[0.07]' : item.direction === 'against' ? 'bg-negative/[0.07]' : 'bg-white/[0.03]'
              return (
                <div key={item.bet} className={`rounded-xl border p-3 ${dirBorder} ${dirBg}`}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-base">{item.icon}</span>
                    <div className="flex-1">
                      <div className="text-xs font-extrabold text-text">{item.bet}</div>
                      <div className={`text-[10px] font-bold ${dirColor}`}>{DIRECTION_LABEL[item.direction]}</div>
                    </div>
                  </div>
                  <div className="mb-1 text-[11px] font-bold text-text">{item.headline}</div>
                  <p className="text-[11px] leading-relaxed text-text2">{item.body}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
