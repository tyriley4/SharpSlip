'use client'

import { trackEvent } from '@/lib/analytics/posthog'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createBet, updateBet } from '@/lib/account/bets'
import { BET_RESULTS, BET_SPORTS, BET_TYPES, type Bet, type BetResult, type BetSport, type BetType } from '@/lib/account/types'
import { useAuth } from '@/lib/auth/AuthContext'

const SPORT_LABEL: Record<BetSport, string> = { mlb: 'MLB', nfl: 'NFL', cfb: 'CFB', nba: 'NBA', cbb: 'CBB', nhl: 'NHL' }
const RESULT_LABEL: Record<BetResult, string> = { pending: 'Pending', win: 'Win', loss: 'Loss', push: 'Push' }

export function BetForm({ bet, onClose, onSaved }: { bet?: Bet; onClose: () => void; onSaved: (bet: Bet) => void }) {
  const { user } = useAuth()
  const [sport, setSport] = useState<BetSport>(bet?.sport ?? 'mlb')
  const [betType, setBetType] = useState<BetType>(bet?.bet_type ?? 'Moneyline')
  const [description, setDescription] = useState(bet?.description ?? '')
  const [odds, setOdds] = useState(bet ? String(bet.odds) : '')
  const [stake, setStake] = useState(bet ? String(bet.stake) : '')
  const [gameDate, setGameDate] = useState(bet?.game_date ?? '')
  const [result, setResult] = useState<BetResult>(bet?.result ?? 'pending')
  const [notes, setNotes] = useState(bet?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    const oddsNum = parseInt(odds, 10)
    const stakeNum = parseFloat(stake)
    if (!description.trim()) {
      setError('Enter a description for this bet.')
      return
    }
    if (Number.isNaN(oddsNum) || oddsNum === 0) {
      setError('Enter valid American odds, e.g. -110 or +145.')
      return
    }
    if (Number.isNaN(stakeNum) || stakeNum <= 0) {
      setError('Enter a stake greater than 0.')
      return
    }

    setSaving(true)
    setError(null)

    const input = {
      sport,
      bet_type: betType,
      description: description.trim(),
      odds: oddsNum,
      stake: stakeNum,
      game_date: gameDate || null,
      result,
      notes: notes.trim() || null,
    }

    const saved = bet ? await updateBet(bet.id, input) : await createBet(user.id, input)
    setSaving(false)

    if (!saved) {
      setError('Could not save this bet. Please try again.')
      return
    }
    if (!bet) trackEvent('bet_logged', { sport: input.sport, betType: input.bet_type })
    onSaved(saved)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center md:p-4" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-md flex-col rounded-t-2xl border border-border bg-card p-4 md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h2 className="text-sm font-extrabold text-text">{bet ? 'Edit Bet' : 'Log a Bet'}</h2>
          <button onClick={onClose} className="text-lg text-muted hover:text-text">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 overflow-y-auto">
          <div>
            <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-muted">Sport</div>
            <div className="grid grid-cols-4 gap-1.5">
              {BET_SPORTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSport(s)}
                  className={`rounded-lg border px-1 py-2 text-[11px] font-bold transition-colors ${
                    sport === s ? 'border-accent bg-accent text-white' : 'border-border text-text2'
                  }`}
                >
                  {SPORT_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-muted">Bet Type</div>
            <div className="flex flex-wrap gap-1.5">
              {BET_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setBetType(t)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    betType === t ? 'border-accent bg-accent text-white' : 'border-border text-muted'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-muted">Description</div>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder='e.g. "Lakers ML" or "LeBron Over 25.5 pts"' />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-muted">Odds (American)</div>
              <Input type="number" value={odds} onChange={(e) => setOdds(e.target.value)} placeholder="-110" />
            </div>
            <div>
              <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-muted">Stake ($)</div>
              <Input type="number" step="0.01" min="0" value={stake} onChange={(e) => setStake(e.target.value)} placeholder="50" />
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-muted">Game Date</div>
            <Input type="date" value={gameDate ?? ''} onChange={(e) => setGameDate(e.target.value)} />
          </div>

          <div>
            <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-muted">Result</div>
            <div className="grid grid-cols-4 gap-1.5">
              {BET_RESULTS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setResult(r)}
                  className={`rounded-lg border px-1 py-2 text-[11px] font-semibold transition-colors ${
                    result === r ? 'border-accent bg-accent text-white' : 'border-border text-text2'
                  }`}
                >
                  {RESULT_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-muted">Notes (optional)</div>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any context for this bet" />
          </div>

          {error && <p className="text-xs text-negative">{error}</p>}

          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : bet ? 'Save Changes' : 'Log Bet'}
          </Button>
        </form>
      </div>
    </div>
  )
}
