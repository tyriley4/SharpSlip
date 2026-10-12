'use client'

import { useEffect, useMemo, useState } from 'react'
import type { GameSel } from '@/lib/account/legs'
import type { BetPlayer } from '@/lib/account/playerSearch'
import type { BetSport } from '@/lib/account/types'
import { TextInput } from './ui'

/**
 * Player search. With a game selected it lists both teams' players; otherwise it searches by name. Anything typed is
 * accepted, so players who aren't in the list can still be tracked.
 */
export function PlayerPicker({
  sport,
  game,
  value,
  onChange,
  onPick,
}: {
  sport: BetSport
  game: GameSel | null
  value: string
  onChange: (name: string) => void
  onPick: (p: BetPlayer) => void
}) {
  const [players, setPlayers] = useState<BetPlayer[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const teams = game && !game.manual ? [game.away, game.home] : game ? [game.away, game.home] : []
  const teamKey = teams.join(',')

  useEffect(() => {
    const q = value.trim()
    // With a game we load its rosters once; without one we search as the user types.
    if (teams.length === 0 && q.length < 2) {
      setPlayers([])
      return
    }
    let cancelled = false
    const timer = setTimeout(
      () => {
        setLoading(true)
        const params = new URLSearchParams({ sport, teams: teamKey, q: teams.length === 0 ? q : '' })
        fetch(`/api/bet-players?${params.toString()}`)
          .then((res) => (res.ok ? res.json() : { players: [] }))
          .then((data: { players: BetPlayer[] }) => {
            if (!cancelled) setPlayers(data.players)
          })
          .catch(() => {
            if (!cancelled) setPlayers([])
          })
          .finally(() => {
            if (!cancelled) setLoading(false)
          })
      },
      teams.length === 0 ? 300 : 0
    )
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport, teamKey, teams.length === 0 ? value : ''])

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase()
    const list = q ? players.filter((p) => p.name.toLowerCase().includes(q)) : players
    return list.slice(0, 30)
  }, [players, value])

  return (
    <div className="relative">
      <TextInput
        value={value}
        placeholder={game ? `Search ${game.away} / ${game.home} players` : 'Search any player'}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
      />
      {open && (matches.length > 0 || loading) && (
        <div className="absolute z-30 mt-1 max-h-[220px] w-full overflow-y-auto rounded-xl border border-border2 bg-card shadow-[0_8px_24px_rgba(0,0,0,0.55)]">
          {loading && matches.length === 0 && <div className="px-3 py-3 text-center text-[11px] text-muted">Searching…</div>}
          {matches.map((p) => (
            <button
              key={`${p.name}-${p.team}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(p)
                setOpen(false)
              }}
              className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-[12px] font-semibold text-text last:border-0 hover:bg-card3"
            >
              <span>{p.name}</span>
              <span className="text-[10px] font-medium text-muted">
                {p.team} {p.position && `· ${p.position}`}
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="mt-1 text-[10px] text-muted">Not in the list? Just type the name.</p>
    </div>
  )
}
