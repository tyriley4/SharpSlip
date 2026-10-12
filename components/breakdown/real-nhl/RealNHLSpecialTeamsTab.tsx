'use client'

import { useEffect, useState } from 'react'
import { NHL_TEAM_COLORS } from '@/data/nhl/teamColors'
import type { NHLSpecialTeamsData } from '@/lib/nhl/specialTeamsBreakdown'

export function RealNHLSpecialTeamsTab({ gameId, awayAbbr, homeAbbr }: { gameId: string; awayAbbr: string; homeAbbr: string }) {
  const [team, setTeam] = useState<'away' | 'home'>('away')
  const [cache, setCache] = useState<Record<string, NHLSpecialTeamsData>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const data = cache[team]

  useEffect(() => {
    if (cache[team]) return
    let cancelled = false
    setLoading(true)
    setError(false)

    fetch(`/api/nhl-breakdown/special-teams?gameId=${encodeURIComponent(gameId)}&team=${team}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((json: NHLSpecialTeamsData) => {
        if (!cancelled) setCache((prev) => ({ ...prev, [team]: json }))
      })
      .catch((err) => {
        console.error('[RealNHLSpecialTeamsTab] fetch failed', err)
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, gameId])

  const abbr = team === 'away' ? awayAbbr : homeAbbr

  return (
    <div className="flex flex-col gap-3 px-3.5 pt-3 md:px-8 md:pt-5">
      <div className="grid grid-cols-2 gap-1.5">
        {(['away', 'home'] as const).map((side) => {
          const sideAbbr = side === 'away' ? awayAbbr : homeAbbr
          const active = team === side
          const tc = NHL_TEAM_COLORS[sideAbbr] ?? '#4d9fff'
          return (
            <button
              key={side}
              onClick={() => setTeam(side)}
              className={`rounded-xl border-2 py-2.5 text-center text-[13px] font-bold ${active ? '' : 'border-border text-text2'}`}
              style={active ? { borderColor: tc, background: `${tc}22`, color: tc } : undefined}
            >
              ⚡ {sideAbbr}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
          Loading {abbr} special teams…
        </div>
      ) : error || !data ? (
        <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">Special teams data unavailable.</div>
      ) : (
        <>
          <div>
            <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">POWER PLAY</div>
            <div className="rounded-2xl border border-border bg-card p-3.5 text-center">
              <div className="text-[9px] text-muted">PP%</div>
              <div className="text-lg font-black text-text">{(data.ppPct * 100).toFixed(1)}%</div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">PENALTY KILL</div>
            <div className="rounded-2xl border border-border bg-card p-3.5 text-center">
              <div className="text-[9px] text-muted">PK%</div>
              <div className="text-lg font-black text-text">{(data.pkPct * 100).toFixed(1)}%</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <div className="rounded-[10px] border border-border bg-card3 p-2 text-center">
              <div className="text-[9px] text-muted">Faceoff%</div>
              <div className="text-[13px] font-black text-text">{(data.faceoffWinPct * 100).toFixed(1)}%</div>
            </div>
            <div className="rounded-[10px] border border-border bg-card3 p-2 text-center">
              <div className="text-[9px] text-muted">GPG</div>
              <div className="text-[13px] font-black text-text">{data.goalsForPerGame.toFixed(1)}</div>
            </div>
            <div className="rounded-[10px] border border-border bg-card3 p-2 text-center">
              <div className="text-[9px] text-muted">GA/G</div>
              <div className="text-[13px] font-black text-text">{data.goalsAgainstPerGame.toFixed(1)}</div>
            </div>
          </div>

          <p className="text-[10px] leading-relaxed text-muted">
            The free NHL data source only exposes season-level special-teams aggregates — per-game power-play opportunity counts, PP/PK
            time-on-ice splits, and 5v5 Corsi require parsing raw play-by-play data, which isn&apos;t available here.
          </p>
        </>
      )}
    </div>
  )
}
