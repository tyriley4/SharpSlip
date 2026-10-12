'use client'

import { useAccountData } from '@/lib/account/AccountDataContext'
import type { BetSport } from '@/lib/account/types'
import { useAuth } from '@/lib/auth/AuthContext'

export function FavoriteTeamStar({ sport, abbr, className = '' }: { sport: BetSport; abbr: string; className?: string }) {
  const { user } = useAuth()
  const { isFavoriteTeam, toggleFavoriteTeam } = useAccountData()
  if (!user) return null
  const fav = isFavoriteTeam(sport, abbr)

  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleFavoriteTeam(sport, abbr)
      }}
      aria-label={fav ? `Unfavorite ${abbr}` : `Favorite ${abbr}`}
      className={`shrink-0 text-sm leading-none transition-colors ${fav ? 'text-warning' : 'text-muted hover:text-warning'} ${className}`}
    >
      {fav ? '★' : '☆'}
    </button>
  )
}

export function FavoritePlayerStar({ sport, slug, name, className = '' }: { sport: BetSport; slug: string; name: string; className?: string }) {
  const { user } = useAuth()
  const { isFavoritePlayer, toggleFavoritePlayer } = useAccountData()
  if (!user) return null
  const fav = isFavoritePlayer(slug)

  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleFavoritePlayer(sport, slug, name)
      }}
      aria-label={fav ? `Unfavorite ${name}` : `Favorite ${name}`}
      className={`shrink-0 text-xl leading-none transition-colors ${fav ? 'text-warning' : 'text-muted hover:text-warning'} ${className}`}
    >
      {fav ? '★' : '☆'}
    </button>
  )
}
