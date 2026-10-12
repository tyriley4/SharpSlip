'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { calculateCareerHitRate, compareRates, type CareerGame, type CareerHitRate, type CareerTrend } from '@/lib/props/careerHitRates'
import type { CareerSport } from '@/lib/props/careerLogs'

export interface CareerParams {
  sport: CareerSport
  playerId: string
  group?: 'hitting' | 'pitching'
  goalie?: boolean
}

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; games: CareerGame[] }

const url = (p: CareerParams, scope: 'season' | 'career') =>
  `/api/player-career?${new URLSearchParams({ sport: p.sport, playerId: p.playerId, group: p.group ?? 'hitting', goalie: String(!!p.goalie), scope }).toString()}`

/** Fetches a multi-season log once; failures degrade to an error state (never thrown). */
function useLog(p: CareerParams, scope: 'season' | 'career', enabled = true): Load {
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const key = `${p.sport}|${p.playerId}|${p.group}|${p.goalie}|${scope}`
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setLoad({ state: 'loading' })
    fetch(url(p, scope))
      .then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`)
        return r.json()
      })
      .then((d: { games: CareerGame[] }) => !cancelled && setLoad({ state: 'ready', games: d.games }))
      .catch((err) => {
        console.warn('[career] fetch failed', err)
        if (!cancelled) setLoad({ state: 'error' })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])
  return load
}

interface Ctx {
  career: Load
  /** Present when the page has no season endpoint of its own (NFL): the in-progress season's games. */
  season: Load | null
}
const CareerContext = createContext<Ctx>({ career: { state: 'error' }, season: null })

/** One career fetch per player page, shared by every prop card. Season data elsewhere on the page never waits on it. */
export function CareerProvider({ params, withSeason, children }: { params: CareerParams; withSeason?: boolean; children: React.ReactNode }) {
  const career = useLog(params, 'career')
  const season = useLog(params, 'season', !!withSeason)
  const value = useMemo(() => ({ career, season: withSeason ? season : null }), [career, season, withSeason])
  return <CareerContext.Provider value={value}>{children}</CareerContext.Provider>
}

export const useCareer = () => useContext(CareerContext)

/** Season hit-rate summary computed from raw games (used where the page has no season endpoint). */
export function seasonFromGames(games: CareerGame[], category: string, threshold: number) {
  const r = calculateCareerHitRate(games, category, threshold)
  const [wins, losses] = r.record.split('-').map(Number)
  return { hitRate: r.hitRate, wins, losses, gamesPlayed: r.gamesPlayed }
}

export function rateTone(hitRate: number): { text: string } {
  if (hitRate >= 65) return { text: 'text-positive' }
  if (hitRate < 45) return { text: 'text-negative' }
  return { text: 'text-text2' }
}

const TREND_UI: Record<CareerTrend, { arrow: string; label: string; cls: string }> = {
  up: { arrow: '↑', label: 'Above career avg', cls: 'text-positive' },
  down: { arrow: '↓', label: 'Below career avg', cls: 'text-negative' },
  stable: { arrow: '→', label: 'Consistent', cls: 'text-muted' },
}

export function TrendBadge({ trend }: { trend: CareerTrend }) {
  const t = TREND_UI[trend]
  return (
    <div className={`flex flex-col items-center justify-center px-1 text-center ${t.cls}`}>
      <span className="text-lg font-black leading-none">{t.arrow}</span>
      <span className="mt-0.5 text-[9px] font-bold leading-tight">{t.label}</span>
    </div>
  )
}

export interface SeasonStats {
  hitRate: number
  wins: number
  losses: number
  gamesPlayed: number
}

/** This-season and career columns with the trend between them. */
export function SeasonVsCareer({ season, category, threshold }: { season: SeasonStats; category: string; threshold: number }) {
  const { career } = useCareer()
  const careerRate = useMemo<CareerHitRate | null>(() => (career.state === 'ready' ? calculateCareerHitRate(career.games, category, threshold) : null), [career, category, threshold])
  const sTone = rateTone(season.hitRate)

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <div>
        <div className="text-[9px] font-bold uppercase tracking-wide text-muted">This Season</div>
        <div className={`stat-number text-2xl font-black md:text-3xl ${sTone.text}`}>{season.hitRate}%</div>
        <div className="text-[11px] font-semibold text-text2">
          {season.wins}-{season.losses}
        </div>
        <div className="text-[10px] text-muted">({season.gamesPlayed} games)</div>
      </div>

      {career.state === 'ready' && careerRate && careerRate.gamesPlayed > 0 ? <TrendBadge trend={compareRates(season.hitRate, careerRate.hitRate)} /> : <span className="w-12" />}

      <div className="text-right">
        <div className="text-[9px] font-bold uppercase tracking-wide text-muted">Career</div>
        {career.state === 'loading' ? (
          <div className="flex flex-col items-end gap-1.5" aria-label="Loading career data">
            <div className="h-7 w-16 animate-pulse rounded bg-border2" />
            <div className="h-3 w-10 animate-pulse rounded bg-border2" />
            <div className="h-2.5 w-24 animate-pulse rounded bg-border2" />
          </div>
        ) : career.state === 'error' || !careerRate || careerRate.gamesPlayed === 0 ? (
          <div className="py-2 text-[11px] text-muted">Career data unavailable</div>
        ) : (
          <>
            <div className={`stat-number text-xl font-black md:text-2xl ${rateTone(careerRate.hitRate).text}`}>{careerRate.hitRate}%</div>
            <div className="text-[11px] font-semibold text-text2">{careerRate.record}</div>
            <div className="text-[10px] text-muted">
              ({careerRate.gamesPlayed} games • {careerRate.seasonsCount} season{careerRate.seasonsCount === 1 ? '' : 's'})
            </div>
          </>
        )}
      </div>
    </div>
  )
}
