'use client'

import { useMemo, useState } from 'react'
import { GradeChip } from '@/components/ui/GradeChip'
import { SportBadge } from '@/components/ui/SportBadge'
import { useAccountData } from '@/lib/account/AccountDataContext'
import { formatOdds } from '@/lib/account/odds'
import { formatProb, probTone } from '@/lib/parlay/math'
import { useParlay } from '@/lib/parlay/ParlayContext'
import { suggestParlays, type PoolLeg, type RiskLevel, type SuggestFilters, type TargetOdds } from '@/lib/parlay/suggest'
import { SPORTS } from '@/lib/sport/SportContext'
import type { Sport } from '@/lib/sport/SportContext'

const LEG_OPTIONS = [2, 3, 4, 5] as const
const RISK_OPTIONS: { id: RiskLevel; label: string; hint: string }[] = [
  { id: 'conservative', label: 'Conservative', hint: 'Grade A only' },
  { id: 'moderate', label: 'Moderate', hint: 'A + B' },
  { id: 'aggressive', label: 'Aggressive', hint: 'All grades' },
]
const TARGET_OPTIONS: { id: TargetOdds; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: '200-400', label: '+200 to +400' },
  { id: '400-800', label: '+400 to +800' },
  { id: '800-1500', label: '+800 to +1500' },
  { id: '1500+', label: '+1500+' },
]

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
        active ? 'border-accent bg-accent text-white' : 'border-border bg-card text-muted hover:text-text'
      }`}
    >
      {children}
    </button>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-extrabold tracking-[0.1em] text-muted">{label}</div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{children}</div>
    </div>
  )
}

function legToParlayLeg(l: PoolLeg) {
  return {
    sport: l.sport,
    label: l.label,
    typeLabel: l.typeLabel,
    oddsAmerican: l.odds,
    prob: l.prob,
    matchup: l.matchup,
    lineId: l.lineId,
    grade: l.grade,
    book: l.book,
  }
}

export function SuggestedParlays({ pool }: { pool: PoolLeg[] }) {
  const { settings } = useAccountData()
  const { addLegs } = useParlay()
  const [filters, setFilters] = useState<SuggestFilters>({ legs: 3, risk: 'moderate', sport: 'all', target: 'none' })

  const result = useMemo(() => suggestParlays(pool, filters, 3), [pool, filters])

  const emptyMessage =
    result.reason === 'target'
      ? `No ${filters.legs}-leg combinations match that target odds range today. Try a different range.`
      : `Not enough qualifying insights today for a ${filters.legs}-leg parlay. Try reducing legs or risk level.`

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="section-header text-base text-text md:text-lg">Suggested Parlays</h2>
        <p className="mt-0.5 text-[11px] text-muted md:text-[13px]">Today&apos;s top insights, priced at real sportsbook moneylines and totals</p>
      </div>

      <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-card p-3.5">
        <FilterGroup label="LEGS">
          {LEG_OPTIONS.map((n) => (
            <Chip key={n} active={filters.legs === n} onClick={() => setFilters((f) => ({ ...f, legs: n }))}>
              {n} legs
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup label="RISK">
          {RISK_OPTIONS.map((r) => (
            <Chip key={r.id} active={filters.risk === r.id} onClick={() => setFilters((f) => ({ ...f, risk: r.id }))}>
              {r.label} <span className="opacity-70">· {r.hint}</span>
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup label="SPORT">
          <Chip active={filters.sport === 'all'} onClick={() => setFilters((f) => ({ ...f, sport: 'all' }))}>
            All
          </Chip>
          {SPORTS.map((s) => (
            <Chip key={s.id} active={filters.sport === s.id} onClick={() => setFilters((f) => ({ ...f, sport: s.id as Sport }))}>
              {s.icon} {s.label}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup label="TARGET ODDS (OPTIONAL)">
          {TARGET_OPTIONS.map((t) => (
            <Chip key={t.id} active={filters.target === t.id} onClick={() => setFilters((f) => ({ ...f, target: t.id }))}>
              {t.label}
            </Chip>
          ))}
        </FilterGroup>
      </div>

      {result.parlays.length === 0 ? (
        <div className="rounded-[14px] border border-border bg-card px-4 py-10 text-center text-xs leading-relaxed text-muted">{emptyMessage}</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          {result.parlays.map((p, i) => {
            const tone = probTone(p.prob)
            return (
              <div key={p.legs.map((l) => l.lineId).join('|')} className="flex flex-col gap-2 rounded-[14px] border border-border bg-card p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold tracking-[0.1em] text-muted">SUGGESTION {i + 1}</span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[9px] font-bold text-muted">{p.legs.length} legs</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {p.legs.map((l) => (
                    <div key={l.lineId} className="flex items-center gap-2 rounded-lg bg-card3 px-2.5 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-1.5">
                          <SportBadge sport={l.sport} />
                          <span className="truncate text-[10px] text-muted">{l.matchup}</span>
                        </div>
                        <div className="truncate text-[12px] font-bold text-text">{l.label}</div>
                        <div className="truncate text-[9px] text-muted">{l.book}</div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <GradeChip grade={l.grade} />
                        <span className="stat-number text-[11px] text-accent">{formatOdds(l.odds, settings.oddsFormat)}</span>
                        <span className="stat-number text-[10px] text-muted">{Math.round(l.prob)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-card3 px-2.5 py-2">
                    <div className="text-[9px] text-muted">Combined probability</div>
                    <div className="stat-number text-[16px]" style={{ color: tone.color }}>
                      {formatProb(p.prob)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-card3 px-2.5 py-2">
                    <div className="text-[9px] text-muted">Combined odds (real prices)</div>
                    <div className="stat-number text-[16px] text-accent">{formatOdds(p.odds, settings.oddsFormat)}</div>
                  </div>
                </div>
                <button
                  onClick={() => addLegs(p.legs.map(legToParlayLeg))}
                  className="mt-1 rounded-lg bg-accent px-3 py-2 text-center text-[11px] font-bold text-white"
                >
                  Add to Calculator ↑
                </button>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[10px] leading-relaxed text-muted">
        Prices are real sportsbook lines. Suggestions are based on statistical trends — hit probabilities are estimates, legs are treated as
        independent, and nothing here is betting advice. All betting decisions are your own responsibility.
      </p>
    </section>
  )
}
