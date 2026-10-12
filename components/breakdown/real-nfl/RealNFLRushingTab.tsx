'use client'

import { useEffect, useState } from 'react'
import { PlayerLink } from '@/components/players/PlayerLink'
import { NFL_TEAM_COLORS } from '@/data/nfl/teamColors'
import { formatNFLThreshold } from '@/lib/nfl/bettingStats'
import type { NFLRushingTabData } from '@/lib/nfl/rushingBreakdown'

function StatChip({ label, val }: { label: string; val: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-card3 p-2 text-center">
      <div className="mb-0.5 text-[9px] text-muted">{label}</div>
      <div className="text-[13px] font-black text-text">{val}</div>
    </div>
  )
}

function ThresholdRow({ label, rows }: { label: string; rows: { threshold: number; hitRate: number; wins: number; losses: number }[] }) {
  return (
    <div className="mb-2">
      <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rows.map((r) => {
          const tone = r.hitRate >= 65 ? 'text-positive' : r.hitRate < 45 ? 'text-negative' : 'text-text2'
          return (
            <div key={r.threshold} className="shrink-0 rounded-xl border border-border bg-card3 p-2 text-center" style={{ minWidth: 68 }}>
              <div className="text-[10px] font-bold text-muted">{formatNFLThreshold(r.threshold)}</div>
              <div className={`text-sm font-black ${tone}`}>{r.hitRate}%</div>
              <div className="text-[9px] text-muted">
                {r.wins}-{r.losses}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function RealNFLRushingTab({ gameId, awayAbbr, homeAbbr, apiBase = '/api/nfl-breakdown', teamColors = NFL_TEAM_COLORS, college = false }: { gameId: string; awayAbbr: string; homeAbbr: string; apiBase?: string; teamColors?: Record<string, string>; college?: boolean }) {
  const [team, setTeam] = useState<'away' | 'home'>('away')
  const [cache, setCache] = useState<Record<string, NFLRushingTabData>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const data = cache[team]

  useEffect(() => {
    if (cache[team]) return
    let cancelled = false
    setLoading(true)
    setError(false)

    fetch(`${apiBase}/rushing?gameId=${encodeURIComponent(gameId)}&team=${team}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((json: NFLRushingTabData) => {
        if (!cancelled) setCache((prev) => ({ ...prev, [team]: json }))
      })
      .catch((err) => {
        console.error('[RealNFLRushingTab] fetch failed', err)
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
          const tc = teamColors[sideAbbr] ?? '#4d9fff'
          return (
            <button
              key={side}
              onClick={() => setTeam(side)}
              className={`rounded-xl border-2 py-2.5 text-center text-[13px] font-bold ${active ? '' : 'border-border text-text2'}`}
              style={active ? { borderColor: tc, background: `${tc}22`, color: tc } : undefined}
            >
              🏈 {sideAbbr}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
          Loading {abbr} rushing…
        </div>
      ) : error || !data ? (
        <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">Rushing data unavailable.</div>
      ) : (
        <>
          {data.teamSummary && (
            <div className="grid grid-cols-4 gap-1.5">
              <StatChip label="Att" val={String(data.teamSummary.att)} />
              <StatChip label="Yds" val={String(data.teamSummary.yds)} />
              <StatChip label="YPC" val={data.teamSummary.ypc.toFixed(1)} />
              <StatChip label="Rank" val={`#${data.teamSummary.rankByYds}`} />
            </div>
          )}

          {data.players.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card py-8 text-center text-xs text-muted">No qualifying rushers found.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {data.players.map((card) => {
                const isOpen = expanded === card.player.playerId
                return (
                  <div key={card.player.playerId} className="rounded-xl border border-border bg-card p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <PlayerLink name={card.player.name} team={abbr} sport={college ? 'cfb' : undefined} className="text-[12px] font-bold text-text hover:text-accent hover:underline">
                        {card.player.name}
                      </PlayerLink>
                      <span className="rounded-md bg-card3 px-1.5 py-0.5 text-[9px] font-bold text-muted">{card.player.position}</span>
                    </div>
                    <div className="mb-2 grid grid-cols-4 gap-1.5">
                      <StatChip label="Att" val={String(card.player.season.att)} />
                      <StatChip label="Yds" val={String(card.player.season.rushYds)} />
                      <StatChip label="YPC" val={card.player.season.ypc.toFixed(1)} />
                      <StatChip label="TD" val={String(card.player.season.rushTd)} />
                    </div>
                    <div className="mb-2 grid grid-cols-2 gap-1.5">
                      {!college && <StatChip label="Targets" val={String(card.player.season.targets)} />}
                      <StatChip label="Rec Yds" val={String(card.player.season.recYds)} />
                    </div>
                    {card.advanced && (
                      <div className="mb-2 grid grid-cols-3 gap-1.5">
                        <StatChip label="Efficiency" val={card.advanced.efficiency?.toFixed(2) ?? '—'} />
                        <StatChip label="Exp. Rush Yds" val={card.advanced.expectedRushYards?.toFixed(0) ?? '—'} />
                        <StatChip label="RYOE" val={card.advanced.rushYardsOverExpected?.toFixed(0) ?? '—'} />
                      </div>
                    )}
                    <p className="mb-2 text-[9px] leading-relaxed text-muted">
                      Yards-before-contact and broken-tackles aren&apos;t in the free nflverse release — shown instead: real efficiency and
                      rush-yards-over-expected from Next Gen Stats.
                    </p>

                    <button onClick={() => setExpanded(isOpen ? null : card.player.playerId)} className="mb-2 text-[10px] font-bold text-accent">
                      {isOpen ? '▲ Hide' : '▼ Show'} last 5 games
                    </button>
                    {isOpen && (
                      <div className="mb-2 overflow-hidden rounded-lg border border-border">
                        {card.player.last5.map((g, i) => (
                          <div key={i} className={`grid grid-cols-4 gap-1 px-2 py-1.5 text-[10px] ${i < card.player.last5.length - 1 ? 'border-b border-border' : ''}`}>
                            <span className="text-text2">
                              {g.opp} W{g.week}
                            </span>
                            <span className="text-text">{g.att} att</span>
                            <span className="text-text">{g.rushYds} yds</span>
                            <span className="text-text">{g.rushTd} TD</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <ThresholdRow label="Rush Yards" rows={card.betting.rushYds} />
                    <ThresholdRow label="Anytime TD" rows={card.betting.anytimeTd} />
                    <ThresholdRow label="Receptions" rows={card.betting.receptions} />
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
