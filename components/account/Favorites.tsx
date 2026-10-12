'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { BetLeaders } from '@/components/account/BetLeaders'
import { FavoritePlayerStar, FavoriteTeamStar } from '@/components/account/FavoriteStarButton'
import { MLB_TEAM_COLORS } from '@/data/mlb/teamColors'
import { NBA_TEAM_COLORS } from '@/data/nba/teamColors'
import { NFL_TEAM_COLORS } from '@/data/nfl/teamColors'
import { NHL_TEAM_COLORS } from '@/data/nhl/teamColors'
import { useAccountData } from '@/lib/account/AccountDataContext'
import { profitText, recordText, teamTallies } from '@/lib/account/betBreakdown'
import { useBets } from '@/lib/account/BetsContext'
import type { EnrichedFavoritePlayer, EnrichedFavoriteTeam } from '@/lib/account/favoritesEnrichment'
import { useAuth } from '@/lib/auth/AuthContext'

const TEAM_COLORS: Record<string, string> = { ...MLB_TEAM_COLORS, ...NFL_TEAM_COLORS, ...NBA_TEAM_COLORS, ...NHL_TEAM_COLORS }

const VIEWS = [
  { id: 'picked', label: '⭐ Your Picks' },
  { id: 'bets', label: '🎯 Most Bet' },
  { id: 'profit', label: '💰 Most Profitable' },
] as const

/** Favorites you starred, versus the teams and players your logged bets say you actually back. */
export function Favorites() {
  const { user } = useAuth()
  const [view, setView] = useState<(typeof VIEWS)[number]['id']>('picked')
  if (!user) return <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">Log in to save favorite teams and players.</div>

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-card p-1" role="tablist" aria-label="Favorites view">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={view === v.id}
            onClick={() => setView(v.id)}
            className={`rounded-lg px-1 py-2 text-[11px] font-extrabold transition-colors ${view === v.id ? 'bg-accent text-white shadow-[0_0_12px_rgba(59,158,255,0.4)]' : 'text-text2 hover:text-text'}`}
          >
            {v.label}
          </button>
        ))}
      </div>
      {view === 'picked' ? <PickedFavorites /> : <BetLeaders mode={view} />}
    </div>
  )
}

function PickedFavorites() {
  const { user } = useAuth()
  const { bets } = useBets()
  const tallies = new Map(teamTallies(bets).map((t) => [`${t.sport}:${t.abbr}`, t]))
  const { favorites, loading: favoritesLoading } = useAccountData()
  const [teams, setTeams] = useState<EnrichedFavoriteTeam[]>([])
  const [players, setPlayers] = useState<EnrichedFavoritePlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (favoritesLoading) return
    if (favorites.teams.length === 0 && favorites.players.length === 0) {
      setTeams([])
      setPlayers([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(false)

    fetch('/api/account/favorites-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(favorites),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((data: { teams: EnrichedFavoriteTeam[]; players: EnrichedFavoritePlayer[] }) => {
        if (cancelled) return
        setTeams(data.teams)
        setPlayers(data.players)
      })
      .catch((err) => {
        console.error('[Favorites] fetch failed', err)
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoritesLoading, JSON.stringify(favorites)])

  if (!user) {
    return <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">Log in to save favorite teams and players.</div>
  }

  if (loading || favoritesLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
        Loading your favorites…
      </div>
    )
  }

  if (favorites.teams.length === 0 && favorites.players.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">
        No favorites yet — tap the ☆ on a team in Standings or a player on their profile page to follow them here.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {error && <div className="rounded-xl border border-negative/25 bg-negative/[0.06] p-3 text-center text-xs text-muted">Some live stats couldn&apos;t load — showing what&apos;s available.</div>}

      {teams.length > 0 && (
        <div>
          <div className="mb-2 text-[10px] font-extrabold tracking-[0.1em] text-muted">FAVORITE TEAMS</div>
          <div className="flex flex-col gap-2">
            {teams.map((team) => {
              const tc = TEAM_COLORS[team.abbr] ?? '#4d9fff'
              const card = (
                <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3 transition-colors hover:border-border2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-extrabold" style={{ background: `${tc}22`, color: tc }}>
                      {team.abbr}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-text">
                        <span className="uppercase text-muted">{team.sport}</span> {team.abbr}
                        {team.playingToday && <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[8px] font-bold text-accent">PLAYING TODAY</span>}
                      </div>
                      <div className="text-[10px] text-muted">{team.record ? `${team.record} record` : 'Record unavailable'}</div>
                      {tallies.get(`${team.sport}:${team.abbr}`) && (
                        <div className="mt-0.5 text-[10px] font-semibold text-text2">
                          Your bets: {recordText(tallies.get(`${team.sport}:${team.abbr}`)!)}{' '}
                          <span className={tallies.get(`${team.sport}:${team.abbr}`)!.profit >= 0 ? 'text-win' : 'text-loss'}>{profitText(tallies.get(`${team.sport}:${team.abbr}`)!.profit)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {team.gameHref && <span className="text-[10px] font-semibold text-accent">View game →</span>}
                    <FavoriteTeamStar sport={team.sport as 'mlb' | 'nfl' | 'nba' | 'nhl'} abbr={team.abbr} />
                  </div>
                </div>
              )
              return team.gameHref ? (
                <Link key={`${team.sport}-${team.abbr}`} href={team.gameHref}>
                  {card}
                </Link>
              ) : (
                <div key={`${team.sport}-${team.abbr}`}>{card}</div>
              )
            })}
          </div>
        </div>
      )}

      {players.length > 0 && (
        <div>
          <div className="mb-2 text-[10px] font-extrabold tracking-[0.1em] text-muted">FAVORITE PLAYERS</div>
          <div className="flex flex-col gap-2">
            {players.map((p) => (
              <Link key={p.slug} href={`/players/${p.slug}`} className="flex items-center justify-between rounded-xl border border-border bg-card p-3 transition-colors hover:border-border2">
                <div>
                  <div className="flex items-center gap-1 text-xs font-bold text-text">
                    {p.name}
                    <span className="rounded bg-card3 px-1 py-0.5 text-[8px] font-bold uppercase text-muted">{p.sport}</span>
                  </div>
                  <div className="text-[10px] text-muted">{p.team ?? 'Team unknown'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-xs font-extrabold text-accent">{p.statsAvailable ? (p.headlineStat ?? '—') : 'Unavailable'}</div>
                    <div className="text-[9px] text-muted">Season</div>
                  </div>
                  <FavoritePlayerStar sport={p.sport as 'mlb' | 'nfl' | 'nba' | 'nhl'} slug={p.slug} name={p.name} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
