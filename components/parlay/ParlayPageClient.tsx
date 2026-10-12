'use client'

import { useMemo, useState } from 'react'
import { AddLegsPanel } from '@/components/parlay/AddLegsPanel'
import { ProbabilityBar } from '@/components/parlay/ProbabilityBar'
import { SuggestedParlays } from '@/components/parlay/SuggestedParlays'
import { AppShell } from '@/components/layout/AppShell'
import { GradeChip } from '@/components/ui/GradeChip'
import { SportBadge } from '@/components/ui/SportBadge'
import { useAccountData } from '@/lib/account/AccountDataContext'
import { formatOdds } from '@/lib/account/odds'
import { combinedAmerican, combinedAmericanFromPrices, combinedDecimalFromPrices, combinedProb, formatProb, probTone } from '@/lib/parlay/math'
import { useParlay } from '@/lib/parlay/ParlayContext'
import { buildPool, type ParlayGame } from '@/lib/parlay/suggest'
import type { Sport } from '@/lib/sport/SportContext'

function dollars(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function ParlayPageClient({ games }: { games: ParlayGame[] }) {
  const { legs, removeLeg, clear } = useParlay()
  const { settings } = useAccountData()
  const [stakeText, setStakeText] = useState('10')

  const pool = useMemo(() => buildPool(games), [games])

  const probs = legs.map((l) => l.prob)
  const prob = combinedProb(probs)
  // Payout uses the sportsbook prices the legs were added at (vig included); fair odds are shown for comparison.
  const prices = legs.map((l) => l.oddsAmerican)
  const americanOdds = combinedAmericanFromPrices(prices)
  const fairOdds = combinedAmerican(probs)
  const decimal = combinedDecimalFromPrices(prices)
  const stake = Math.max(0, Number(stakeText) || 0)
  const payout = stake * decimal
  const tone = probTone(prob)

  return (
    <AppShell>
      <div className="flex flex-col gap-8 px-3.5 pt-1 md:px-0 md:pt-0">
        <section className="flex flex-col gap-4">
          <div>
            <h1 className="text-lg font-extrabold text-text md:text-2xl">Parlay Calculator</h1>
            <p className="mt-0.5 text-[11px] text-muted md:mt-1 md:text-[13px]">Build your own parlay and see the real odds</p>
          </div>

          <ProbabilityBar prob={prob} legCount={legs.length} />

          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
            <div className="flex flex-col gap-3">
              <h3 className="section-header text-sm text-text md:text-base">
                Your Legs <span className="text-[11px] font-semibold text-muted">({legs.length})</span>
              </h3>

              {legs.length === 0 ? (
                <div className="rounded-[14px] border border-border bg-card px-4 py-10 text-center text-xs leading-relaxed text-muted">
                  No legs yet. Search a player or team, browse today&apos;s games, or add one of the suggested parlays below.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {legs.map((leg) => (
                    <div key={leg.id} className="flex items-center gap-2.5 rounded-[14px] border border-border bg-card px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-1.5">
                          <SportBadge sport={leg.sport as Sport} />
                          {leg.matchup && <span className="truncate text-[10px] text-muted">{leg.matchup}</span>}
                        </div>
                        <div className="truncate text-[13px] font-bold text-text">{leg.label}</div>
                        <div className="text-[10px] text-muted">
                          {leg.typeLabel}
                          {leg.book ? ` · ${leg.book}` : ''}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {leg.grade && <GradeChip grade={leg.grade} />}
                        <span className="stat-number text-[13px] text-accent">{formatOdds(leg.oddsAmerican, settings.oddsFormat)}</span>
                        <span className="stat-number text-[10px] text-muted">{Math.round(leg.prob)}%</span>
                      </div>
                      <button
                        onClick={() => removeLeg(leg.id)}
                        aria-label={`Remove ${leg.label}`}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border2 text-muted transition-colors hover:border-loss hover:text-loss"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[10px] leading-relaxed text-muted">
                Odds are the real prices from the sportsbook shown on each leg, multiplied together. Probabilities are the market&apos;s no-vig
                implied chances (or our estimate for suggested legs), and legs are treated as independent.
              </p>

              <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-card p-3.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-card3 px-2.5 py-2">
                    <div className="text-[9px] text-muted">Combined probability</div>
                    <div className="stat-number text-[18px]" style={{ color: legs.length ? tone.color : 'var(--muted)' }}>
                      {legs.length ? formatProb(prob) : '—'}
                    </div>
                  </div>
                  <div className="rounded-lg bg-card3 px-2.5 py-2">
                    <div className="text-[9px] text-muted">Combined odds</div>
                    <div className="stat-number text-[18px] text-accent">{americanOdds !== null ? formatOdds(americanOdds, settings.oddsFormat) : '—'}</div>
                    {americanOdds !== null && fairOdds !== null && <div className="text-[9px] text-muted">Fair (no vig): {formatOdds(fairOdds, settings.oddsFormat)}</div>}
                  </div>
                </div>

                <label className="flex items-center justify-between gap-3">
                  <span className="text-[12px] font-semibold text-text2">Stake</span>
                  <div className="flex items-center gap-1 rounded-lg border border-border bg-card3 px-2.5 py-1.5">
                    <span className="text-text2">$</span>
                    <input
                      inputMode="decimal"
                      value={stakeText}
                      onChange={(e) => setStakeText(e.target.value.replace(/[^0-9.]/g, ''))}
                      aria-label="Stake amount in dollars"
                      className="stat-number w-24 bg-transparent text-right text-[14px] focus:outline-none"
                    />
                  </div>
                </label>

                <div className="flex items-center justify-between rounded-lg bg-accent/10 px-3 py-2.5">
                  <div>
                    <div className="text-[10px] text-muted">Potential payout</div>
                    <div className="text-[9px] text-muted">{legs.length && stake ? `Profit ${dollars(Math.max(0, payout - stake))}` : 'Enter a stake'}</div>
                  </div>
                  <div className="stat-number text-[20px] text-accent">{legs.length && stake ? dollars(payout) : '—'}</div>
                </div>

                <button
                  onClick={clear}
                  disabled={legs.length === 0}
                  className="rounded-lg border border-border2 px-3 py-2 text-[11px] font-bold text-loss transition-colors hover:border-loss disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Clear all legs
                </button>
              </div>
            </div>

            <AddLegsPanel games={games} />
          </div>
        </section>

        <SuggestedParlays pool={pool} />
      </div>
    </AppShell>
  )
}
