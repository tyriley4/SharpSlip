'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import { CAREER_STAT_NOTE } from '@/lib/career/seasons'
import { BoardEmpty } from './BoardEmpty'
import { useBoardMode } from './boardMode'
import { LeaderRows } from './LeaderRows'
import { SpotlightCards } from './SpotlightCards'
import { applyTeamFilter, EMPTY_TEAM_FILTER, teamFilterActive, type TeamFilterValue } from './teamFilter'
import { TopTenChart } from './TopTenChart'
import { BOARD_LIMIT, type BoardContext, type BoardRow } from './types'
import { ViewModeToggle } from './ViewModeToggle'

const TrendChart = dynamic(() => import('./TrendChart').then((m) => m.TrendChart), {
  ssr: false,
  loading: () => <div className="h-[260px] rounded-xl border border-border bg-card2" />,
})

/**
 * Spotlight cards (top 3), then either the ranked list (Board view) or the Top-10 bar chart plus
 * rolling trend lines (Chart view). Shared by every sport's board.
 */
export function BoardResults({
  rows,
  ctx,
  onClear,
  teamFilter = EMPTY_TEAM_FILTER,
}: {
  rows: BoardRow[]
  ctx: BoardContext
  onClear?: () => void
  teamFilter?: TeamFilterValue
}) {
  const [mode, setMode] = useBoardMode()
  const visible = useMemo(() => applyTeamFilter(rows, teamFilter).slice(0, BOARD_LIMIT), [rows, teamFilter])
  const shownCtx = useMemo<BoardContext>(() => ({ ...ctx, selectedPlayers: teamFilter.players }), [ctx, teamFilter.players])

  if (visible.length === 0) {
    return <BoardEmpty icon={ctx.sportIcon} onClear={onClear} />
  }

  // Trend lines follow the players you picked, or the top five otherwise.
  const picked = visible.filter((r) => teamFilter.players.includes(r.name))
  const trendRows = (picked.length > 0 ? picked : visible).slice(0, 5)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-muted">{teamFilterActive(teamFilter) ? `${teamFilter.team} players` : `Top ${visible.length}`}</span>
          {ctx.career && !ctx.betting && (
            <>
              <span className="rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-[10px] font-extrabold text-accent">Career</span>
              <span className="text-[10px] text-muted">{CAREER_STAT_NOTE}</span>
            </>
          )}
        </div>
        <ViewModeToggle value={mode} onChange={setMode} />
      </div>

      <SpotlightCards rows={visible} ctx={shownCtx} />

      {mode === 'board' ? (
        visible.length > 3 && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <h3 className="section-header text-sm text-text md:text-base">Leaderboard</h3>
              <span className="text-[11px] text-muted">Top {visible.length}</span>
            </div>
            <LeaderRows rows={visible} ctx={shownCtx} />
          </div>
        )
      ) : (
        <>
          <TopTenChart rows={visible} ctx={shownCtx} />
          {ctx.trend && <TrendChart query={ctx.trend} players={trendRows.map((r) => ({ name: r.name, team: r.team }))} career={ctx.career} />}
        </>
      )}
    </div>
  )
}
