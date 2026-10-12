import { createClient } from '@/lib/supabase/client'
import { DEFAULT_FAVORITES, type BetSport, type Favorites } from './types'

export async function fetchFavorites(userId: string): Promise<Favorites> {
  const supabase = createClient()
  const { data, error } = await supabase.from('users').select('favorites').eq('id', userId).single()

  if (error || !data?.favorites) {
    if (error) console.error('[account/favorites] fetchFavorites failed:', error.message)
    return DEFAULT_FAVORITES
  }

  const raw = data.favorites as Partial<Favorites>
  return { teams: raw.teams ?? [], players: raw.players ?? [] }
}

export async function saveFavorites(userId: string, favorites: Favorites): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('users').update({ favorites }).eq('id', userId)
  if (error) {
    console.error('[account/favorites] saveFavorites failed:', error.message)
    return false
  }
  return true
}

export function toggleTeam(favorites: Favorites, sport: BetSport, abbr: string): Favorites {
  const exists = favorites.teams.some((t) => t.sport === sport && t.abbr === abbr)
  return {
    ...favorites,
    teams: exists ? favorites.teams.filter((t) => !(t.sport === sport && t.abbr === abbr)) : [...favorites.teams, { sport, abbr }],
  }
}

export function togglePlayer(favorites: Favorites, sport: BetSport, slug: string, name: string): Favorites {
  const exists = favorites.players.some((p) => p.slug === slug)
  return {
    ...favorites,
    players: exists ? favorites.players.filter((p) => p.slug !== slug) : [...favorites.players, { sport, slug, name }],
  }
}
