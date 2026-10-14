'use client'

import { trackEvent } from '@/lib/analytics/posthog'
import Link from 'next/link'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { impliedProb } from '@/lib/parlay/math'

export interface ParlayLeg {
  id: string
  sport: string
  label: string
  typeLabel: string
  oddsAmerican: number
  /** Estimated hit probability, 0-100. Falls back to the price's implied probability. */
  prob: number
  matchup?: string
  /** Stable key for the underlying line, used to avoid adding the same line twice. */
  lineId?: string
  grade?: string
  /** Sportsbook the price came from, when it's a real posted line. */
  book?: string
}

export type NewParlayLeg = Omit<ParlayLeg, 'id' | 'prob'> & { prob?: number }

interface ParlayContextValue {
  legs: ParlayLeg[]
  addLeg: (leg: NewParlayLeg, options?: { silent?: boolean; message?: string }) => void
  addLegs: (legs: NewParlayLeg[]) => void
  removeLeg: (id: string) => void
  removeByLineId: (lineId: string) => void
  hasLine: (lineId: string) => boolean
  clear: () => void
}

const ParlayContext = createContext<ParlayContextValue>({
  legs: [],
  addLeg: () => {},
  addLegs: () => {},
  removeLeg: () => {},
  removeByLineId: () => {},
  hasLine: () => false,
  clear: () => {},
})

const STORAGE_KEY = 'sharpslip-parlay-draft'

function normalize(raw: unknown): ParlayLeg[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((l): l is Partial<ParlayLeg> & { id: string; label: string } => !!l && typeof l === 'object' && 'id' in l && 'label' in l)
    .map((l) => {
      const odds = typeof l.oddsAmerican === 'number' ? l.oddsAmerican : -110
      return {
        id: l.id,
        sport: l.sport ?? 'mlb',
        label: l.label,
        typeLabel: l.typeLabel ?? '',
        oddsAmerican: odds,
        prob: typeof l.prob === 'number' ? l.prob : Math.round(impliedProb(odds) * 10) / 10,
        matchup: l.matchup,
        lineId: l.lineId,
        grade: l.grade,
        book: l.book,
      }
    })
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function ParlayProvider({ children }: { children: React.ReactNode }) {
  const [legs, setLegs] = useState<ParlayLeg[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setLegs(normalize(JSON.parse(raw)))
    } catch {
      // localStorage can throw or be unavailable (private browsing, etc.) — fine to just start empty.
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(legs))
    } catch {
      // Non-fatal — the draft just won't persist across reloads in this environment.
    }
  }, [legs, hydrated])

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }, [])

  function build(leg: NewParlayLeg): ParlayLeg {
    return {
      ...leg,
      id: makeId(),
      prob: leg.prob ?? Math.round(impliedProb(leg.oddsAmerican) * 10) / 10,
    }
  }

  function trackLeg(leg: NewParlayLeg) {
    const m = /(\d+(?:\.\d+)?)/.exec(leg.label)
    trackEvent('parlay_leg_added', { sport: leg.sport, betType: leg.typeLabel, threshold: m ? Number(m[1]) : null })
  }

  function addLeg(leg: NewParlayLeg, options?: { silent?: boolean; message?: string }) {
    trackLeg(leg)
    setLegs((prev) => {
      if (leg.lineId && prev.some((l) => l.lineId === leg.lineId)) return prev
      return [...prev, build(leg)]
    })
    if (!options?.silent) showToast(options?.message ?? 'Added to Parlay Builder')
  }

  function addLegs(newLegs: NewParlayLeg[]) {
    newLegs.forEach(trackLeg)
    setLegs((prev) => {
      const next = [...prev]
      for (const leg of newLegs) {
        if (leg.lineId && next.some((l) => l.lineId === leg.lineId)) continue
        next.push(build(leg))
      }
      return next
    })
    showToast(`Added ${newLegs.length} leg${newLegs.length !== 1 ? 's' : ''} to Parlay Builder`)
  }

  function removeLeg(id: string) {
    setLegs((prev) => prev.filter((l) => l.id !== id))
  }

  function removeByLineId(lineId: string) {
    setLegs((prev) => prev.filter((l) => l.lineId !== lineId))
  }

  function hasLine(lineId: string) {
    return legs.some((l) => l.lineId === lineId)
  }

  function clear() {
    setLegs([])
  }

  return (
    <ParlayContext.Provider value={{ legs, addLeg, addLegs, removeLeg, removeByLineId, hasLine, clear }}>
      {children}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 lg:bottom-8" role="status" aria-live="polite">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-accent/40 bg-card3 px-4 py-2 text-[12px] font-semibold text-text shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
            <span className="text-win">✓</span>
            {toast}
            <Link href="/parlay" className="text-accent hover:underline">
              View →
            </Link>
          </div>
        </div>
      )}
    </ParlayContext.Provider>
  )
}

export function useParlay() {
  return useContext(ParlayContext)
}
