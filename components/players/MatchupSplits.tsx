import type { MatchupSplit } from '@/lib/players/types'

function SplitRow({ item, positive }: { item: MatchupSplit; positive: boolean }) {
  const color = positive ? 'text-positive' : 'text-negative'
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-card3 px-2.5 py-2">
      <div className="min-w-0">
        <div className="truncate text-[11px] font-bold text-text">{item.name}</div>
        <div className="text-[9px] text-muted">
          {item.games} game{item.games !== 1 ? 's' : ''}
          {item.note ? ` · ${item.note}` : ''}
        </div>
      </div>
      <div className={`shrink-0 text-[11px] font-extrabold ${color}`}>{item.stat}</div>
    </div>
  )
}

function SplitSection({
  title,
  best,
  worst,
}: {
  title: string
  best: MatchupSplit[]
  worst: MatchupSplit[]
}) {
  if (best.length === 0 && worst.length === 0) return null

  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 md:p-5">
      <div className="mb-3 text-[9px] font-extrabold tracking-[0.1em] text-muted md:text-[10px]">
        {title.toUpperCase()}
      </div>

      {best.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 text-[9px] font-bold text-positive">BEST</div>
          <div className="flex flex-col gap-1.5">
            {best.map((item) => (
              <SplitRow key={item.name} item={item} positive />
            ))}
          </div>
        </div>
      )}

      {worst.length > 0 && (
        <div>
          <div className="mb-1.5 text-[9px] font-bold text-negative">WORST</div>
          <div className="flex flex-col gap-1.5">
            {worst.map((item) => (
              <SplitRow key={item.name} item={item} positive={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function MatchupSplits({
  bestOpponents,
  worstOpponents,
  bestVenues,
  worstVenues,
}: {
  bestOpponents: MatchupSplit[]
  worstOpponents: MatchupSplit[]
  bestVenues: MatchupSplit[]
  worstVenues: MatchupSplit[]
}) {
  return (
    <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:items-start md:gap-4">
      <SplitSection title="Opponents" best={bestOpponents} worst={worstOpponents} />
      <SplitSection title="Venues" best={bestVenues} worst={worstVenues} />
    </div>
  )
}
