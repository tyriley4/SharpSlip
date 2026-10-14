'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createBet } from '@/lib/account/bets'
import { formatOdds } from '@/lib/account/odds'
import { describeBet } from '@/lib/account/parlay'
import type { BetLeg, BetSport, BetType, NewBetInput } from '@/lib/account/types'
import { useAccountData } from '@/lib/account/AccountDataContext'
import { trackEvent } from '@/lib/analytics/posthog'
import { useAuth } from '@/lib/auth/AuthContext'
import { combinedAmericanFromPrices } from '@/lib/parlay/math'
import type { ParlayLeg } from '@/lib/parlay/ParlayContext'

type SingleMarket = Exclude<BetType, 'Parlay' | 'Teaser'>

function marketOf(leg: ParlayLeg): SingleMarket {
  const t = leg.typeLabel.toLowerCase()
  if (t.includes('moneyline')) return 'Moneyline'
  if (t.includes('spread') || t.includes('run line') || t.includes('puck line')) return 'Spread'
  if (t.includes('total')) return 'Total'
  if (t.includes('prop')) return 'Player Prop'
  if (/\bML\b/.test(leg.label)) return 'Moneyline'
  return /(over|under)/i.test(leg.label) ? 'Player Prop' : 'Spread'
}

/** A parlay-builder leg as a bet-tracker leg. Away/home come from the leg matchup text ("EDM @ LAK"). */
function toBetLeg(leg: ParlayLeg, today: string): BetLeg {
  const [away = '', home = ''] = (leg.matchup ?? '').split(' @ ')
  const market = marketOf(leg)
  const over = /\bover\b/i.test(leg.label)
  const under = /\bunder\b/i.test(leg.label)
  const line = /(-?\d+(?:\.\d+)?)/.exec(leg.label)
  return {
    sport: leg.sport as BetSport,
    market,
    away: away.trim(),
    home: home.trim(),
    gameDate: today,
    pick: leg.label,
    odds: leg.oddsAmerican,
    result: 'pending',
    ...(over || under ? { side: over ? ('over' as const) : ('under' as const) } : {}),
    ...(line && market !== 'Moneyline' ? { line: Number(line[1]) } : {}),
  }
}

const money = (n: number) => `$${n.toFixed(2).replace(/\.00$/, '')}`

/** Logs the current parlay (or a single leg, as a straight bet) to the bet tracker, pre-filled from the parlay builder. */
export function TrackBetModal({ legs, initialStake, onClose, onLogged }: { legs: ParlayLeg[]; initialStake: string; onClose: () => void; onLogged: () => void }) {
  const { user } = useAuth()
  const { settings } = useAccountData()
  const [stakeText, setStakeText] = useState(initialStake)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const single = legs.length === 1
  const betLegs = legs.map((l) => toBetLeg(l, new Date().toISOString().slice(0, 10)))
  const betType: BetType = single ? betLegs[0].market : 'Parlay'
  const odds = single ? legs[0].oddsAmerican : combinedAmericanFromPrices(legs.map((l) => l.oddsAmerican))
  const stake = Number(stakeText)

  async function confirm() {
    if (!user) return
    if (odds === null || !Number.isFinite(stake) || stake <= 0) {
      setError('Enter a stake greater than 0.')
      return
    }
    setSaving(true)
    setError(null)
    const input: NewBetInput = {
      sport: betLegs[0].sport,
      bet_type: betType,
      description: describeBet(betType, betLegs, odds),
      odds,
      stake: Math.round(stake * 100) / 100,
      game_date: betLegs[0].gameDate,
      result: 'pending',
      notes: null,
      details: { legs: betLegs, stakeMode: 'dollars' },
    }
    const saved = await createBet(user.id, input)
    setSaving(false)
    if (!saved) {
      setError('Could not save this bet. Please try again.')
      return
    }
    trackEvent('bet_logged', { sport: input.sport, betType })
    setDone(true)
    onLogged()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center md:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-card p-4 md:rounded-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Track bet">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-text">Track Bet</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-text">
            ✕
          </button>
        </div>

        {!user ? (
          <div className="flex flex-col gap-3 py-4 text-center text-xs text-text2">
            <p>Log in to save bets to your tracker.</p>
            <Link href="/login" className="rounded-lg bg-accent py-2 font-bold text-white">
              Log in
            </Link>
          </div>
        ) : done ? (
          <div className="flex flex-col gap-3 py-4 text-center">
            <div className="text-3xl">✅</div>
            <div className="text-sm font-extrabold text-text">Bet logged</div>
            <p className="text-[11px] text-muted">It is in your tracker as pending. Update the result there once it settles.</p>
            <div className="flex gap-2">
              <Link href="/account" className="flex-1 rounded-lg border border-accent/40 bg-accent/10 py-2 text-[12px] font-bold text-accent">
                View in tracker
              </Link>
              <button onClick={onClose} className="flex-1 rounded-lg border border-border2 py-2 text-[12px] font-bold text-text2">
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              {legs.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-2 rounded-lg bg-card3 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-bold text-text">{l.label}</div>
                    <div className="truncate text-[10px] text-muted">{l.matchup}</div>
                  </div>
                  <span className="stat-number text-[12px] text-accent">{formatOdds(l.oddsAmerican, settings.oddsFormat)}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-card3 px-2 py-2">
                <div className="text-[9px] text-muted">Bet type</div>
                <div className="text-[12px] font-bold text-text">{single ? betType : `${legs.length}-leg Parlay`}</div>
              </div>
              <div className="rounded-lg bg-card3 px-2 py-2">
                <div className="text-[9px] text-muted">{single ? 'Odds' : 'Combined odds'}</div>
                <div className="stat-number text-[12px] font-bold text-accent">{odds !== null ? formatOdds(odds, settings.oddsFormat) : '—'}</div>
              </div>
              <div className="rounded-lg bg-card3 px-2 py-2">
                <div className="text-[9px] text-muted">Result</div>
                <div className="text-[12px] font-bold text-text2">Pending</div>
              </div>
            </div>

            <label className="flex items-center justify-between gap-3">
              <span className="text-[12px] font-semibold text-text2">Stake</span>
              <div className="flex items-center gap-1 rounded-lg border border-border bg-card3 px-2.5 py-1.5">
                <span className="text-text2">$</span>
                <input inputMode="decimal" value={stakeText} onChange={(e) => setStakeText(e.target.value.replace(/[^0-9.]/g, ''))} aria-label="Stake amount in dollars" className="stat-number w-24 bg-transparent text-right text-[14px] focus:outline-none" />
              </div>
            </label>
            {odds !== null && Number.isFinite(stake) && stake > 0 && <div className="text-right text-[10px] text-muted">To win {money(stake * (odds > 0 ? odds / 100 : 100 / -odds))}</div>}
            {error && <div className="rounded-lg bg-loss/10 px-3 py-2 text-[11px] text-loss">{error}</div>}

            <button onClick={confirm} disabled={saving} className="rounded-lg bg-accent py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
              {saving ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
