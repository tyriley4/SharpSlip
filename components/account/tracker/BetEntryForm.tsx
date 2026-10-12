'use client'

import { trackEvent } from '@/lib/analytics/posthog'
import { useMemo, useState } from 'react'
import { createBet, updateBet } from '@/lib/account/bets'
import { buildLeg, draftFromLeg, EMPTY_DRAFT, gameFromLeg, parseAmericanOdds, type GameSel, type LegDraft, type LegMarket } from '@/lib/account/legs'
import { formatOdds } from '@/lib/account/odds'
import { deriveMultiLegResult, describeBet, isMultiLeg, parlayOdds, PARLAY_MAX_LEGS, PARLAY_MIN_LEGS, potentialProfit, teaserOdds, TEASER_MAX_LEGS, TEASER_POINTS } from '@/lib/account/parlay'
import { defaultRole } from '@/lib/account/props'
import { BET_RESULTS, BET_SPORTS, UNIT_SIZE, type Bet, type BetLeg, type BetResult, type BetSport, type BetType } from '@/lib/account/types'
import { useAccountData } from '@/lib/account/AccountDataContext'
import { useAuth } from '@/lib/auth/AuthContext'
import { GamePicker } from './GamePicker'
import { LegBuilder } from './LegBuilder'
import { LegDetails } from './LegDetails'
import { FieldLabel, Pill, StepHeader, TextInput } from './ui'

const SPORT_LABEL: Record<BetSport, string> = { mlb: 'MLB', nfl: 'NFL', nba: 'NBA', nhl: 'NHL' }

const TYPE_CARDS: { type: BetType; icon: string; blurb: string }[] = [
  { type: 'Moneyline', icon: '💰', blurb: 'Pick the winner' },
  { type: 'Spread', icon: '📊', blurb: 'Cover the line' },
  { type: 'Total', icon: '⬆️', blurb: 'Over or under' },
  { type: 'Player Prop', icon: '🎯', blurb: 'A player stat' },
  { type: 'Parlay', icon: '🎲', blurb: '2–12 legs' },
  { type: 'Teaser', icon: '🔀', blurb: 'Moved spreads' },
]

const RESULT_BUTTONS: { id: BetResult; icon: string; label: string }[] = [
  { id: 'pending', icon: '⏳', label: 'Pending' },
  { id: 'win', icon: '✅', label: 'Win' },
  { id: 'loss', icon: '❌', label: 'Loss' },
  { id: 'push', icon: '🔄', label: 'Push' },
]

const SINGLE_MARKETS: LegMarket[] = ['Moneyline', 'Spread', 'Total', 'Player Prop']
const TEASER_MARKETS: LegMarket[] = ['Spread', 'Total']

const money = (n: number) => `$${n.toFixed(2).replace(/\.00$/, '')}`

function LegRow({ leg, onRemove, onResult }: { leg: BetLeg; onRemove: () => void; onResult: (r: BetResult) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-bold text-text">{leg.pick}</div>
        <div className="text-[10px] text-muted">
          {leg.sport.toUpperCase()} · {leg.away} vs {leg.home} · {leg.odds > 0 ? `+${leg.odds}` : leg.odds}
        </div>
      </div>
      <div className="flex shrink-0 gap-0.5" role="group" aria-label="Leg result">
        {RESULT_BUTTONS.map((r) => (
          <button
            key={r.id}
            type="button"
            title={r.label}
            aria-pressed={leg.result === r.id}
            onClick={() => onResult(r.id)}
            className={`h-6 w-6 rounded-md text-[11px] transition-colors ${leg.result === r.id ? 'bg-accent/25 ring-1 ring-accent' : 'opacity-50 hover:opacity-100'}`}
          >
            {r.icon}
          </button>
        ))}
      </div>
      <button type="button" onClick={onRemove} aria-label="Remove leg" className="shrink-0 px-1 text-sm text-muted hover:text-negative">
        ✕
      </button>
    </div>
  )
}

