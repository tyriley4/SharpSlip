'use client'

import { useEffect, useState } from 'react'
import { PlayerLink } from '@/components/players/PlayerLink'
import { NFL_TEAM_COLORS } from '@/data/nfl/teamColors'
import { formatNFLThreshold } from '@/lib/nfl/bettingStats'
import type { NFLDefenseTabData } from '@/lib/nfl/defenseBreakdown'

function rankColor(rank: number): string {
  if (rank === 0) return 'text-muted'
  if (rank <= 8) return 'text-positive'
  if (rank <= 16) return 'text-accent'
  if (rank <= 24) return 'text-warning'
  return 'text-negative'
}

function RankStat({ label, value, rank, of = 32 }: { label: string; value: string; rank: number; of?: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <div className="mb-0.5 text-[9px] text-muted">{label}</div>
      <div className="text-sm font-black text-text">{value}</div>
      {rank > 0 && <div className={`text-[10px] font-bold ${rankColor(rank)}`}>#{rank} of {of}</div>}
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

export function RealNFLDefenseTab({ gameId, awayAbbr, homeAbbr, apiBase = '/api/nfl-breakdown', teamColors = NFL_TEAM_COLORS, college = false }: { gameId: string; awayAbbr: string; homeAbbr: string; apiBase?: string; teamColors?: Record<string, string>; college?: boolean }) {
  const [team, setTeam] = useState<'away' | 'home'>('away')
  const [cache, setCache] = useState<Record<string, NFLDefenseTabData>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const data = cache[team]
  const nationalOf = college ? ((data as { nationalOf?: number | null } | undefined)?.nationalOf ?? 138) : 32

  useEffect(() => {
    if (cache[team]) return
    let cancelled = false
    setLoading(true)
    setError(false)

    fetch(`${apiBase}/defense?gameId=${encodeURIComponent(gameId)}&team=${team}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((json: NFLDefenseTabData) => {
        if (!cancelled) setCache((prev) => ({ ...prev, [team]: json }))
      })
      .catch((err) => {
        console.error('[RealNFLDefenseTab] fetch failed', err)
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
              🛡 {sideAbbr} Defense
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
          Loading {abbr} defense…
        </div>
      ) : error || !data || !data.stats ? (
        <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">Defense data unavailable.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {data.ranks?.pointsAllowedPerGame && <RankStat label="Pts Allowed/G" value={data.ranks.pointsAllowedPerGame.value.toFixed(1)} rank={data.ranks.pointsAllowedPerGame.rank} of={nationalOf} />}
            {data.ranks?.passYdsAllowedPerGame && <RankStat label="Pass Yds Allowed/G" value={data.ranks.passYdsAllowedPerGame.value.toFixed(1)} rank={data.ranks.passYdsAllowedPerGame.rank} of={nationalOf} />}
            {data.ranks?.rushYdsAllowedPerGame && <RankStat label="Rush Yds Allowed/G" value={data.ranks.rushYdsAllowedPerGame.value.toFixed(1)} rank={data.ranks.rushYdsAllowedPerGame.rank} of={nationalOf} />}
            {data.ranks?.sacks && <RankStat label="Sacks" value={String(data.ranks.sacks.value)} rank={data.ranks.sacks.rank} of={nationalOf} />}
            {data.ranks?.turnoversForced && <RankStat label="TOs Forced/G" value={data.ranks.turnoversForced.value.toFixed(2)} rank={data.ranks.turnoversForced.rank} of={nationalOf} />}
            {data.ranks?.interceptions && <RankStat label="Interceptions" value={String(data.ranks.interceptions.value)} rank={data.ranks.interceptions.rank} of={nationalOf} />}
            {data.ranks?.tacklesForLoss && <RankStat label="Tackles for Loss" value={String(data.ranks.tacklesForLoss.value)} rank={data.ranks.tacklesForLoss.rank} of={nationalOf} />}
          </div>
          <p className="text-[9px] leading-relaxed text-muted">
            {college
              ? 'National ranks are among all FBS teams. 3rd-down stop%, red-zone defense% and blitz rate aren’t in ESPN’s box scores, so they’re omitted rather than estimated.'
              : '3rd-down stop%, red-zone defense%, and blitz rate% require full play-by-play parsing, which isn’t practical from the free season-summary CSVs — omitted rather than estimated.'}
          </p>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="grid grid-cols-5 gap-1 border-b border-border bg-card3 px-2.5 py-2 text-[9px] font-bold text-muted">
              <span>OPP</span>
              <span className="text-center">PTS</span>
              <span className="text-center">SACKS</span>
              <span className="text-center">TOs</span>
              <span className="text-center">WK</span>
            </div>
            {data.last5.map((g, i) => (
              <div key={i} className={`grid grid-cols-5 gap-1 px-2.5 py-2 text-[11px] ${i < data.last5.length - 1 ? 'border-b border-border' : ''}`}>
                <span className="text-text2">{g.opp}</span>
                <span className="text-center text-text">{g.ptsAllowed}</span>
                <span className="text-center text-text">{g.sacks}</span>
                <span className="text-center text-text">{g.turnovers}</span>
                <span className="text-center text-muted">{g.week}</span>
              </div>
            ))}
          </div>

          {college && 'vsRanked' in data && (data as { vsRanked: { w: number; l: number; papg: number | null; games: number } }).vsRanked.games > 0 && (
            <div className="rounded-xl border border-border bg-card3 p-2.5 text-center">
              <div className="text-[9px] text-muted">Record vs ranked opponents</div>
              <div className="text-[12px] font-black text-text">
                {(data as { vsRanked: { w: number; l: number } }).vsRanked.w}-{(data as { vsRanked: { w: number; l: number } }).vsRanked.l}
                {(data as { vsRanked: { papg: number | null } }).vsRanked.papg !== null && <span className="ml-1.5 font-semibold text-muted">allowing {(data as { vsRanked: { papg: number | null } }).vsRanked.papg} pts/g</span>}
              </div>
            </div>
          )}

          {data.keyMatchup && (
            <div className="rounded-xl border border-accent/25 bg-accent/[0.06] p-3">
              <div className="mb-1 text-[9px] font-extrabold tracking-[0.08em] text-accent">KEY MATCHUP TONIGHT</div>
              <div className="mb-1 text-[12px] font-bold text-text">{data.keyMatchup.title}</div>
              <p className="text-[10px] leading-relaxed text-text2">{data.keyMatchup.detail}</p>
            </div>
          )}

          {data.topDefenders.length > 0 && (
            <div>
              <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">KEY DEFENDERS TO WATCH</div>
              <div className="flex flex-col gap-1.5">
                {data.topDefenders.map((d, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-card p-2.5">
                    <div className="flex items-center gap-1.5">
                      <PlayerLink name={d.name} team={abbr} sport={college ? 'cfb' : undefined} className="text-[11px] font-semibold text-text hover:text-accent hover:underline">
                        {d.name}
                      </PlayerLink>
                      <span className="rounded-md bg-card3 px-1.5 py-0.5 text-[9px] font-bold text-muted">{d.position}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-text2">
                      {d.sacks} SK · {d.interceptions} INT
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <ThresholdRow label="Sacks" rows={data.betting.sacks} />
          <ThresholdRow label="Points Allowed" rows={data.betting.pointsAllowed} />
          <ThresholdRow label="Turnovers Forced" rows={data.betting.turnoversForced} />
          {data.betting.ats && (
            <div className="rounded-xl border border-border bg-card3 p-2.5 text-center">
              <div className="text-[9px] text-muted">ATS This Season</div>
              <div className="text-[12px] font-black text-text">
                {data.betting.ats.wins}-{data.betting.ats.losses} ({data.betting.ats.pct}%)
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
