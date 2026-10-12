'use client'

import { useMemo, useState } from 'react'
import { formatOdds } from '@/lib/account/odds'
import { gameLabel, isMultiLeg, potentialProfit } from '@/lib/account/parlay'
import { BET_SPORTS, BET_TYPES, type Bet, type BetLeg, type BetResult, type BetSport, type BetType, type OddsFormat } from '@/lib/account/types'
import { Pill } from './ui'

type ResultFilter = 'All' | 'Pending' | 'Won' | 'Lost' | 'Pushed'
type DateFilter = 'This Week' | 'This Month' | 'All Time'

const RESULT_FILTERS: Record<ResultFilter, BetResult | null> = { All: null, Pending: 'pending', Won: 'win', Lost: 'loss', Pushed: 'push' }
const SPORT_LABEL: Record<BetSport, string> = { mlb: 'MLB', nfl: 'NFL', nba: 'NBA', nhl: 'NHL' }

const BORDER: Record<BetResult, string> = { win: 'bg-win', loss: 'bg-loss', push: 'bg-[#FFB800]', pending: 'bg-accent animate-pulse' }
const LEG_BADGE: Record<BetResult, { text: string; cls: string }> = {
  win: { text: 'W', cls: 'bg-win/15 text-win' },
  loss: { text: 'L', cls: 'bg-loss/15 text-loss' },
  push: { text: 'P', cls: 'bg-[#FFB800]/15 text-[#FFB800]' },
  pending: { text: '…', cls: 'bg-accent/15 text-accent' },
}

const dollars = (n: number) => `$${Math.abs(n).toFixed(2).replace(/\.00$/, '')}`

function betDate(b: Bet): Date {
  return new Date(b.game_date ? `${b.game_date}T12:00:00` : b.created_at)
}

function inRange(b: Bet, range: DateFilter): boolean {
  if (range === 'All Time') return true
  const d = betDate(b)
  const now = new Date()
  if (range === 'This Month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)) // Monday
  return d >= start
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[44px] shrink-0 text-[9px] font-extrabold uppercase tracking-[0.1em] text-muted">{label}</span>
      <div className="flex gap-1.5 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{children}</div>
    </div>
  )
}

