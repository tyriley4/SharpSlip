'use client'

import { useMemo } from 'react'
import { DataUnavailable } from '@/components/ui/DataUnavailable'
import { CAREER_NOTE } from '@/lib/career/seasons'
import type { BettingSort, RankedRow, SampleMin } from '@/lib/betting/rank'
import type { BettingLeaderRow } from '@/lib/mlb/bettingLeaders'
import type { TrendQuery } from '@/lib/trend/types'
import { BettingControls } from './BettingControls'
import { BoardResults } from './BoardResults'
import { rowKey } from './format'
import type { TeamFilterValue } from './teamFilter'
import { boardRowsFromBetting, type BoardContext } from './types'

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
  const rows = rank.rows

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

      <BettingControls sort={rank.sort} onSort={rank.setSort} minGames={rank.minGames} onMinGames={rank.setMinGames} relaxed={rank.relaxed} />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
          {career ? 'Calculating career hit rates (this can take a moment)…' : 'Calculating hit rates…'}
        </div>
      ) : error ? (
        <DataUnavailable label={errorLabel} />
      ) : (
        <BoardResults rows={boardRowsFromBetting(rows)} ctx={fullCtx} teamFilter={teamFilter} onClear={onClear} />
      )}
    </div>
  )
}
