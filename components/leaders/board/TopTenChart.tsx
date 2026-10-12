import { PlayerLink } from '@/components/players/PlayerLink'
import { TeamLink } from '@/components/teams/TeamLink'
import type { BettingSort } from '@/lib/betting/rank'
import { bettingDisplay, isDimmed, WHITE } from './format'
import { hitRateColor, readableTeamColor } from './theme'
import type { BoardContext, BoardRow } from './types'

/** Betting bars: hit rate % by default, win count for W-L Record, dollars of profit for Most Profitable. */
function bettingWidths(rows: BoardRow[], mode: BettingSort): number[] {
  if (mode === 'W-L Record') {
    const max = Math.max(...rows.map((r) => r.wins ?? 0), 1)
    return rows.map((r) => Math.max(3, ((r.wins ?? 0) / max) * 100))
  }
  if (mode === 'Most Profitable') {
    const max = Math.max(...rows.map((r) => r.profit ?? 0), 1)
    return rows.map((r) => Math.max(3, (Math.max(r.profit ?? 0, 0) / max) * 100))
  }
  return rows.map((r) => Math.max(2, Math.min(100, r.hitRate ?? r.numeric ?? 0)))
}

/**
 * Bar lengths are proportional to the stat; for lower-is-better stats (ERA, WHIP, goals against…)
 * the ranking already puts the smallest value first, so lengths are inverted to keep the leader longest.
 */
function barWidths(rows: BoardRow[], ctx: BoardContext): number[] {
  if (ctx.betting) return bettingWidths(rows, ctx.sortMode ?? 'Hit Rate')
  const nums = rows.map((r) => r.numeric)
  if (nums.some((n) => n === null)) return rows.map((_, i) => 100 - i * 6)
  const values = nums as number[]
  const lowerIsBetter = values.length > 1 && values[0] < values[values.length - 1]
  // Score where higher always means a longer bar.
  const scores = values.map((v) => (lowerIsBetter ? -v : v))
  const max = Math.max(...scores)
  const min = Math.min(...scores)
  const span = max - min
  const magnitude = Math.max(Math.abs(max), Math.abs(min), 0.0001)
  // When the leaders are bunched together (e.g. .316 vs .287), zero-based bars look identical, so
  // stretch the visible range — every bar still carries its exact value label.
  if (lowerIsBetter || span / magnitude < 0.25) {
    return scores.map((s) => (span === 0 ? 100 : 40 + 60 * ((s - min) / span)))
  }
  return values.map((v) => Math.max(4, (v / Math.max(...values, 0.0001)) * 100))
}

export function TopTenChart({ rows, ctx }: { rows: BoardRow[]; ctx: BoardContext }) {
  const top = rows.slice(0, 10)
  if (top.length < 2) return null
  const widths = barWidths(top, ctx)

  return (
    <div className="rounded-xl border border-border bg-card2 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="section-header text-sm text-text md:text-base">Top 10 — {ctx.betting ? ctx.thresholdLabel ?? ctx.statLabel : ctx.statLabel}</h3>
      </div>
      <div className="flex flex-col gap-1.5">
        {top.map((r, i) => {
          const tc = readableTeamColor(ctx.teamColors[r.team] ?? '#3B9EFF')
          const barBase = ctx.betting && r.hitRate !== undefined ? hitRateColor(r.hitRate) : tc
          const bet = ctx.betting && r.hitRate !== undefined ? bettingDisplay(r, ctx.sortMode ?? 'Hit Rate') : null
          return (
            <div key={`${r.name}-${r.team}`} className={`flex items-center gap-2.5 transition-opacity ${isDimmed(ctx, r) ? 'opacity-35' : ''}`}>
              <div className="w-[96px] shrink-0 truncate text-[11px] font-semibold text-text2 md:w-[120px] md:text-xs">
                {ctx.isTeamRows ? (
                  <TeamLink sport={ctx.sport} abbr={r.team} className="hover:text-accent hover:underline">
                    {r.name}
                  </TeamLink>
                ) : (
                  <PlayerLink name={r.name} team={r.team} sport={ctx.sport === 'cfb' || ctx.sport === 'cbb' ? ctx.sport : undefined} className="hover:text-accent hover:underline">
                    {r.name}
                  </PlayerLink>
                )}
              </div>
              <div className="relative h-6 flex-1 overflow-hidden rounded bg-card">
                <div
                  className="bar-grow absolute inset-y-0 left-0 rounded"
                  style={{
                    width: `${widths[i]}%`,
                    background: `linear-gradient(180deg, ${barBase}E6 0%, ${barBase}A6 100%)`,
                    animationDelay: `${i * 50}ms`,
                  }}
                />
              </div>
              <div className="stat-number w-[56px] shrink-0 text-right text-xs" style={{ color: bet?.color ?? WHITE }}>
                {bet ? bet.value : r.value}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
