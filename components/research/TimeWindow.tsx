'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import { useCareer } from '@/components/players/CareerCompare'
import { applyWindow, compareHitRates, DEFAULT_WINDOW, WINDOW_OPTIONS, type ResearchSport, type WindowContext } from '@/lib/research/windows'
import type { CareerGame } from '@/lib/props/careerHitRates'

interface Ctx {
  id: string
  setId: (id: string) => void
  ctx: WindowContext
}

const TimeWindowContext = createContext<Ctx>({ id: DEFAULT_WINDOW, setId: () => undefined, ctx: { sport: 'mlb' } })
export const useTimeWindow = () => useContext(TimeWindowContext)

/** One selected time period shared by everything on the page that shows player numbers. Default: Full Season. */
export function TimeWindowProvider({ sport, team, opponent, children }: { sport: ResearchSport; team?: string; opponent?: string | null; children: React.ReactNode }) {
  const [id, setId] = useState(DEFAULT_WINDOW)
  const ctx = useMemo<WindowContext>(() => ({ sport, team, opponent }), [sport, team, opponent])
  const value = useMemo(() => ({ id, setId, ctx }), [id, ctx])
  return <TimeWindowContext.Provider value={value}>{children}</TimeWindowContext.Provider>
}

/** The pill row for choosing a time period; the options are the sport's own list. */
export function TimePeriodSelector({ sport, value, onChange, hasOpponent = true, size = 'md' }: { sport: ResearchSport; value: string; onChange: (id: string) => void; hasOpponent?: boolean; size?: 'sm' | 'md' }) {
  const options = WINDOW_OPTIONS[sport]
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Time period">
      {options.map((w) => {
        const disabled = !!w.unavailable || (w.id === 'vsOpp' && !hasOpponent)
        const active = value === w.id
        return (
          <button
            key={w.id}
            role="tab"
            aria-selected={active}
            disabled={disabled}
            title={w.unavailable ?? (w.id === 'vsOpp' && !hasOpponent ? 'No game scheduled today' : undefined)}
            onClick={() => onChange(w.id)}
            className={`shrink-0 whitespace-nowrap rounded-full border font-semibold transition-colors ${size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'} ${
              active ? 'border-accent bg-accent text-white' : disabled ? 'cursor-not-allowed border-border bg-transparent text-muted/50' : 'border-border bg-transparent text-muted hover:border-border2 hover:text-text2'
            }`}
          >
            {w.label}
          </button>
        )
      })}
    </div>
  )
}

const tone = (gap: number) => (gap >= 12 ? 'text-positive' : gap <= -12 ? 'text-negative' : 'text-text2')

/** Side by side: the selected window's hit rate against the full season. Hidden at the default window. */
export function WindowCompare({ games, category, threshold }: { games: CareerGame[] | null; category: string; threshold: number }) {
  const { id, ctx } = useTimeWindow()
  const cmp = useMemo(() => (games && id !== DEFAULT_WINDOW ? compareHitRates(games, id, ctx, category, threshold) : null), [games, id, ctx, category, threshold])
  if (id === DEFAULT_WINDOW) return null
  const label = WINDOW_OPTIONS[ctx.sport].find((w) => w.id === id)?.label ?? id
  if (!cmp) return <div className="rounded-lg border border-border bg-card px-2.5 py-2 text-[10px] text-muted">No games in the {label} window yet.</div>
  return (
    <div className="rounded-lg border border-accent/25 bg-accent/[0.05] p-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wide text-muted">{label}</div>
          <div className={`stat-number text-xl font-black ${tone(cmp.gap)}`}>{cmp.window.rate}%</div>
          <div className="text-[10px] text-muted">
            {cmp.window.record} ({cmp.window.n} game{cmp.window.n === 1 ? '' : 's'})
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-bold uppercase tracking-wide text-muted">Full season</div>
          <div className="stat-number text-xl font-black text-text2">{cmp.season.rate}%</div>
          <div className="text-[10px] text-muted">
            {cmp.season.record} ({cmp.season.n} games)
          </div>
        </div>
      </div>
      {cmp.diverges && (
        <p className="mt-1.5 text-[10px] font-semibold text-text2">
          Significantly {cmp.gap > 0 ? 'above' : 'below'} the season rate in this window ({cmp.gap > 0 ? '+' : ''}
          {cmp.gap} points) — trend worth investigating.
        </p>
      )}
    </div>
  )
}

/** Window comparison for a prop card, reading the player's career log already loaded on the page. */
export function WindowCompareFromCareer({ category, threshold }: { category: string; threshold: number }) {
  const { career } = useCareer()
  return <WindowCompare games={career.state === 'ready' ? career.games : null} category={category} threshold={threshold} />
}
