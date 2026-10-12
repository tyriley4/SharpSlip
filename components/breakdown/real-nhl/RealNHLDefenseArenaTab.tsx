'use client'

import { useEffect, useState } from 'react'
import { PlayerLink } from '@/components/players/PlayerLink'
import { NHL_TEAM_COLORS } from '@/data/nhl/teamColors'
import type { NHLDefenseArenaTabData } from '@/lib/nhl/defenseArenaBreakdown'

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function rankColor(rank: number): string {
  if (rank <= 8) return 'text-positive'
  if (rank <= 16) return 'text-accent'
  if (rank <= 24) return 'text-warning'
  return 'text-negative'
}

export function RealNHLDefenseArenaTab({ gameId, awayAbbr, homeAbbr }: { gameId: string; awayAbbr: string; homeAbbr: string }) {
  const [team, setTeam] = useState<'away' | 'home'>('away')
  const [cache, setCache] = useState<Record<string, NHLDefenseArenaTabData>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const data = cache[team]

  useEffect(() => {
    if (cache[team]) return
    let cancelled = false
    setLoading(true)
    setError(false)

    fetch(`/api/nhl-breakdown/defense-arena?gameId=${encodeURIComponent(gameId)}&team=${team}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((json: NHLDefenseArenaTabData) => {
        if (!cancelled) setCache((prev) => ({ ...prev, [team]: json }))
      })
      .catch((err) => {
        console.error('[RealNHLDefenseArenaTab] fetch failed', err)
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
    <div className="flex flex-col gap-4 px-3.5 pt-3 md:px-8 md:pt-5">
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
              🛡 {sideAbbr}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
          Loading {abbr} defense &amp; arena…
        </div>
      ) : error || !data ? (
        <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">Data unavailable.</div>
      ) : (
        <>
          <div>
            <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">DEFENSE</div>
            {data.defense?.gaaRank && (
              <div className="mb-2 rounded-xl border border-border bg-card p-3 text-center">
                <div className="text-[9px] text-muted">Goals Against / Game</div>
                <div className="text-lg font-black text-text">{data.defense.gaaRank.value.toFixed(2)}</div>
                <div className={`text-[10px] font-bold ${rankColor(data.defense.gaaRank.rank)}`}>#{data.defense.gaaRank.rank} of 32</div>
              </div>
            )}

            {data.defense && data.defense.last5.length > 0 && (
              <div className="mb-3 overflow-hidden rounded-xl border border-border bg-card">
                <div className="grid grid-cols-3 gap-1 border-b border-border bg-card3 px-2.5 py-2 text-[9px] font-bold text-muted">
                  <span>DATE</span>
                  <span>OPP</span>
                  <span className="text-center">OPP GOALS</span>
                </div>
                {data.defense.last5.map((g, i) => (
                  <div key={i} className={`grid grid-cols-3 gap-1 px-2.5 py-2 text-[11px] ${i < data.defense!.last5.length - 1 ? 'border-b border-border' : ''}`}>
                    <span className="text-text2">{shortDate(g.date)}</span>
                    <span className="text-text2">{g.opp}</span>
                    <span className="text-center text-text">{g.oppGoals}</span>
                  </div>
                ))}
              </div>
            )}

            {data.defense && data.defense.keyDefenders.length > 0 && (
              <div>
                <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">KEY DEFENSEMEN TO WATCH</div>
                <div className="flex flex-col gap-1.5">
                  {data.defense.keyDefenders.map((d) => (
                    <div key={d.playerId} className="flex items-center justify-between rounded-xl border border-border bg-card p-2.5">
                      <PlayerLink name={d.name} team={abbr} className="text-[11px] font-semibold text-text hover:text-accent hover:underline">
                        {d.name}
                      </PlayerLink>
                      <span className="text-[10px] font-semibold text-text2">{d.plusMinus >= 0 ? `+${d.plusMinus}` : d.plusMinus}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {data.arena && (
            <div>
              <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">ARENA</div>
              <div className="rounded-2xl border border-border bg-card p-3.5">
                {data.arena.arena ? (
                  <>
                    <div className="mb-1 text-base font-black text-text">{data.arena.arena.name}</div>
                    <div className="mb-3 text-[11px] text-muted">
                      {data.arena.arena.city} · Capacity {data.arena.arena.capacity.toLocaleString()}
                    </div>
                  </>
                ) : (
                  <div className="mb-3 text-[11px] text-muted">Venue data unavailable.</div>
                )}
                <div className="mb-3 rounded-[10px] border border-accent/20 bg-accent/[0.06] p-2.5 text-center text-[11px] text-accent">
                  Indoor arena — weather neutral
                </div>
                {data.arena.homeIceRating !== null && (
                  <div className="mb-3">
                    <div className="mb-1 flex items-center justify-between text-[10px]">
                      <span className="text-muted">Home Ice Rating (home point%)</span>
                      <span className="font-bold text-text">{data.arena.homeIceRating.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-border2">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${data.arena.homeIceRating}%` }} />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-1.5">
                  {data.arena.homePuckLine && (
                    <div className="rounded-[10px] bg-card3 p-2 text-center">
                      <div className="text-[9px] text-muted">Home Puck Line</div>
                      <div className="text-[12px] font-bold text-text">
                        {data.arena.homePuckLine.wins}-{data.arena.homePuckLine.losses} ({data.arena.homePuckLine.pct}%)
                      </div>
                    </div>
                  )}
                  {data.arena.overUnderAtArena && (
                    <div className="rounded-[10px] bg-card3 p-2 text-center">
                      <div className="text-[9px] text-muted">O/U at Arena</div>
                      <div className="text-[12px] font-bold text-text">
                        {data.arena.overUnderAtArena.wins}-{data.arena.overUnderAtArena.losses} ({data.arena.overUnderAtArena.pct}%)
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
