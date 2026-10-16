'use client'

import { useState } from 'react'
import { BetAnalysis } from '@/components/breakdown/BetAnalysis'
import { explainBet } from '@/lib/edges/explainBet'
import { useAccountData } from '@/lib/account/AccountDataContext'
import { formatOdds } from '@/lib/account/odds'
import type { BetCardData } from '@/lib/edges/recommended'
import type { EdgeCategory } from '@/lib/edges/types'
import { useParlay } from '@/lib/parlay/ParlayContext'

export const GRADE_STYLE: Record<string, { bg: string; fg: string }> = {
  A: { bg: '#00E5A0', fg: '#08090C' },
  B: { bg: '#3B9EFF', fg: '#FFFFFF' },
  C: { bg: '#FFB800', fg: '#08090C' },
  D: { bg: '#FF6B35', fg: '#08090C' },
  F: { bg: '#4B5058', fg: '#D5D8DD' },
}
const UNGRADED = { bg: '#2A2D35', fg: '#8B909A' }

const CATEGORY_BADGE: Record<EdgeCategory, { icon: string; label: string }> = {
  recent_form: { icon: '📈', label: 'Recent Form' },
  hit_rate: { icon: '🎯', label: 'Hit Rate' },
  matchup: { icon: '🏈', label: 'Matchup' },
  situational: { icon: '⚠️', label: 'Situational' },
  h2h: { icon: '🔄', label: 'H2H' },
  context: { icon: '📊', label: 'Context' },
  role: { icon: '🧭', label: 'Role' },
}

const GRADE_TITLE: Record<string, string> = {
  A: 'Grade A — exceptional conviction',
  B: 'Grade B — strong conviction',
  C: 'Grade C — moderate conviction',
  D: 'Grade D — weak evidence',
  F: 'Grade F — no edge detected',
}

export function GradeBadge({ grade, size = 'md' }: { grade: string | null; size?: 'md' | 'lg' }) {
  const s = grade ? GRADE_STYLE[grade] : UNGRADED
  const dims = size === 'lg' ? 'h-11 w-11 text-xl' : 'h-8 w-8 text-sm'
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-lg font-black ${dims}`} style={{ background: s.bg, color: s.fg }} title={grade ? GRADE_TITLE[grade] ?? `Grade ${grade}` : 'Not graded'} aria-label={grade ? `Grade ${grade}` : 'Ungraded'}>
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
        const muted = i.quality !== undefined && i.quality < 9
        return (
          <li key={n} className={`flex items-start gap-2 ${muted ? 'opacity-75' : ''}`} title={i.quality !== undefined ? `Evidence quality ${i.quality} of 12${muted ? ' (medium)' : ''}` : undefined}>
            <span className="mt-0.5 shrink-0 whitespace-nowrap rounded-full border border-border bg-card3 px-1.5 py-0.5 text-[9px] font-bold text-text2">
              {b.icon} {b.label}
            </span>
            <span className={`min-w-0 text-[11px] leading-snug ${muted ? 'text-muted' : 'text-text2'}`}>
              {i.description}
              {i.supportingData && <span className="block text-[10px] text-muted">{i.supportingData}</span>}
              {i.smallSample !== undefined && <span className="block text-[10px] font-semibold text-warning">Early season signal — {i.smallSample} game{i.smallSample === 1 ? '' : 's'} — historical patterns carry more weight until the sample builds</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** One bet: description, price, grade and hit rate collapsed; supporting insights when expanded. */
/** A, B and C bets open to their top two evidence items; D and F stay collapsed so weak lines do not crowd the tab. */
const OPENS_BY_DEFAULT = new Set(['A', 'B', 'C'])

export function BetCard({ bet, defaultOpen, showMatchup = false }: { bet: BetCardData; defaultOpen?: boolean; showMatchup?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? (bet.grade !== null && OPENS_BY_DEFAULT.has(bet.grade)))
  const [showAll, setShowAll] = useState(false)
  const weak = bet.grade === 'D' || bet.grade === 'F'
  const visible = weak || showAll ? bet.insights : bet.insights.slice(0, 2)
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
            {bet.grade === 'D' && <span className="text-[9px] font-semibold text-[#FF6B35]">Weak evidence</span>}
            {bet.grade === 'F' && <span className="text-[9px] font-semibold text-muted">{bet.gradeNote?.startsWith('Insufficient') ? 'Insufficient evidence' : 'No edge detected'}</span>}
            {bet.limitedSample && bet.grade && bet.grade !== 'F' && <span className="text-[9px] text-warning">Limited sample</span>}
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
            <InsightList insights={visible} />
          ) : (
            <p className="text-[11px] text-muted">No supporting evidence clears the quality bar for this bet. You can still add it to a parlay and research it yourself.</p>
          )}
          {!weak && bet.insights.length > 2 && (
            <button onClick={() => setShowAll((v) => !v)} className="mt-2 text-[11px] font-semibold text-accent hover:underline">
              {showAll ? 'Show fewer insights ↑' : `Show all ${bet.insights.length} insights →`}
            </button>
          )}
          {bet.explain && <BetAnalysis className="mt-3" text={() => explainBet(bet)} />}
          {bet.gradeNote && <p className={`mt-2 text-[10px] ${bet.grade === 'F' ? 'font-semibold text-text2' : 'text-muted'}`}>{bet.gradeNote}</p>}
          {bet.limitedSample && bet.grade !== 'F' && <p className="mt-2 text-[10px] text-warning">Limited sample: the main evidence rests on fewer than 10 games, so the grade is capped at C.</p>}
        </div>
      )}
    </div>
  )
}
