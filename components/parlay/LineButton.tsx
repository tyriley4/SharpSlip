'use client'

import { useAccountData } from '@/lib/account/AccountDataContext'
import { formatOdds } from '@/lib/account/odds'
import type { BetLine, LineRow } from '@/lib/parlay/lines'
import { gradeFromProb } from '@/lib/parlay/math'
import { useParlay } from '@/lib/parlay/ParlayContext'

export function LineButton({ line, showProb = true }: { line: BetLine; showProb?: boolean }) {
  const { settings } = useAccountData()
  const { addLeg, removeByLineId, hasLine } = useParlay()
  const added = hasLine(line.id)

  function toggle() {
    if (added) {
      removeByLineId(line.id)
      return
    }
    addLeg({
      sport: line.sport,
      label: line.label,
      typeLabel: line.market,
      oddsAmerican: line.odds,
      prob: line.prob,
      matchup: line.matchup,
      lineId: line.id,
      grade: gradeFromProb(line.prob),
      book: line.book,
    })
  }

  return (
    <div className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors ${added ? 'border-accent/50 bg-accent/10' : 'border-border bg-card3'}`}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-bold text-text">{line.display}</div>
        <div className="flex items-center gap-1.5">
          <span className="stat-number text-[12px] text-accent">{formatOdds(line.odds, settings.oddsFormat)}</span>
          {showProb && <span className="text-[9px] text-muted">{Math.round(line.prob)}% implied</span>}
        </div>
        <div className="truncate text-[9px] text-muted">
          {line.book}
        </div>
      </div>
      <button
        onClick={toggle}
        aria-label={added ? `Remove ${line.label} from parlay` : `Add ${line.label} to parlay`}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-base font-bold leading-none transition-colors ${
          added ? 'border-accent bg-accent text-white' : 'border-border2 text-text2 hover:border-accent hover:text-accent'
        }`}
      >
        {added ? '✓' : '+'}
      </button>
    </div>
  )
}

export function LineRowView({ row, showProb = true }: { row: LineRow; showProb?: boolean }) {
  return (
    <div className="rounded-[14px] border border-border bg-card p-3">
      <div className="mb-2 text-[10px] font-extrabold tracking-[0.08em] text-muted">{row.title.toUpperCase()}</div>
      <div className={`grid gap-2 ${row.options.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {row.options.map((o) => (
          <LineButton key={o.id} line={o} showProb={showProb} />
        ))}
      </div>
    </div>
  )
}
