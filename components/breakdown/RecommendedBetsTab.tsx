'use client'

import { useEffect, useMemo, useState } from 'react'
import { BetCard } from '@/components/breakdown/BetCard'
import { PlayerLink } from '@/components/players/PlayerLink'
import { trackEvent } from '@/lib/analytics/posthog'
import type { BetCardData, RecommendedBets } from '@/lib/edges/recommended'
import type { Sport } from '@/lib/sport/SportContext'

type Load = { state: 'loading' } | { state: 'ready'; data: RecommendedBets } | { state: 'error' }

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="section-header mb-2 mt-1 text-sm text-text">{children}</h3>
}

const MARKET_ORDER = ['Moneyline', 'Spread', 'Run Line', 'Puck Line', 'Total']

/** Recommended Bets: the whole betting market for the game with graded evidence behind each bet. */
export function RecommendedBetsTab({ sport, gameId, awayAbbr, homeAbbr }: { sport: Sport; gameId: string; awayAbbr: string; homeAbbr: string }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    trackEvent('recommended_bets_tab_opened', { sport, gameId })
  }, [sport, gameId])

  useEffect(() => {
    const ctrl = new AbortController()
    setLoad({ state: 'loading' })
    fetch(`/api/recommended-bets?${new URLSearchParams({ sport, gameId, away: awayAbbr, home: homeAbbr }).toString()}`, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`)
        return r.json()
      })
      .then((data: RecommendedBets) => setLoad(data.unavailable ? { state: 'error' } : { state: 'ready', data }))
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') setLoad({ state: 'error' })
      })
    return () => ctrl.abort()
  }, [sport, gameId, awayAbbr, homeAbbr, nonce])

  const lines = useMemo(() => {
    if (load.state !== 'ready') return []
    const by = new Map<string, BetCardData[]>()
    for (const b of load.data.gameLines) by.set(b.market, [...(by.get(b.market) ?? []), b])
    return Array.from(by.entries()).sort((a, b) => MARKET_ORDER.indexOf(a[0]) - MARKET_ORDER.indexOf(b[0]))
  }, [load])

  return (
    <div className="flex flex-col gap-3 px-3.5 pt-3 md:px-0 md:pt-0">
      <p className="rounded-xl border border-border bg-card px-3 py-2 text-[10px] leading-snug text-muted">
        Grades based on statistical evidence and historical patterns. Not betting advice. All decisions are yours.
      </p>

      {load.state === 'loading' && (
        <div className="flex flex-col gap-2" aria-label="Loading recommended bets">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-[14px] border border-border bg-card" />
          ))}
        </div>
      )}

      {load.state === 'error' && (
        <div className="rounded-[14px] border border-border bg-card px-4 py-8 text-center text-xs text-muted">
          <div>Analysis unavailable right now.</div>
          <button onClick={() => setNonce((n) => n + 1)} className="mt-3 rounded-lg border border-border2 px-3 py-1.5 text-[11px] font-semibold text-text2 hover:border-accent hover:text-accent">
            Try again
          </button>
        </div>
      )}

      {load.state === 'ready' && (
        <>
          {load.data.note && <div className="rounded-xl border border-warning/25 bg-warning/[0.07] px-3 py-2 text-[11px] text-text2">{load.data.note}</div>}
          {load.data.priorSeasonOnly && (
            <div className="rounded-xl border border-border bg-card px-3 py-2 text-[11px] text-text2">Based on previous-season data — current-season trends will update automatically once games are played.</div>
          )}

          <div className="md:grid md:grid-cols-2 md:items-start md:gap-6">
            <div className="flex flex-col gap-2">
              <SectionTitle>Game Lines</SectionTitle>
              {lines.length === 0 ? (
                <div className="rounded-[14px] border border-border bg-card px-4 py-8 text-center text-xs text-muted">Lines are not available for this game yet.</div>
              ) : (
                lines.map(([market, bets]) => (
                  <div key={market} className="flex flex-col gap-2">
                    <div className="mt-1 text-[10px] font-extrabold tracking-[0.08em] text-muted">{market.toUpperCase()}</div>
                    {bets.map((b) => (
                      <BetCard key={b.id} bet={b} />
                    ))}
                  </div>
                ))
              )}
              <p className="text-[10px] leading-snug text-muted">{load.data.firstHalfNote}</p>
            </div>

            <div className="mt-3 flex flex-col gap-2 md:mt-0">
              <SectionTitle>Player Props</SectionTitle>
              {load.data.props.length === 0 ? (
                <div className="rounded-[14px] border border-border bg-card px-4 py-8 text-center text-xs text-muted">{load.data.propsNote ?? 'No player props are posted for this game.'}</div>
              ) : (
                load.data.props.map((group) => (
                  <div key={group.group} className="flex flex-col gap-2">
                    <div className="mt-1 text-[10px] font-extrabold tracking-[0.08em] text-muted">{group.group.toUpperCase()}</div>
                    {group.players.map((p) => (
                      <div key={p.name} className="flex flex-col gap-2">
                        <div className="flex items-baseline gap-1.5">
                          <PlayerLink name={p.name} team={p.team || undefined} sport={sport === 'cfb' || sport === 'cbb' ? sport : undefined} className="text-[13px] font-extrabold text-text hover:text-accent hover:underline">
                            {p.name}
                          </PlayerLink>
                          {p.team && <span className="text-[10px] font-semibold text-muted">{p.team}</span>}
                        </div>
                        {p.bets.map((b) => (
                          <BetCard key={b.id} bet={b} />
                        ))}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
