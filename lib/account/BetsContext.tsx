'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { deleteBet, fetchBets } from './bets'
import type { Bet } from './types'

interface BetsContextValue {
  bets: Bet[]
  loading: boolean
  upsert: (bet: Bet) => void
  remove: (id: string) => Promise<boolean>
}

export const BetsContext = createContext<BetsContextValue>({ bets: [], loading: true, upsert: () => {}, remove: async () => false })

/** The signed-in user's bets, shared between the profile header's stats and the Bet Tracker tab. */
export function BetsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [bets, setBets] = useState<Bet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setBets([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchBets(user.id).then((data) => {
      if (!cancelled) {
        setBets(data)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [user])

  const upsert = useCallback((bet: Bet) => {
    setBets((prev) => (prev.some((b) => b.id === bet.id) ? prev.map((b) => (b.id === bet.id ? bet : b)) : [bet, ...prev]))
  }, [])

  const remove = useCallback(async (id: string) => {
    const ok = await deleteBet(id)
    if (ok) setBets((prev) => prev.filter((b) => b.id !== id))
    return ok
  }, [])

  return <BetsContext.Provider value={{ bets, loading, upsert, remove }}>{children}</BetsContext.Provider>
}

export function useBets() {
  return useContext(BetsContext)
}
