'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { fetchFavorites, saveFavorites, toggleTeam, togglePlayer } from './favorites'
import { fetchSettings, saveSettings } from './settings'
import { DEFAULT_FAVORITES, DEFAULT_SETTINGS, type BetSport, type Favorites, type UserSettings } from './types'

interface AccountDataContextValue {
  settings: UserSettings
  favorites: Favorites
  loading: boolean
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>
  toggleFavoriteTeam: (sport: BetSport, abbr: string) => Promise<void>
  toggleFavoritePlayer: (sport: BetSport, slug: string, name: string) => Promise<void>
  isFavoriteTeam: (sport: BetSport, abbr: string) => boolean
  isFavoritePlayer: (slug: string) => boolean
}

const AccountDataContext = createContext<AccountDataContextValue>({
  settings: DEFAULT_SETTINGS,
  favorites: DEFAULT_FAVORITES,
  loading: true,
  updateSettings: async () => {},
  toggleFavoriteTeam: async () => {},
  toggleFavoritePlayer: async () => {},
  isFavoriteTeam: () => false,
  isFavoritePlayer: () => false,
})

export function AccountDataProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [favorites, setFavorites] = useState<Favorites>(DEFAULT_FAVORITES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      setSettings(DEFAULT_SETTINGS)
      setFavorites(DEFAULT_FAVORITES)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    Promise.all([fetchSettings(user.id), fetchFavorites(user.id)])
      .then(([s, f]) => {
        if (cancelled) return
        setSettings(s)
        setFavorites(f)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  async function updateSettings(patch: Partial<UserSettings>) {
    const next = { ...settings, ...patch, notifications: { ...settings.notifications, ...patch.notifications } }
    setSettings(next)
    if (user) await saveSettings(user.id, next)
  }

  async function toggleFavoriteTeam(sport: BetSport, abbr: string) {
    const next = toggleTeam(favorites, sport, abbr)
    setFavorites(next)
    if (user) await saveFavorites(user.id, next)
  }

  async function toggleFavoritePlayer(sport: BetSport, slug: string, name: string) {
    const next = togglePlayer(favorites, sport, slug, name)
    setFavorites(next)
    if (user) await saveFavorites(user.id, next)
  }

  function isFavoriteTeam(sport: BetSport, abbr: string) {
    return favorites.teams.some((t) => t.sport === sport && t.abbr === abbr)
  }

  function isFavoritePlayer(slug: string) {
    return favorites.players.some((p) => p.slug === slug)
  }

  return (
    <AccountDataContext.Provider
      value={{ settings, favorites, loading, updateSettings, toggleFavoriteTeam, toggleFavoritePlayer, isFavoriteTeam, isFavoritePlayer }}
    >
      {children}
    </AccountDataContext.Provider>
  )
}

export function useAccountData() {
  return useContext(AccountDataContext)
}
