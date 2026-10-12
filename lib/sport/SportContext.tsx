'use client'

import { createContext, useContext, useState } from 'react'

/** Every sport the app covers: the four pro leagues plus college football and men's college basketball. */
export type Sport = 'mlb' | 'nfl' | 'cfb' | 'nba' | 'cbb' | 'nhl'

/** The four pro leagues, for features that only exist for them (scatter builder, trend lines). */
export type ProSport = 'mlb' | 'nfl' | 'nba' | 'nhl'
export const isProSport = (s: string): s is ProSport => s === 'mlb' || s === 'nfl' || s === 'nba' || s === 'nhl'

/** Display order everywhere sports are listed: CFB sits between NFL and NBA, CBB right after NBA. */
export const SPORTS: { id: Sport; icon: string; label: string }[] = [
  { id: 'mlb', icon: '⚾', label: 'MLB' },
  { id: 'nfl', icon: '🏈', label: 'NFL' },
  { id: 'cfb', icon: '🏈', label: 'CFB' },
  { id: 'nba', icon: '🏀', label: 'NBA' },
  { id: 'cbb', icon: '🏀', label: 'CBB' },
  { id: 'nhl', icon: '🏒', label: 'NHL' },
]

const SportContext = createContext<{
  sport: Sport
  setSport: (sport: Sport) => void
}>({ sport: 'mlb', setSport: () => {} })

export function SportProvider({ children }: { children: React.ReactNode }) {
  const [sport, setSport] = useState<Sport>('mlb')

  return <SportContext.Provider value={{ sport, setSport }}>{children}</SportContext.Provider>
}

export function useSport() {
  return useContext(SportContext)
}
