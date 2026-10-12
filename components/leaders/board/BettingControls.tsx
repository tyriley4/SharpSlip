'use client'

import { BETTING_SORTS, SAMPLE_OPTIONS, type BettingSort, type SampleMin } from '@/lib/betting/rank'

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        active ? 'border-accent bg-accent text-white' : 'border-border bg-card text-text2 hover:border-border2 hover:text-text'
      }`}
    >
      {children}
    </button>
  )
}

/** Compact "Sort by" and "Min sample" chip rows for every Betting Stats board. */
export function BettingControls({
  sort,
  onSort,
  minGames,
  onMinGames,
  relaxed,
}: {
  sort: BettingSort
  onSort: (s: BettingSort) => void
  /** The user's choice. */
  minGames: SampleMin
  onMinGames: (n: SampleMin) => void
  relaxed: boolean
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card2 px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="w-[62px] shrink-0 text-[9px] font-extrabold tracking-[0.1em] text-muted">SORT BY</span>
        <div className="flex flex-wrap gap-1.5">
          {BETTING_SORTS.map((s) => (
            <Chip key={s} active={sort === s} onClick={() => onSort(s)}>
              {s}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="w-[62px] shrink-0 text-[9px] font-extrabold tracking-[0.1em] text-muted">SAMPLE</span>
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_OPTIONS.map((n) => (
            <Chip key={n} active={minGames === n} onClick={() => onMinGames(n)}>
              {n === 0 ? 'Any' : `${n}+ games`}
            </Chip>
          ))}
        </div>
      </div>
      {relaxed && (
        <p className="text-[10px] leading-snug text-muted">
          Early in the season — fewer than 3 players have {minGames}+ games, so every qualifying player is shown.
        </p>
      )}
      {sort === 'Most Profitable' && (
        <p className="text-[10px] leading-snug text-muted">
          Based on $10/game flat betting. Players marked ◆ are priced at the book&apos;s real price for that prop today; everyone else uses a standard -110 (each win pays +$9.09, each loss costs $10). Profit is hypothetical — past games weren&apos;t necessarily offered at today&apos;s price.
        </p>
      )}
    </div>
  )
}