function LegLine({ leg, oddsFormat }: { leg: BetLeg; oddsFormat: OddsFormat }) {
  const badge = LEG_BADGE[leg.result]
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-extrabold ${badge.cls}`}>{badge.text}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-semibold text-text">{leg.pick}</div>
        <div className="text-[10px] text-muted">
          {leg.sport.toUpperCase()} · {leg.away} vs {leg.home}
        </div>
      </div>
      <span className="stat-number shrink-0 text-[11px] text-text2">{formatOdds(leg.odds, oddsFormat)}</span>
    </div>
  )
}

function BetRow({ bet, oddsFormat, onEdit, onDelete }: { bet: Bet; oddsFormat: OddsFormat; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const legs = bet.details?.legs ?? []
  const multi = isMultiLeg(bet.bet_type) && legs.length > 0
  const game = gameLabel(bet)
  const odds = formatOdds(bet.odds, oddsFormat)

  const betLine = multi
    ? `${legs.length}-leg ${bet.bet_type.toLowerCase()}${bet.bet_type === 'Teaser' && bet.details?.teaserPoints ? ` (+${bet.details.teaserPoints})` : ''} ${odds}`
    : legs.length === 1
      ? `${legs[0].pick} ${odds}`
      : bet.description

  const win = potentialProfit(bet.bet_type, bet.odds, bet.stake, bet.details)
  let returnText: string
  let returnColor = 'text-text2'
  if (bet.result === 'pending') returnText = `To win +${dollars(win)}`
  else if (bet.result === 'win') {
    returnText = `+${dollars(bet.profit ?? win)}`
    returnColor = 'text-win'
  } else if (bet.result === 'loss') {
    returnText = `-${dollars(bet.stake)}`
    returnColor = 'text-loss'
  } else returnText = 'Push — stake back'

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card pl-3.5">
      <span className={`absolute inset-y-0 left-0 w-[3px] ${BORDER[bet.result]}`} aria-hidden />
      <div className="flex items-start gap-3 py-3 pr-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-card3 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-text2">{SPORT_LABEL[bet.sport]}</span>
            <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-accent">{bet.bet_type}</span>
            {game && <span className="text-[11px] font-semibold text-muted">{game}</span>}
          </div>
          <div className="mt-1.5 text-[14px] font-extrabold leading-snug text-text">{betLine}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
            <span className="text-muted">
              Stake <span className="font-bold text-text2">{dollars(bet.stake)}</span>
            </span>
            <span className="text-muted">
              Return <span className={`font-extrabold ${returnColor}`}>{returnText}</span>
            </span>
          </div>
          {bet.notes && <div className="mt-1 text-[10px] italic text-muted">“{bet.notes}”</div>}
          {multi && (
            <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-2 text-[11px] font-bold text-accent hover:underline">
              {open ? '▾ Hide legs' : `▸ Show ${legs.length} legs`}
            </button>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="text-[10px] font-semibold text-muted">{betDate(bet).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          <div className="flex gap-2">
            <button onClick={onEdit} className="text-[12px] text-muted hover:text-text" aria-label="Edit bet">
              ✎
            </button>
            <button onClick={onDelete} className="text-[12px] text-muted hover:text-negative" aria-label="Delete bet">
              🗑
            </button>
          </div>
        </div>
      </div>
      {multi && open && (
        <div className="border-t border-border bg-card2 px-1 py-1 pr-3">
          {legs.map((l, i) => (
            <LegLine key={i} leg={l} oddsFormat={oddsFormat} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Filter pills (always visible) over the list of logged bets. */
export function BetHistory({ bets, oddsFormat, onEdit, onDelete }: { bets: Bet[]; oddsFormat: OddsFormat; onEdit: (b: Bet) => void; onDelete: (id: string) => void }) {
  const [result, setResult] = useState<ResultFilter>('All')
  const [sport, setSport] = useState<'All' | BetSport>('All')
  const [range, setRange] = useState<DateFilter>('All Time')
  const [type, setType] = useState<'All' | BetType>('All')

  const filtered = useMemo(() => {
    const want = RESULT_FILTERS[result]
    return bets.filter((b) => (!want || b.result === want) && (sport === 'All' || b.sport === sport) && (type === 'All' || b.bet_type === type) && inRange(b, range))
  }, [bets, result, sport, range, type])

  const active = [result !== 'All', sport !== 'All', range !== 'All Time', type !== 'All'].filter(Boolean).length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card2 p-3">
        <FilterRow label="Result">
          {(Object.keys(RESULT_FILTERS) as ResultFilter[]).map((r) => (
            <Pill key={r} active={result === r} onClick={() => setResult(r)}>
              {r}
            </Pill>
          ))}
        </FilterRow>
        <FilterRow label="Sport">
          {(['All', ...BET_SPORTS] as const).map((s) => (
            <Pill key={s} active={sport === s} onClick={() => setSport(s)}>
              {s === 'All' ? 'All' : SPORT_LABEL[s]}
            </Pill>
          ))}
        </FilterRow>
        <FilterRow label="When">
          {(['This Week', 'This Month', 'All Time'] as const).map((r) => (
            <Pill key={r} active={range === r} onClick={() => setRange(r)}>
              {r}
            </Pill>
          ))}
        </FilterRow>
        <FilterRow label="Type">
          {(['All', ...BET_TYPES] as const).map((t) => (
            <Pill key={t} active={type === t} onClick={() => setType(t)}>
              {t}
            </Pill>
          ))}
        </FilterRow>
        {active > 0 && (
          <button
            onClick={() => {
              setResult('All')
              setSport('All')
              setRange('All Time')
              setType('All')
            }}
            className="w-fit text-[10px] font-bold text-accent hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="text-[10px] font-bold tracking-[0.1em] text-muted">
        {filtered.length} BET{filtered.length === 1 ? '' : 'S'}
        {active > 0 ? ' MATCH' : ''}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-8 text-center text-xs text-muted">No bets match these filters.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((b) => (
            <BetRow key={b.id} bet={b} oddsFormat={oddsFormat} onEdit={() => onEdit(b)} onDelete={() => onDelete(b.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
