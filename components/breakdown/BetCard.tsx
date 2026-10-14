'use client'

import { useState } from 'react'
import { useAccountData } from '@/lib/account/AccountDataContext'
import { formatOdds } from '@/lib/account/odds'
import type { BetCardData } from '@/lib/edges/recommended'
import type { EdgeCategory } from '@/lib/edges/types'
import { useParlay } from '@/lib/parlay/ParlayContext'

export const GRADE_STYLE: Record<string, { bg: string; fg: string }> = {
  A: { bg: '#00E5A0', fg: '#08090C' },
  B: { bg: '#3B9EFF', fg: '#FFFFFF' },
  C: { bg: '#FFB800', fg: '#08090C' },
}
const UNGRADED = { bg: '#2A2D35', fg: '#8B909A' }

const CATEGORY_BADGE: Record<EdgeCategory, { icon: string; label: string }> = {
  recent_form: { icon: '📈', label: 'Recent Form' },
  hit_rate: { icon: '🎯', label: 'Hit Rate' },
  matchup: { icon: '🏈', label: 'Matchup' },
  situational: { icon: '⚠️', label: 'Situational' },
  h2h: { icon: '🔄', label: 'H2H' },
  context: { icon: '📊', label: 'Context' },
}

export function GradeBadge({ grade, size = 'md' }: { grade: string | null; size?: 'md' | 'lg' }) {
  const s = grade ? GRADE_STYLE[grade] : UNGRADED
  const dims = size === 'lg' ? 'h-11 w-11 text-xl' : 'h-8 w-8 text-sm'
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-lg font-black ${dims}`} style={{ background: s.bg, color: s.fg }} title={grade ? `Grade ${grade}` : 'Insufficient data - not graded'} aria-label={grade ? `Grade ${grade}` : 'Ungraded'}>
      {grade ?? '—'}
    </span>
  )
}

export function SharpFindBadge() {
  return (
    <span className="rounded-full border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold text-accent" title="The historical hit rate is 8+ points above the rate the price implies">
      ◆ Sharp Find
    </span>
  )
}

export function InsightList({ insights }: { insights: BetCardData['insights'] }) {
  return (
    <ul className="flex flex-col gap-2">
      {insights.map((i, n) => {
        const b = CATEGORY_BADGE[i.category]
        return (
          <li key={n} className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 whitespace-nowrap rounded-full border border-border bg-card3 px-1.5 py-0.5 text-[9px] font-bold text-text2">
              {b.icon} {b.label}
            </span>
            <span className="min-w-0 text-[11px] leading-snug text-text2">
              {i.description}
              {i.supportingData && <span className="block text-[10px] text-muted">{i.supportingData}</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** One bet: description, price, grade and hit rate collapsed; supporting insights when expanded. */
export function BetCard({ bet, defaultOpen = false, showMatchup = false }: { bet: BetCardData; defaultOpen?: boolean; showMatchup?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const { settings } = useAccountData()
  const { addLeg, removeByLineId, hasLine } = useParlay()
  const inParlay = hasLine(bet.leg.lineId)

  function toggleParlay(e: React.MouseEvent) {
    e.stopPropagation()
    if (inParlay) {
      removeByLineId(bet.leg.lineId)
      return
    }
    addLeg(bet.leg, { message: `Added to parlay — ${bet.description}` })
  }

  return (
    <div className={`rounded-[14px] border bg-card transition-colors ${open ? 'border-border2' : 'border-border'}`}>
      <div role="button" tabIndex={0} aria-expanded={open} onClick={() => setOpen((o) => !o)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen((o) => !o)} className="flex cursor-pointer items-center gap-2.5 p-3">
        <GradeBadge grade={bet.grade} />
        <div className="min-w-0 flex-1">
          {showMatchup && <div className="truncate text-[9px] font-bold text-muted">{bet.matchup}</div>}
          <div className="truncate text-[13px] font-bold text-text">{bet.description}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {bet.odds !== null ? (
              <span className="stat-number text-[12px] text-accent">
                {formatOdds(bet.odds, settings.oddsFormat)} <span className="text-[10px] font-semibold text-muted">{bet.book}</span>
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-muted">Estimated line · no price</span>
            )}
            {bet.historicalHitRate !== null ? (
              <span className="text-[10px] text-muted">{Math.round(bet.historicalHitRate)}% historical</span>
            ) : (
              <span className="text-[10px] text-muted">Insufficient data</span>
            )}
            {bet.isSharpFind && <SharpFindBadge />}
            {bet.limitedSample && bet.grade && <span className="text-[9px] text-warning">Limited sample</span>}
          </div>
        </div>
        <button
          onClick={toggleParlay}
          aria-label={inParlay ? `Remove ${bet.description} from parlay` : `Add ${bet.description} to parlay`}
          className={`shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${inParlay ? 'border-accent bg-accent text-white' : 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/20'}`}
        >
          {inParlay ? '✓ In Parlay' : 'Add to Parlay +'}
        </button>
        <span className={`shrink-0 text-[10px] text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true">
          ▾
        </span>
      </div>

      {open && (
        <div className="border-t border-border/60 px-3 pb-3 pt-2.5">
          {bet.insights.length > 0 ? (
            <InsightList insights={bet.insights} />
          ) : (
            <p className="text-[11px] text-muted">Insufficient data — no supporting evidence clears the bar for this bet. You can still add it to a parlay and research it yourself.</p>
          )}
          {bet.limitedSample && <p className="mt-2 text-[10px] text-warning">Limited sample: the main evidence rests on fewer than 10 games, so the grade is capped at C.</p>}
        </div>
      )}
    </div>
  )
}