/** The structured "Log a Bet" flow: sport & game → bet type → type-specific details → stake & result → review. */
export function BetEntryForm({ bet, onClose, onSaved }: { bet?: Bet; onClose: () => void; onSaved: (bet: Bet) => void }) {
  const { user } = useAuth()
  const { settings } = useAccountData()

  const savedLegs = bet?.details?.legs ?? []
  const editingMulti = bet ? isMultiLeg(bet.bet_type) : false

  const [sport, setSport] = useState<BetSport>(savedLegs[0]?.sport ?? 'mlb')
  const [game, setGame] = useState<GameSel | null>(savedLegs[0] ? gameFromLeg(savedLegs[0]) : null)
  const [betType, setBetType] = useState<BetType>(bet?.bet_type ?? 'Moneyline')
  const [draft, setDraft] = useState<LegDraft>(savedLegs[0] && !editingMulti ? draftFromLeg(savedLegs[0]) : { ...EMPTY_DRAFT, role: defaultRole(savedLegs[0]?.sport ?? 'mlb') })
  const [legs, setLegs] = useState<BetLeg[]>(editingMulti ? savedLegs : [])
  const [teaserPoints, setTeaserPoints] = useState<number>(bet?.details?.teaserPoints ?? 6)
  const [oddsOverride, setOddsOverride] = useState(editingMulti && bet ? String(bet.odds) : '')
  const [stakeMode, setStakeMode] = useState<'dollars' | 'units'>(bet?.details?.stakeMode ?? 'dollars')
  const [stakeText, setStakeText] = useState(() => {
    if (!bet) return ''
    return bet.details?.stakeMode === 'units' ? String(Math.round((bet.stake / UNIT_SIZE) * 100) / 100) : String(bet.stake)
  })
  const [result, setResult] = useState<BetResult>(bet && !editingMulti ? bet.result : 'pending')
  const [notes, setNotes] = useState(bet?.notes ?? '')
  const [review, setReview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const multi = isMultiLeg(betType)
  const stakeNum = parseFloat(stakeText)
  const stakeDollars = Number.isFinite(stakeNum) ? (stakeMode === 'units' ? stakeNum * UNIT_SIZE : stakeNum) : NaN
  const stakeUnits = Number.isFinite(stakeDollars) ? stakeDollars / UNIT_SIZE : NaN

  // Odds the ticket is priced at: a single leg's own price, or the parlay / teaser's combined price.
  const autoOdds = betType === 'Parlay' ? parlayOdds(legs.map((l) => ({ ...l, result: 'pending' as BetResult }))) : betType === 'Teaser' ? teaserOdds(teaserPoints, legs.length) : null
  const overrideOdds = parseAmericanOdds(oddsOverride)
  const multiOdds = overrideOdds ?? autoOdds
  const singleBuilt = useMemo(() => (multi ? null : buildLeg(sport, game, betType as LegMarket, draft)), [multi, sport, game, betType, draft])
  const singleOdds = singleBuilt && 'leg' in singleBuilt ? singleBuilt.leg.odds : null
  const ticketOdds = multi ? multiOdds : singleOdds

  const effectiveResult: BetResult = multi ? deriveMultiLegResult(legs.length > 0 ? legs : [{ result: 'pending' }]) : result
  const payout = ticketOdds !== null && Number.isFinite(stakeDollars) && stakeDollars > 0 ? potentialProfit(betType, ticketOdds, stakeDollars) : null

  function validate(): { legs: BetLeg[]; odds: number } | string {
    if (multi) {
      const max = betType === 'Teaser' ? TEASER_MAX_LEGS : PARLAY_MAX_LEGS
      if (legs.length < PARLAY_MIN_LEGS) return `Add at least ${PARLAY_MIN_LEGS} legs.`
      if (legs.length > max) return `A ${betType.toLowerCase()} can have at most ${max} legs.`
      if (ticketOdds === null) return betType === 'Teaser' ? 'Enter the price your book gave this teaser.' : 'Enter the combined odds.'
    } else {
      if (!singleBuilt || 'error' in singleBuilt) return singleBuilt && 'error' in singleBuilt ? singleBuilt.error : 'Complete the bet details.'
    }
    if (!Number.isFinite(stakeDollars) || stakeDollars <= 0) return 'Enter a stake greater than 0.'
    if (multi) return { legs, odds: ticketOdds as number }
    const leg = { ...(singleBuilt as { leg: BetLeg }).leg, result }
    return { legs: [leg], odds: leg.odds }
  }

  function goReview() {
    const v = validate()
    if (typeof v === 'string') {
      setError(v)
      return
    }
    setError(null)
    setReview(true)
  }

  async function save() {
    if (!user) return
    const v = validate()
    if (typeof v === 'string') {
      setError(v)
      setReview(false)
      return
    }
    setSaving(true)
    setError(null)

    const finalResult = multi ? deriveMultiLegResult(v.legs) : result
    const dates = v.legs.map((l) => l.gameDate).filter((d): d is string => !!d).sort()
    const input = {
      sport: v.legs[0].sport,
      bet_type: betType,
      description: describeBet(betType, v.legs, v.odds, multi && betType === 'Teaser' ? teaserPoints : undefined),
      odds: v.odds,
      stake: Math.round(stakeDollars * 100) / 100,
      game_date: dates[0] ?? null,
      result: finalResult,
      notes: notes.trim() || null,
      details: { legs: v.legs, teaserPoints: betType === 'Teaser' ? teaserPoints : undefined, stakeMode },
    }

    const saved = bet ? await updateBet(bet.id, input) : await createBet(user.id, input)
    setSaving(false)
    if (!saved) {
      setError('Could not save this bet. Please try again.')
      setReview(false)
      return
    }
    if (!bet) trackEvent('bet_logged', { sport: input.sport, betType: input.bet_type })
    // Hand back the structured legs even when the database has no details column yet, so this session still sees them.
    onSaved({ ...saved, details: saved.details ?? input.details })
  }

  const summaryLegs = (validate() as { legs?: BetLeg[] }).legs
  const summaryOdds = (validate() as { odds?: number }).odds
  const summaryText =
    summaryLegs && summaryOdds !== undefined
      ? describeBet(betType, summaryLegs, summaryOdds, betType === 'Teaser' ? teaserPoints : undefined)
      : ''

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 md:items-center md:p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-t-2xl border border-border bg-card md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={bet ? 'Edit bet' : 'Log a bet'}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[15px] font-extrabold text-text">{bet ? 'Edit Bet' : 'Log a Bet'}</h2>
          <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-text2 hover:border-border2 hover:text-text">
            ✕
          </button>
        </div>

        {review ? (
          <div className="flex flex-col gap-4 overflow-y-auto p-4">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted">Review your bet</div>
            <div className="rounded-2xl border border-accent/40 bg-accent/[0.07] p-4">
              <div className="text-[15px] font-extrabold leading-snug text-text">
                {summaryText.replace(/ [+-]\d+$/, (m) => ` ${formatOdds(parseInt(m, 10), settings.oddsFormat)}`)} — {money(stakeDollars)} stake — {RESULT_BUTTONS.find((r) => r.id === effectiveResult)?.label}
              </div>
              <div className="mt-2 text-[12px] text-text2">
                {stakeUnits.toFixed(2).replace(/\.?0+$/, '')} units · {payout !== null ? `pays ${money(stakeDollars + payout)} if it wins (${money(payout)} profit)` : ''}
              </div>
              {summaryLegs && summaryLegs.length > 1 && (
                <ul className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-[11px] text-text2">
                  {summaryLegs.map((l, i) => (
                    <li key={i}>
                      {i + 1}. {l.pick} <span className="text-muted">({l.sport.toUpperCase()} · {l.odds > 0 ? `+${l.odds}` : l.odds})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {error && <p className="text-xs font-semibold text-negative">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setReview(false)} className="rounded-xl border border-border py-3 text-[13px] font-bold text-text2 hover:border-border2">
                ← Edit
              </button>
              <button onClick={save} disabled={saving} className="rounded-xl bg-accent py-3 text-[13px] font-extrabold text-white shadow-[0_0_16px_rgba(59,158,255,0.4)] disabled:opacity-60">
                {saving ? 'Saving…' : bet ? 'Save Changes' : 'Confirm & Log'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 overflow-y-auto p-4">
            {/* STEP 1 */}
            <section>
              <StepHeader n={1} title="Sport & game" hint={multi ? 'Sets the first leg — each leg can use its own sport and game.' : undefined} />
              <div className="mb-3 grid grid-cols-4 gap-1.5">
                {BET_SPORTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={sport === s}
                    onClick={() => {
                      setSport(s)
                      setGame(null)
                      setDraft({ ...EMPTY_DRAFT, role: defaultRole(s) })
                    }}
                    className={`rounded-xl border py-2.5 text-[12px] font-extrabold transition-colors ${sport === s ? 'border-accent bg-accent text-white shadow-[0_0_10px_rgba(59,158,255,0.3)]' : 'border-border bg-card3 text-text2 hover:border-border2'}`}
                  >
                    {SPORT_LABEL[s]}
                  </button>
                ))}
              </div>
              <GamePicker sport={sport} value={game} onChange={setGame} />
            </section>

            {/* STEP 2 */}
            <section>
              <StepHeader n={2} title="Bet type" />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TYPE_CARDS.map((c) => {
                  const active = betType === c.type
                  return (
                    <button
                      key={c.type}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setBetType(c.type)
                        setError(null)
                        // Teasers only move spreads and totals, so legs on other markets can't carry over.
                        if (c.type === 'Teaser') setLegs((prev) => prev.filter((l) => l.market === 'Spread' || l.market === 'Total'))
                      }}
                      className={`flex flex-col items-start gap-0.5 rounded-xl border px-3 py-3 text-left transition-colors ${active ? 'border-accent bg-accent/10 shadow-[0_0_14px_rgba(59,158,255,0.2)]' : 'border-border bg-card3 hover:border-border2'}`}
                    >
                      <span className="text-xl">{c.icon}</span>
                      <span className="text-[13px] font-extrabold text-text">{c.type}</span>
                      <span className="text-[10px] text-muted">{c.blurb}</span>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* STEP 3 */}
            <section>
              <StepHeader n={3} title="Bet details" />
              {!multi ? (
                <LegDetails sport={sport} game={game} market={betType as LegMarket} draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
              ) : (
                <div className="flex flex-col gap-3">
                  {betType === 'Teaser' && (
                    <div>
                      <FieldLabel>Teaser points</FieldLabel>
                      <div className="flex gap-1.5">
                        {TEASER_POINTS.map((p) => (
                          <Pill key={p} active={teaserPoints === p} onClick={() => setTeaserPoints(p)}>
                            +{p}
                          </Pill>
                        ))}
                      </div>
                      <p className="mt-1.5 text-[10px] text-muted">Teasers use spreads and totals only. Prices below are typical estimates — type your book&apos;s price if it differs.</p>
                    </div>
                  )}

                  <div>
                    <FieldLabel>
                      Legs ({legs.length}/{betType === 'Teaser' ? TEASER_MAX_LEGS : PARLAY_MAX_LEGS}, min {PARLAY_MIN_LEGS})
                    </FieldLabel>
                    {legs.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted">No legs yet — build one below.</p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {legs.map((l, i) => (
                          <LegRow
                            key={i}
                            leg={l}
                            onRemove={() => setLegs((prev) => prev.filter((_, j) => j !== i))}
                            onResult={(r) => setLegs((prev) => prev.map((x, j) => (j === i ? { ...x, result: r } : x)))}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {legs.length < (betType === 'Teaser' ? TEASER_MAX_LEGS : PARLAY_MAX_LEGS) && (
                    <LegBuilder
                      key={legs.length}
                      markets={betType === 'Teaser' ? TEASER_MARKETS : SINGLE_MARKETS}
                      defaultSport={sport}
                      defaultGame={game}
                      onAdd={(leg) => setLegs((prev) => [...prev, leg])}
                    />
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-border bg-card3 px-3 py-2.5">
                      <div className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-muted">{betType === 'Teaser' ? 'Estimated odds' : 'Combined odds'}</div>
                      <div className="stat-number mt-0.5 text-lg text-text">{autoOdds !== null ? (autoOdds > 0 ? `+${autoOdds}` : autoOdds) : '—'}</div>
                    </div>
                    <div>
                      <FieldLabel>Book price (optional)</FieldLabel>
                      <TextInput inputMode="numeric" value={oddsOverride} onChange={(e) => setOddsOverride(e.target.value)} placeholder="Overrides the estimate" />
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* STEP 4 */}
            <section>
              <StepHeader n={4} title="Stake & result" />
              <div className="flex flex-col gap-3">
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <FieldLabel>Stake</FieldLabel>
                    <div className="mb-1.5 flex gap-0.5 rounded-lg border border-border bg-card3 p-0.5">
                      {(['dollars', 'units'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          aria-pressed={stakeMode === m}
                          onClick={() => {
                            // Convert what's typed so the amount stays the same bet.
                            if (Number.isFinite(stakeNum) && m !== stakeMode) setStakeText(String(m === 'units' ? Math.round((stakeNum / UNIT_SIZE) * 100) / 100 : Math.round(stakeNum * UNIT_SIZE * 100) / 100))
                            setStakeMode(m)
                          }}
                          className={`rounded-md px-2.5 py-1 text-[10px] font-extrabold ${stakeMode === m ? 'bg-accent text-white' : 'text-text2'}`}
                        >
                          {m === 'dollars' ? '$' : 'Units'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <TextInput inputMode="decimal" value={stakeText} onChange={(e) => setStakeText(e.target.value)} placeholder={stakeMode === 'dollars' ? '50' : '5'} />
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[11px] text-muted">
                    <span>
                      {Number.isFinite(stakeDollars) ? `${money(stakeDollars)} = ${stakeUnits.toFixed(2).replace(/\.?0+$/, '')} units` : `1 unit = ${money(UNIT_SIZE)}`}
                    </span>
                    {payout !== null && (
                      <span className="font-semibold text-win">
                        Pays {money(stakeDollars + payout)} (+{money(payout)})
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <FieldLabel>Result</FieldLabel>
                  {multi ? (
                    <div className="rounded-xl border border-border bg-card3 px-3 py-2.5 text-[11px] text-text2">
                      {RESULT_BUTTONS.find((r) => r.id === effectiveResult)?.icon} {RESULT_BUTTONS.find((r) => r.id === effectiveResult)?.label} — worked out from your legs. Mark each leg above as it settles.
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-1.5">
                      {RESULT_BUTTONS.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          aria-pressed={result === r.id}
                          onClick={() => setResult(r.id)}
                          className={`flex flex-col items-center gap-0.5 rounded-xl border py-2 text-[11px] font-bold transition-colors ${result === r.id ? 'border-accent bg-accent/10 text-text' : 'border-border bg-card3 text-text2 hover:border-border2'}`}
                        >
                          <span className="text-base">{r.icon}</span>
                          {r.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <FieldLabel>Notes (optional)</FieldLabel>
                  <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Cole was dominant, felt good about the K prop" />
                </div>
              </div>
            </section>

            {error && <p className="text-xs font-semibold text-negative">{error}</p>}

            {/* STEP 5 */}
            <button onClick={goReview} className="w-full rounded-xl bg-accent py-3.5 text-[14px] font-extrabold text-white shadow-[0_0_18px_rgba(59,158,255,0.45)] transition-transform active:scale-[0.99]">
              {bet ? 'Review Changes' : 'Log Bet'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
