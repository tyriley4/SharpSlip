'use client'

import { CareerProvider, useCareer, type CareerParams } from '@/components/players/CareerCompare'
import { calculateCareerHitRate, compareRates } from '@/lib/props/careerHitRates'
import { ConvictionSummary } from '@/components/players/PropConviction'
import type { TonightEdge } from '@/lib/players/types'

/** "74% this season • 68% career" with the trend, once the career log has loaded; renders nothing until then. */
function CareerLine({ edge }: { edge: TonightEdge }) {
  const { career } = useCareer()
  if (career.state !== 'ready' || !edge.prop || typeof edge.hitRate !== 'number') return null
  const c = calculateCareerHitRate(career.games, edge.prop.category, edge.prop.threshold)
  if (c.gamesPlayed === 0) return null
  const trend = compareRates(edge.hitRate, c.hitRate)
  const text = trend === 'up' ? 'Currently above career average ↑' : trend === 'down' ? 'Currently below career average ↓' : 'In line with career average →'
  const cls = trend === 'up' ? 'text-positive' : trend === 'down' ? 'text-negative' : 'text-muted'
  return (
    <div className="mb-3 md:mb-4">
      <div className="text-[12px] font-bold text-text md:text-sm">
        {edge.hitRate}% this season • {c.hitRate}% career
      </div>
      <div className={`text-[11px] font-semibold ${cls}`}>{text}</div>
    </div>
  )
}


export function TonightEdgeCard({ edge, career }: { edge: TonightEdge; career?: CareerParams }) {
  const hitRate = edge.hitRate ?? 0
  const hitColor = hitRate >= 60 ? 'text-positive' : hitRate <= 40 ? 'text-negative' : 'text-text2'
  const barColor = hitRate >= 60 ? 'bg-positive' : hitRate <= 40 ? 'bg-negative' : 'bg-accent'

  return (
    <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/[0.08] to-transparent p-3.5 md:p-6">
      <div className="mb-3 flex items-center gap-1.5 md:mb-4">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        <span className="text-[9px] font-extrabold tracking-[0.1em] text-accent md:text-[11px]">
          TONIGHT&apos;S EDGE
        </span>
      </div>

      {edge.oppDefenseRank && (
        <div className="mb-3 rounded-[10px] border border-border bg-card p-2.5 text-[11px] text-text2 md:mb-4 md:p-3 md:text-[13px]">
          {edge.oppDefenseRank}
        </div>
      )}

      {edge.propLine && (
        <div className="mb-3 flex items-center justify-between gap-3 md:mb-4">
          <div className="min-w-0">
            <div className="truncate text-base font-black text-text md:text-xl">{edge.propLine}</div>
            {edge.propRecord && (
              <div className="mt-0.5 text-[11px] text-muted md:text-xs">Season: {edge.propRecord}</div>
            )}
          </div>
          {typeof edge.hitRate === 'number' && (
            <div className={`shrink-0 text-2xl font-black md:text-3xl ${hitColor}`}>{hitRate}%</div>
          )}
        </div>
      )}

      {career && edge.prop && (
        <CareerProvider params={career}>
          <CareerLine edge={edge} />
        </CareerProvider>
      )}

      {typeof edge.hitRate === 'number' && (
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-border2 md:mb-5">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, hitRate)}%` }} />
        </div>
      )}

      {edge.last10 && edge.last10.length > 0 && (
        <div className="mb-3 flex items-center gap-2 md:mb-4">
          <span className="text-[9px] font-bold uppercase tracking-wide text-muted">L10</span>
          <div className="flex gap-1">
            {edge.last10.map((hit, i) => (
              <span key={i} className={`h-2 w-2 rounded-full ${hit ? 'bg-positive' : 'bg-negative'}`} />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 md:gap-2.5">
        {edge.conviction && 'row' in edge.conviction ? (
          <div className="rounded-xl border border-accent/25 bg-accent/[0.06] p-2.5 md:p-3">
            <div className="mb-1.5 text-[9px] font-extrabold tracking-[0.08em] text-accent">CONVICTION VS. TONIGHT&apos;S MATCHUP</div>
            <ConvictionSummary row={edge.conviction.row} matchup={edge.conviction.matchup} />
          </div>
        ) : (
          edge.lean && (
            <div className="rounded-xl border border-positive/25 bg-positive/[0.08] p-2.5 md:p-3">
              <div className="mb-0.5 text-[9px] font-extrabold tracking-[0.08em] text-positive">HISTORICAL READ</div>
              <p className="text-[11px] leading-relaxed text-text2 md:text-[13px]">{edge.lean}</p>
              {edge.conviction && 'unavailable' in edge.conviction && edge.conviction.unavailable === 'No game today' && <p className="mt-1 text-[10px] text-muted">No game tonight — conviction grades appear on game days.</p>}
            </div>
          )
        )}
        {edge.risk && (
          <div className="rounded-xl border border-negative/25 bg-negative/[0.08] p-2.5 md:p-3">
            <div className="mb-0.5 text-[9px] font-extrabold tracking-[0.08em] text-negative">RISK FACTOR</div>
            <p className="text-[11px] leading-relaxed text-text2 md:text-[13px]">{edge.risk}</p>
          </div>
        )}
      </div>
    </div>
  )
}
