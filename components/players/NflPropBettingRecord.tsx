'use client'

import { useMemo, useState } from 'react'
import { CareerProvider, rateTone, SeasonVsCareer, seasonFromGames, useCareer } from '@/components/players/CareerCompare'
import { formatNflBettingThreshold, NFL_BETTING_CATEGORIES, NFL_BETTING_THRESHOLDS, type NflBettingSub } from '@/lib/nfl/bettingCategories'

function PropCategoryCard({ category }: { category: string }) {
  const thresholds = NFL_BETTING_THRESHOLDS[category]
  const [threshold, setThreshold] = useState(thresholds[0])
  const [expanded, setExpanded] = useState(false)
  const { season } = useCareer()

  const games = season?.state === 'ready' ? season.games : null
  const stats = useMemo(() => (games ? seasonFromGames(games, category, threshold) : null), [games, category, threshold])
  const dots = useMemo(
    () =>
      (games ?? [])
        .filter((g) => typeof g.values[category] === 'number')
        .slice(0, 10)
        .map((g) => g.values[category] >= threshold),
    [games, category, threshold]
  )
  const tone = rateTone(stats?.hitRate ?? 0)

  return (
    <div className={`rounded-xl border transition-colors ${expanded ? 'border-border' : 'border-border'} bg-card3`}>
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between gap-3 p-3 text-left">
        <span className="text-[11px] font-bold text-text md:text-xs">{category}</span>
        <div className="flex items-center gap-2">
          {stats && stats.gamesPlayed > 0 && <span className={`text-sm font-black md:text-base ${tone.text}`}>{stats.hitRate}%</span>}
          <span className={`text-[10px] text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/60 p-3 pt-2.5">
          <div className="mb-2.5 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {thresholds.map((t) => (
              <button
                key={t}
                onClick={() => setThreshold(t)}
                className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                  t === threshold ? 'border-accent bg-accent text-white' : 'border-border bg-transparent text-muted'
                }`}
              >
                {formatNflBettingThreshold(category, t)}
              </button>
            ))}
          </div>

          {season?.state === 'loading' ? (
            <div className="flex items-center gap-2 py-3 text-[11px] text-muted">
              <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-muted border-t-accent" />
              Calculating…
            </div>
          ) : !stats || stats.gamesPlayed === 0 ? (
            <div className="py-3 text-[11px] text-muted">No games this season yet.</div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <SeasonVsCareer season={stats} category={category} threshold={threshold} />
              <div>
                <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-muted">Last 10</div>
                <div className="flex gap-1">
                  {[...dots].reverse().map((hit, i) => (
                    <span key={i} className={`h-2.5 w-2.5 rounded-full ${hit ? 'bg-positive' : 'bg-negative'}`} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** NFL prop hit rates, this season against the last five seasons, from ESPN game logs. */
export function NflPropBettingRecord({ playerId, sub }: { playerId: string; sub: NflBettingSub }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 md:p-6">
      <div className="mb-3 text-[9px] font-extrabold tracking-[0.1em] text-muted md:mb-4 md:text-[10px]">PROP BETTING RECORD</div>
      <CareerProvider params={{ sport: 'nfl', playerId }} withSeason>
        <div className="flex flex-col gap-2">
          {NFL_BETTING_CATEGORIES[sub].map((category) => (
            <PropCategoryCard key={category} category={category} />
          ))}
        </div>
      </CareerProvider>
    </div>
  )
}
