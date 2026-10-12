'use client'

import { useEffect, useState } from 'react'
import { PlayerLink } from '@/components/players/PlayerLink'
import { PillTabs, SegmentTabs } from '@/components/ui/PillTabs'
import { NFL_TEAM_COLORS } from '@/data/nfl/teamColors'
import { formatNFLThreshold } from '@/lib/nfl/bettingStats'
import type { NFLPassingTabQB } from '@/lib/nfl/passingBreakdown'

const SUB_TABS = ['Overview', 'Advanced', 'Last 5 Games']

function ratingColor(r: number, college = false): string {
  // College passer efficiency runs on a wider scale than the NFL's passer rating.
  const [good, ok] = college ? [140, 115] : [100, 85]
  if (r >= good) return 'text-positive'
  if (r >= ok) return 'text-warning'
  return 'text-negative'
}

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
    <div className="mb-3">
      <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rows.map((r) => {
          const tone = r.hitRate >= 65 ? 'text-positive' : r.hitRate < 45 ? 'text-negative' : 'text-text2'
          return (
            <div key={r.threshold} className="shrink-0 rounded-xl border border-border bg-card3 p-2 text-center" style={{ minWidth: 72 }}>
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

export function RealNFLPassingTab({ gameId, awayAbbr, homeAbbr, apiBase = '/api/nfl-breakdown', teamColors = NFL_TEAM_COLORS, college = false }: { gameId: string; awayAbbr: string; homeAbbr: string; apiBase?: string; teamColors?: Record<string, string>; college?: boolean }) {
  const [team, setTeam] = useState<'away' | 'home'>('away')
  const [view, setView] = useState<'Game Stats' | 'Betting Stats'>('Game Stats')
  const [subTab, setSubTab] = useState('Overview')
  const [cache, setCache] = useState<Record<string, NFLPassingTabQB>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const data = cache[team]

  useEffect(() => {
    if (cache[team]) return
    let cancelled = false
    setLoading(true)
    setError(false)

    fetch(`${apiBase}/passing?gameId=${encodeURIComponent(gameId)}&team=${team}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((json: NFLPassingTabQB) => {
        if (!cancelled) setCache((prev) => ({ ...prev, [team]: json }))
      })
      .catch((err) => {
        console.error('[RealNFLPassingTab] fetch failed', err)
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
              🏈 {sideAbbr} QB
            </button>
          )
        })}
      </div>

      <SegmentTabs options={['Game Stats', 'Betting Stats']} active={view} onChange={(v) => setView(v as 'Game Stats' | 'Betting Stats')} />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
          Loading {abbr} QB…
        </div>
      ) : error || !data ? (
        <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">Passing data unavailable.</div>
      ) : !data.stats ? (
        <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">No QB stats found for {abbr}.</div>
      ) : view === 'Game Stats' ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <PlayerLink name={data.stats.name} team={abbr} sport={college ? 'cfb' : undefined} className="text-sm font-black text-text hover:text-accent hover:underline">
              {data.stats.name}
            </PlayerLink>
          </div>

          <PillTabs options={SUB_TABS} active={subTab} onChange={setSubTab} />

          {subTab === 'Overview' && (
            <div className="flex flex-col gap-3">
              <div className={`grid grid-cols-3 gap-1.5 ${college ? 'md:grid-cols-5' : 'md:grid-cols-6'}`}>
                <StatChip label="Pass Yds" val={String(data.stats.season.yds)} />
                <StatChip label="TD" val={String(data.stats.season.td)} />
                <StatChip label="INT" val={String(data.stats.season.int)} />
                <StatChip label="Comp%" val={`${data.stats.season.compPct}%`} />
                <StatChip label={college ? 'Efficiency' : 'Rating'} val={data.stats.season.rating.toFixed(1)} />
                {!college && <StatChip label="Sacks" val={String(data.stats.season.sacks)} />}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <StatChip label="Rush Yds" val={String(data.stats.season.rushYds)} />
                <StatChip label="Rush TD" val={String(data.stats.season.rushTd)} />
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-muted">Home / Away Pass Yds per Game</div>
                <div className="text-sm font-bold text-text">
                  {data.homeAway.home?.yds ?? '—'} / {data.homeAway.away?.yds ?? '—'}
                </div>
              </div>
            </div>
          )}

          {subTab === 'Advanced' && (
            <div className="flex flex-col gap-3">
              {!data.advanced ? (
                <div className="rounded-2xl border border-border bg-card py-8 text-center text-xs text-muted">{college ? 'Next Gen-style advanced passing metrics (CPOE, air yards, time to throw) are only published for the NFL.' : 'Advanced data unavailable.'}</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
                    <StatChip label="Air Yds/Att" val={data.advanced.airYardsPerAttempt?.toFixed(1) ?? '—'} />
                    <StatChip label="CPOE" val={data.advanced.cpoe !== null ? `${data.advanced.cpoe >= 0 ? '+' : ''}${data.advanced.cpoe.toFixed(1)}%` : '—'} />
                    <StatChip label="Aggressiveness" val={data.advanced.aggressiveness !== null ? `${data.advanced.aggressiveness.toFixed(1)}%` : '—'} />
                    <StatChip label="Time to Throw" val={data.advanced.timeToThrow !== null ? `${data.advanced.timeToThrow.toFixed(2)}s` : '—'} />
                  </div>
                  <p className="text-[10px] leading-relaxed text-muted">
                    Yards-after-catch-per-completion and under-pressure completion% aren&apos;t split out in nflverse&apos;s free Next Gen
                    Stats release, so they&apos;re omitted here.
                  </p>
                </>
              )}
            </div>
          )}

          {subTab === 'Last 5 Games' && (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="grid grid-cols-8 gap-1 border-b border-border bg-card3 px-2.5 py-2 text-[9px] font-bold text-muted">
                <span>OPP</span>
                <span>WK</span>
                <span className="text-center">COMP</span>
                <span className="text-center">YDS</span>
                <span className="text-center">TD</span>
                <span className="text-center">INT</span>
                <span className="text-center">{college ? 'EFF' : 'RATING'}</span>
                <span className="text-center">RES</span>
              </div>
              {data.stats.last5.map((g, i) => (
                <div key={i} className={`grid grid-cols-8 gap-1 px-2.5 py-2 text-[11px] ${i < data.stats!.last5.length - 1 ? 'border-b border-border' : ''}`}>
                  <span className="text-text2">{g.opp}</span>
                  <span className="text-text2">{g.week}</span>
                  <span className="text-center text-text">
                    {g.comp}/{g.att}
                  </span>
                  <span className="text-center text-text">{g.yds}</span>
                  <span className="text-center text-text">{g.td}</span>
                  <span className="text-center text-text">{g.int}</span>
                  <span className={`text-center font-bold ${ratingColor(g.rating, college)}`}>{g.rating}</span>
                  <span className={`text-center font-bold ${g.result === 'W' ? 'text-positive' : g.result === 'L' ? 'text-negative' : 'text-muted'}`}>
                    {g.result ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : !data.betting ? (
        <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">Betting stats unavailable.</div>
      ) : (
        <div className="flex flex-col gap-1">
          <ThresholdRow label={`Pass Yards (${data.betting.gamesPlayed}G sample)`} rows={data.betting.passYds} />
          <ThresholdRow label="TD Passes" rows={data.betting.tds} />
          <ThresholdRow label="Interceptions" rows={data.betting.ints} />
          <ThresholdRow label="Completions" rows={data.betting.completions} />
        </div>
      )}
    </div>
  )
}
