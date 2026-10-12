'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { GameSel } from '@/lib/account/legs'
import type { BetSport } from '@/lib/account/types'
import type { UnifiedGame } from '@/lib/home/schedule'
import { FieldLabel, INPUT_CLASS, Pill, TextInput } from './ui'

type When = 'today' | 'future' | 'past'

function localDate(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function timeOf(g: UnifiedGame): string {
  if (g.status === 'Live') return 'LIVE'
  if (g.status === 'Final') return 'Final'
  if (g.startTime) {
    const t = new Date(g.startTime)
    if (!Number.isNaN(t.getTime())) return t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  return g.statusText
}

/**
 * Game selector: today's real schedule by default, a date picker for betting ahead ("Future game") or logging old
 * bets ("Past game"), and a manual entry for anything the schedule doesn't list.
 */
export function GamePicker({ sport, value, onChange }: { sport: BetSport; value: GameSel | null; onChange: (g: GameSel | null) => void }) {
  const [when, setWhen] = useState<When>('today')
  const [date, setDate] = useState(localDate())
  const [games, setGames] = useState<UnifiedGame[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [manual, setManual] = useState(false)
  const [manualAway, setManualAway] = useState('')
  const [manualHome, setManualHome] = useState('')
  const cache = useRef<Record<string, UnifiedGame[]>>({})

  useEffect(() => {
    if (when === 'today') setDate(localDate())
    else if (when === 'future') setDate(localDate(1))
    else setDate(localDate(-1))
  }, [when])

  useEffect(() => {
    if (!date) return
    if (cache.current[date]) {
      setGames(cache.current[date])
      return
    }
    let cancelled = false
    setLoading(true)
    setError(false)
    fetch(`/api/schedule?date=${date}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((data: { games: UnifiedGame[] }) => {
        if (cancelled) return
        cache.current[date] = data.games
        setGames(data.games)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [date])

  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    return games
      .filter((g) => g.sport === sport)
      .filter((g) => !q || `${g.away.abbr} ${g.home.abbr}`.toLowerCase().includes(q))
  }, [games, sport, query])

  function pick(g: UnifiedGame) {
    onChange({ id: g.id, away: g.away.abbr, home: g.home.abbr, date, label: `${g.away.abbr} @ ${g.home.abbr} — ${timeOf(g)}` })
    setOpen(false)
    setQuery('')
  }

  function applyManual(away: string, home: string) {
    const a = away.trim().toUpperCase()
    const h = home.trim().toUpperCase()
    onChange(a && h ? { away: a, home: h, date, label: `${a} @ ${h}`, manual: true } : null)
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5">
        <Pill active={when === 'today'} onClick={() => setWhen('today')}>
          Today
        </Pill>
        <Pill active={when === 'future'} onClick={() => setWhen('future')}>
          Future game
        </Pill>
        <Pill active={when === 'past'} onClick={() => setWhen('past')}>
          Past game
        </Pill>
        {when !== 'today' && (
          <input
            type="date"
            value={date}
            min={when === 'future' ? localDate(1) : undefined}
            max={when === 'past' ? localDate(-1) : undefined}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Game date"
            className="rounded-full border border-border bg-card3 px-3 py-1.5 text-[11px] font-semibold text-text focus:border-accent focus:outline-none [color-scheme:dark]"
          />
        )}
      </div>

      {!manual ? (
        <div className="relative">
          <FieldLabel>Game</FieldLabel>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className={`${INPUT_CLASS} flex items-center justify-between text-left`}
          >
            <span className={value ? 'text-text' : 'text-muted'}>{value ? value.label : loading ? 'Loading games…' : 'Search or choose a game'}</span>
            <span className="text-muted">▾</span>
          </button>

          {open && (
            <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-border2 bg-card shadow-[0_8px_24px_rgba(0,0,0,0.55)]">
              <div className="border-b border-border p-2">
                <TextInput autoFocus placeholder="Search team, e.g. NYY" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <div className="max-h-[220px] overflow-y-auto">
                {loading ? (
                  <div className="px-3 py-4 text-center text-[11px] text-muted">Loading games…</div>
                ) : error ? (
                  <div className="px-3 py-4 text-center text-[11px] text-muted">Couldn&apos;t load the schedule. Enter the teams manually below.</div>
                ) : options.length === 0 ? (
                  <div className="px-3 py-4 text-center text-[11px] text-muted">No {sport.toUpperCase()} games on {date}.</div>
                ) : (
                  options.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => pick(g)}
                      className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2.5 text-left text-[12px] font-semibold text-text last:border-0 hover:bg-card3"
                    >
                      <span>
                        {g.away.abbr} @ {g.home.abbr}
                      </span>
                      <span className="text-[11px] font-medium text-muted">{timeOf(g)}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Away team</FieldLabel>
            <TextInput
              value={manualAway}
              maxLength={4}
              placeholder="NYY"
              onChange={(e) => {
                setManualAway(e.target.value)
                applyManual(e.target.value, manualHome)
              }}
            />
          </div>
          <div>
            <FieldLabel>Home team</FieldLabel>
            <TextInput
              value={manualHome}
              maxLength={4}
              placeholder="BOS"
              onChange={(e) => {
                setManualHome(e.target.value)
                applyManual(manualAway, e.target.value)
              }}
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setManual((m) => !m)
          onChange(null)
        }}
        className="w-fit text-[10px] font-bold text-accent hover:underline"
      >
        {manual ? '← Pick from the schedule' : "Game not listed? Enter the teams yourself"}
      </button>
    </div>
  )
}
