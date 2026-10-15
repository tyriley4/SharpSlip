'use client'

import { useEffect, useMemo, useState } from 'react'
import { DataUnavailable } from '@/components/ui/DataUnavailable'
import { CAREER_NOTE } from '@/lib/career/seasons'
import type { BettingSort, RankedRow, SampleMin } from '@/lib/betting/rank'
import type { BettingLeaderRow } from '@/lib/mlb/bettingLeaders'
import type { TrendQuery } from '@/lib/trend/types'
import { BettingControls } from './BettingControls'
import { BoardResults } from './BoardResults'
import { rowKey } from './format'
import type { TeamFilterValue } from './teamFilter'
import { boardRowsFromBetting, type BoardContext, type BoardRow } from './types'

/** The shape returned by useBettingRank<BettingLeaderRow>. */
interface Rank {
  rows: RankedRow<BettingLeaderRow>[]
  sort: BettingSort
  setSort: (s: BettingSort) => void
  minGames: SampleMin
  setMinGames: (n: SampleMin) => void
  appliedMin: SampleMin
  relaxed: boolean
}

const CONVICTION_CANDIDATES = 15

interface ConvictionResult {
  grade: string | null
  convictionScore: number
}

/** Conviction against tonight's matchup for the top hit-rate players, fetched only while the Conviction Score sort is on. */
function useBoardConviction(active: boolean, trend: TrendQuery, rows: RankedRow<BettingLeaderRow>[]) {
  const candidates = useMemo(() => rows.slice(0, CONVICTION_CANDIDATES), [rows])
  const key = active && trend.threshold !== undefined ? `${trend.sport}|${trend.sub}|${trend.category}|${trend.threshold}|${candidates.map((r) => rowKey(r)).join(',')}` : ''
  const [state, setState] = useState<{ key: string; results: Record<string, ConvictionResult | null> } | null>(null)

  useEffect(() => {
    if (!key || candidates.length === 0 || trend.threshold === undefined) return
    let cancelled = false
    const params = new URLSearchParams({
      sport: trend.sport,
      category: trend.category,
      threshold: String(trend.threshold),
      players: candidates.map((r) => `${r.name}~${r.team}`).join(','),
    })
    if (trend.sport === 'mlb' && trend.sub === 'Pitchers') params.set('pitching', '1')
    fetch(`/api/leaders-conviction?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
      .then((d: { results: Record<string, ConvictionResult | null> }) => {
        if (!cancelled) setState({ key, results: d.results })
      })
      .catch(() => {
        if (!cancelled) setState({ key, results: {} })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { loading: !!key && state?.key !== key, results: state?.key === key ? state.results : null, candidates }
}

/** "Prop Leaders" title, subtitle, career badge and the qualifying-players info chip. */
function BettingHeader({ count, appliedMin, career }: { count: number; appliedMin: SampleMin; career: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="section-header text-base text-text md:text-lg">🎯 Prop Leaders</h2>
          {career && <span className="rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-[10px] font-extrabold text-accent">Career</span>}
        </div>
        <p className="mt-0.5 pl-[13px] text-[11px] text-muted">Hit rates based on historical game logs</p>
        {career && <p className="mt-0.5 pl-[13px] text-[10px] text-muted">{CAREER_NOTE}</p>}
      </div>
      <span className="inline-flex w-fit items-center rounded-full border border-border bg-card2 px-2.5 py-1 text-[10px] font-medium text-muted">
        Based on {count} qualifying player{count === 1 ? '' : 's'} with {appliedMin === 0 ? 'any number of' : `${appliedMin}+`} games
      </span>
    </div>
  )
}

/** Attaches each player's grade (or why there is none) once convictions have loaded. */
function withConviction(rows: BoardRow[], results: Record<string, ConvictionResult | null> | null): BoardRow[] {
  if (!results) return rows
  return rows.map((r) => {
    const key = `${r.name}|${r.team}`
    if (!(key in results)) return r
    const c = results[key]
    return c ? { ...r, grade: c.grade, conviction: c.convictionScore, convictionNote: c.grade ? undefined : 'Insufficient data' } : { ...r, grade: null, convictionNote: 'No game today — season hit rate shown' }
  })
}

/**
 * Everything a Betting Stats board shares across sports, in a fixed order: header → time window →
 * category pills → threshold pills (+ average hit rate) → sort chips → results.
 */
export function BettingSection({
  rank,
  ctx,
  trend,
  windowBar,
  categoryPills,
  thresholdPills,
  loading,
  error,
  errorLabel,
  career,
  teamFilter,
  onClear,
}: {
  rank: Rank
  ctx: Omit<BoardContext, 'sortMode' | 'bestValueKey' | 'trend' | 'career' | 'betting'>
  trend: TrendQuery
  windowBar: React.ReactNode
  categoryPills: React.ReactNode
  thresholdPills: React.ReactNode
  loading: boolean
  error: boolean
  errorLabel: string
  career: boolean
  teamFilter: TeamFilterValue
  onClear?: () => void
}) {
  // Conviction is fetched for every player board (tonight's matchup evidence, not just the season rate); the Conviction Score
  // sort additionally re-orders the graded players by it.
  const convictionOn = !ctx.isTeamRows
  const [tonightOnly, setTonightOnly] = useState(false)
  const [tonight, setTonight] = useState<{ sport: string; teams: string[] } | null>(null)
  useEffect(() => {
    if (!tonightOnly || tonight?.sport === ctx.sport) return
    let cancelled = false
    fetch(`/api/teams-today?sport=${ctx.sport}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
      .then((d: { teams: string[] }) => !cancelled && setTonight({ sport: ctx.sport, teams: d.teams }))
      .catch(() => !cancelled && setTonight({ sport: ctx.sport, teams: [] }))
    return () => {
      cancelled = true
    }
  }, [tonightOnly, ctx.sport, tonight?.sport])
  const tonightSet = tonightOnly && tonight?.sport === ctx.sport ? new Set(tonight.teams) : null
  // "Tonight only" keeps the players whose team plays today and re-numbers them.
  const baseRows = useMemo(
    () => (tonightSet ? rank.rows.filter((r) => tonightSet.has(r.team)).map((r, i) => ({ ...r, rank: i + 1 })) : rank.rows),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rank.rows, tonight, tonightOnly]
  )
  const reorder = (rank.sort === 'Conviction Score' || !!tonightSet) && convictionOn
  const conv = useBoardConviction(convictionOn, trend, baseRows)

  // Conviction Score re-orders the graded top players by conviction; everyone else keeps hit-rate order after them.
  const rows = useMemo(() => {
    if (!reorder || !conv.results) return baseRows
    const scored = conv.candidates
      .map((r) => ({ r, c: conv.results![rowKey(r)] ?? null }))
      .sort((a, b) => (b.c?.grade ? 1 : 0) - (a.c?.grade ? 1 : 0) || (b.c?.convictionScore ?? 0) - (a.c?.convictionScore ?? 0) || b.r.hitRate - a.r.hitRate)
    const rest = baseRows.slice(conv.candidates.length)
    return [...scored.map((x) => x.r), ...rest].map((r, i) => ({ ...r, rank: i + 1 }))
  }, [reorder, conv.results, conv.candidates, baseRows])

  const avgHitRate = useMemo(() => {
    const wins = rows.reduce((s, r) => s + r.wins, 0)
    const games = rows.reduce((s, r) => s + r.gamesPlayed, 0)
    return games > 0 ? Math.round((wins / games) * 100) : null
  }, [rows])

  // "Best Value": the highest hit rate among players who clear the sample-size minimum.
  const best = useMemo(() => {
    if (rows.length === 0) return undefined
    return rows.reduce((a, b) => (b.hitRate > a.hitRate || (b.hitRate === a.hitRate && b.gamesPlayed > a.gamesPlayed) ? b : a))
  }, [rows])

  const fullCtx: BoardContext = {
    ...ctx,
    betting: true,
    sortMode: rank.sort,
    bestValueKey: best ? rowKey(best) : undefined,
    trend,
    career,
  }

  return (
    <div className="flex flex-col gap-4">
      <BettingHeader count={rows.length} appliedMin={rank.appliedMin} career={career} />
      {windowBar}
      <div className="flex flex-col gap-1.5">
        {categoryPills}
        {thresholdPills}
        {avgHitRate !== null && !loading && <p className="pl-1 text-[11px] text-muted">Avg hit rate: {avgHitRate}% across qualifying players</p>}
      </div>

      <BettingControls sort={rank.sort} onSort={rank.setSort} minGames={rank.minGames} onMinGames={rank.setMinGames} relaxed={rank.relaxed} teams={ctx.isTeamRows} tonightOnly={tonightOnly} onTonightOnly={setTonightOnly} />

      {tonightOnly && !tonightSet && !loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
          Finding tonight&apos;s games…
        </div>
      ) : loading || (reorder && conv.loading) ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
          {career ? 'Calculating career hit rates (this can take a moment)…' : 'Calculating hit rates…'}
        </div>
      ) : error ? (
        <DataUnavailable label={errorLabel} />
      ) : (
        <BoardResults rows={withConviction(boardRowsFromBetting(rows), convictionOn ? conv.results : null)} ctx={fullCtx} teamFilter={teamFilter} onClear={onClear} />
      )}
    </div>
  )
}
