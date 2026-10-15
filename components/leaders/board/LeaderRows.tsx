import type { CSSProperties } from 'react'
import { PlayerLink } from '@/components/players/PlayerLink'
import { TeamLink } from '@/components/teams/TeamLink'
import { bettingDisplay, GREEN, isDimmed, isSelected, RED, rowKey, seasonCompare, WHITE } from './format'
import { currentStreak, POSITION_COLORS, positionBadge, readableTeamColor } from './theme'
import type { BoardContext, BoardRow } from './types'

function Dots({ last5 }: { last5: boolean[] }) {
  return (
    <div className="hidden shrink-0 gap-1 sm:flex" aria-label="Last 5 games">
      {last5.map((hit, i) => (
        <span key={i} className="h-2 w-2 rounded-full" style={{ background: hit ? GREEN : RED }} />
      ))}
    </div>
  )
}

export function BestValueBadge() {
  return (
    <span
      className="shrink-0 rounded-full border border-[#FFD700]/40 bg-[#FFD700]/15 px-1.5 py-px text-[9px] font-extrabold text-[#FFD700]"
      title="Highest hit rate among players who meet the sample-size minimum"
    >
      ⭐ Best Value
    </span>
  )
}

function Row({ row, index, ctx }: { row: BoardRow; index: number; ctx: BoardContext }) {
  const tc = readableTeamColor(ctx.teamColors[row.team] ?? '#3B9EFF')
  const badge = positionBadge(ctx.sub)
  const badgeColor = POSITION_COLORS[ctx.sub] ?? '#8B909A'
  const streak = row.last5 ? currentStreak(row.last5) : 0
  const hot = row.hot || streak >= 4
  const bg = index % 2 === 0 ? 'bg-card' : 'bg-card2'
  const dimmed = isDimmed(ctx, row)
  const selected = isSelected(ctx, row)
  const bet = ctx.betting && row.hitRate !== undefined ? bettingDisplay(row, ctx.sortMode ?? 'Hit Rate') : null

  return (
    <div
      className={`board-row flex h-[52px] items-center gap-2.5 px-3 transition-opacity ${bg} ${dimmed ? 'opacity-35' : ''}`}
      style={{ ['--tc' as string]: tc, ...(selected ? { boxShadow: 'inset 0 0 0 1.5px #3B9EFF', background: 'rgba(59,158,255,0.08)' } : {}) } as CSSProperties}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
          row.rank <= 5 ? 'bg-border2 text-text' : 'bg-card3 text-muted'
        }`}
      >
        {row.rank}
      </div>

      {ctx.isTeamRows && (
        <TeamLink
          sport={ctx.sport}
          abbr={row.team}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold hover:brightness-125"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: `${tc}22`, color: tc, border: `1px solid ${tc}66` }}>
            {row.team}
          </span>
        </TeamLink>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {ctx.isTeamRows ? (
            <TeamLink sport={ctx.sport} abbr={row.team} className="truncate text-[13px] font-bold text-text hover:text-accent hover:underline">
              {row.name}
            </TeamLink>
          ) : (
            <PlayerLink name={row.name} team={row.team} sport={ctx.sport === 'cfb' || ctx.sport === 'cbb' ? ctx.sport : undefined} className="truncate text-[13px] font-bold text-text hover:underline">
              {row.name}
            </PlayerLink>
          )}
          {hot && <span className="shrink-0 text-[11px]">🔥</span>}
          {ctx.bestValueKey === rowKey(row) && <BestValueBadge />}
        </div>
        {!ctx.isTeamRows && (
          <div className="mt-0.5 flex items-center gap-1.5">
            {badge && (
              <span className="rounded px-1 py-px text-[8px] font-extrabold tracking-wide" style={{ background: `${badgeColor}22`, color: badgeColor }}>
                {badge}
              </span>
            )}
            <TeamLink sport={ctx.sport} abbr={row.team} className="text-[10px] font-bold hover:underline">
              <span style={{ color: tc }}>{row.team}</span>
            </TeamLink>
          </div>
        )}
      </div>

      {row.last5 && row.last5.length > 0 && <Dots last5={row.last5} />}

      <div className="shrink-0 text-right">
        <div className="stat-number text-[1.1rem] leading-tight" style={{ color: bet?.color ?? WHITE }}>
          {bet ? bet.value : row.value}
        </div>
        {bet && <div className="text-[10px] leading-tight text-muted">{bet.secondary}</div>}
        {ctx.betting && (() => {
          const c = seasonCompare(row)
          return c ? (
            <div className="text-[9px] leading-tight text-muted">
              {c.text}
              {c.flag && <span className={`ml-1 font-bold ${c.flag === 'hot' ? 'text-positive' : 'text-negative'}`}>{c.flag === 'hot' ? '↑ running hot' : '↓ running cold'} {c.delta > 0 ? '+' : ''}{c.delta}</span>}
            </div>
          ) : null
        })()}
        {ctx.betting && row.convictionNote === 'No game today — season hit rate shown' && <div className="max-w-[150px] text-[9px] leading-tight text-muted">{row.convictionNote}</div>}
        {ctx.betting && row.grade && ctx.sortMode !== 'Conviction Score' && <div className="text-[9px] font-bold leading-tight text-accent">Tonight&apos;s conviction: {row.grade}</div>}
      </div>
    </div>
  )
}

export function LeaderRows({ rows, ctx, startAt = 3 }: { rows: BoardRow[]; ctx: BoardContext; startAt?: number }) {
  const list = rows.slice(startAt)
  if (list.length === 0) return null
  return (
    <div className="overflow-hidden rounded-[14px] border border-border">
      {list.map((r, i) => (
        <Row key={`${r.name}-${r.team}`} row={r} index={i} ctx={ctx} />
      ))}
    </div>
  )
}
