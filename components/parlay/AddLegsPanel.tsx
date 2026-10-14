'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { LineRowView } from '@/components/parlay/LineButton'
import { SportBadge } from '@/components/ui/SportBadge'
import { gameLines, type ParlayGame } from '@/lib/parlay/suggest'
import type { GameLines } from '@/lib/parlay/lines'
import { SPORTS } from '@/lib/sport/SportContext'
import type { Sport } from '@/lib/sport/SportContext'

interface GameWithLines {
  game: ParlayGame
  lines: GameLines
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function GameBlock({ entry, defaultOpen = false }: { entry: GameWithLines; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const { game, lines } = entry

  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-card">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left" aria-expanded={open}>
        <div className="flex min-w-0 items-center gap-2">
          <SportBadge sport={game.sport} />
          <span className="text-[13px] font-bold text-text">
            {game.awayAbbr} @ {game.homeAbbr}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[10px] text-muted">
          <span>{game.status === 'Live' ? 'LIVE' : formatTime(game.startTime)}</span>
          <span className="text-[11px] text-text2">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="flex flex-col gap-2 border-t border-border p-3">
          {lines.gameLines.length === 0 && <div className="rounded-xl border border-border bg-card3 px-3 py-4 text-center text-[11px] text-muted">Lines temporarily unavailable</div>}
          {lines.gameLines.map((row) => (
            <LineRowView key={row.title} row={row} />
          ))}
          {lines.props.slice(0, 3).map((group) => (
            <div key={`${group.team}-${group.player}`} className="flex flex-col gap-2">
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-[12px] font-extrabold text-text">{group.player}</span>
                <span className="text-[10px] text-muted">
                  {group.position ? `${group.position} · ` : ''}
                  {group.team}
                </span>
              </div>
              {group.rows.slice(0, 1).map((row) => (
                <LineRowView key={row.title} row={row} />
              ))}
            </div>
          ))}
          <Link href={game.href} className="text-[11px] font-semibold text-accent">
            All lines &amp; analysis →
          </Link>
        </div>
      )}
    </div>
  )
}

export function AddLegsPanel({ games }: { games: ParlayGame[] }) {
  const [query, setQuery] = useState('')
  const [sportFilter, setSportFilter] = useState<Sport | 'all'>('all')

  const entries = useMemo<GameWithLines[]>(() => games.map((game) => ({ game, lines: gameLines(game) })), [games])

  const q = query.trim().toLowerCase()

  const teamMatches = useMemo(() => {
    if (q.length < 2) return []
    return entries.filter(({ game }) => game.awayAbbr.toLowerCase().includes(q) || game.homeAbbr.toLowerCase().includes(q))
  }, [entries, q])

  const playerMatches = useMemo(() => {
    if (q.length < 2) return []
    const out: { entry: GameWithLines; groupIndex: number }[] = []
    for (const entry of entries) {
      entry.lines.props.forEach((group, groupIndex) => {
        if (group.player.toLowerCase().includes(q)) out.push({ entry, groupIndex })
      })
    }
    return out.slice(0, 8)
  }, [entries, q])

  const browse = entries.filter(({ game }) => sportFilter === 'all' || game.sport === sportFilter)
  const searching = q.length >= 2

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="section-header text-sm text-text md:text-base">Add Legs</h3>
        <p className="mt-0.5 text-[11px] text-muted">Search a team, or browse today&apos;s games. Prices are real sportsbook lines; player props are on each game&apos;s Recommended Bets tab.</p>
      </div>

      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search teams (e.g. VGK, NYY)"
          aria-label="Search teams"
          className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-[13px] text-text placeholder:text-muted focus:border-accent focus:outline-none"
        />
        {query && (
          <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text">
            ✕
          </button>
        )}
      </div>

      {searching ? (
        <div className="flex flex-col gap-3">
          {teamMatches.length === 0 && playerMatches.length === 0 && (
            <div className="rounded-[14px] border border-border bg-card py-8 text-center text-xs text-muted">
              No teams match &ldquo;{query}&rdquo; on today&apos;s slate.
            </div>
          )}

          {teamMatches.map(({ game, lines }) => (
            <div key={`team-${game.sport}-${game.gameId}`} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <SportBadge sport={game.sport} />
                <span className="text-[12px] font-bold text-text">
                  {game.awayAbbr} @ {game.homeAbbr}
                </span>
              </div>
              {lines.gameLines.map((row) => (
                <LineRowView key={row.title} row={row} />
              ))}
            </div>
          ))}

          {playerMatches.map(({ entry, groupIndex }) => {
            const group = entry.lines.props[groupIndex]
            return (
              <div key={`player-${entry.game.sport}-${entry.game.gameId}-${group.player}`} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <SportBadge sport={entry.game.sport} />
                  <span className="text-[12px] font-extrabold text-text">{group.player}</span>
                  <span className="text-[10px] text-muted">
                    {group.team} · {entry.game.awayAbbr} @ {entry.game.homeAbbr}
                  </span>
                </div>
                {group.rows.map((row) => (
                  <LineRowView key={row.title} row={row} />
                ))}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => setSportFilter('all')}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${sportFilter === 'all' ? 'border-accent bg-accent text-white' : 'border-border bg-card text-muted'}`}
            >
              All
            </button>
            {SPORTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSportFilter(s.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${sportFilter === s.id ? 'border-accent bg-accent text-white' : 'border-border bg-card text-muted'}`}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>

          {browse.length === 0 ? (
            <div className="rounded-[14px] border border-border bg-card py-10 text-center text-xs text-muted">No games on today&apos;s slate for this sport.</div>
          ) : (
            browse.map((entry) => <GameBlock key={`${entry.game.sport}-${entry.game.gameId}`} entry={entry} />)
          )}
        </div>
      )}
    </section>
  )
}
