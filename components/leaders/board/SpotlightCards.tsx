import { PlayerLink } from '@/components/players/PlayerLink'
import { TeamLink } from '@/components/teams/TeamLink'
import { bettingDisplay, isDimmed, isSelected, rowKey, seasonCompare, WHITE } from './format'
import { BestValueBadge } from './LeaderRows'
import { RANK_STYLES, readableTeamColor } from './theme'
import type { BoardContext, BoardRow } from './types'

function Dots({ last5, color }: { last5: boolean[]; color: string }) {
  return (
    <div className="flex gap-1" aria-label="Last 5 games">
      {last5.map((hit, i) => (
        <span key={i} className="h-2 w-2 rounded-full border" style={hit ? { background: color, borderColor: color } : { background: 'transparent', borderColor: '#2A2D35' }} />
      ))}
    </div>
  )
}

function SpotlightCard({ row, index, ctx }: { row: BoardRow; index: number; ctx: BoardContext }) {
  const tc = readableTeamColor(ctx.teamColors[row.team] ?? '#3B9EFF')
  const rank = RANK_STYLES[index]
  const bet = ctx.betting && row.hitRate !== undefined ? bettingDisplay(row, ctx.sortMode ?? 'Hit Rate') : null
  const dimmed = isDimmed(ctx, row)
  const selected = isSelected(ctx, row)
  const isBest = ctx.bestValueKey === rowKey(row)

  return (
    <div
      className={`flex h-[200px] w-[160px] shrink-0 flex-col rounded-[14px] border p-3 transition-opacity md:w-auto md:max-w-[250px] md:flex-1 ${selected ? 'border-accent' : 'border-border'} ${dimmed ? 'opacity-35' : ''}`}
      style={{
        background: `linear-gradient(135deg, ${tc}14 0%, #111318 70%)`,
        borderLeft: `3px solid ${tc}`,
        boxShadow: `0 0 20px ${tc}15`,
      }}
    >
      <div className="flex items-center justify-between gap-1">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
          style={{ color: rank.color, background: `${rank.color}1F`, boxShadow: index === 0 ? `0 0 10px ${rank.glow}` : undefined }}
        >
          {rank.label}
        </span>
        {isBest ? <BestValueBadge /> : row.hot && <span className="text-[11px] font-bold text-win">↑</span>}
      </div>

      <div className="mt-2 min-w-0">
        {ctx.isTeamRows ? (
          <TeamLink sport={ctx.sport} abbr={row.team} className="block truncate text-[14px] font-extrabold leading-tight text-text hover:text-accent hover:underline">
            {row.name}
          </TeamLink>
        ) : (
          <PlayerLink name={row.name} team={row.team} sport={ctx.sport === 'cfb' || ctx.sport === 'cbb' ? ctx.sport : undefined} className="block truncate text-[14px] font-extrabold leading-tight text-text hover:text-accent hover:underline">
            {row.name}
          </PlayerLink>
        )}
        {!ctx.isTeamRows && (
          <TeamLink sport={ctx.sport} abbr={row.team} className="mt-1 inline-block hover:brightness-125">
            <span className="inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${tc}22`, color: tc }}>
              {row.team}
            </span>
          </TeamLink>
        )}
      </div>

      <div className="mt-auto">
        <div className="stat-featured leading-none" style={{ fontSize: bet && bet.value.length > 6 ? '2rem' : '2.5rem', color: bet?.color ?? WHITE }}>
          {bet ? bet.value : row.value}
        </div>
        <div className="mt-1 text-[10px] font-semibold text-muted">{ctx.betting ? ctx.thresholdLabel ?? ctx.statLabel : ctx.statLabel}</div>
        {bet && <div className="text-[10px] text-text2">{bet.secondary}</div>}
        {ctx.betting && (() => {
          const c = seasonCompare(row)
          return c ? (
            <div className="text-[9px] leading-tight text-muted">
              {c.text}
              {c.flag && <span className={`ml-1 font-bold ${c.flag === 'hot' ? 'text-positive' : 'text-negative'}`}>{c.flag === 'hot' ? '↑ running hot' : '↓ running cold'} {c.delta > 0 ? '+' : ''}{c.delta}</span>}
            </div>
          ) : null
        })()}
        {ctx.betting && row.convictionNote === 'No game today — season hit rate shown' && <div className="text-[9px] text-muted">{row.convictionNote}</div>}
        {ctx.betting && row.grade && ctx.sortMode !== 'Conviction Score' && <div className="text-[9px] font-bold text-accent">Tonight&apos;s conviction: {row.grade}</div>}
        {row.last5 && row.last5.length > 0 && (
          <div className="mt-1.5">
            <Dots last5={row.last5} color={tc} />
          </div>
        )}
      </div>
    </div>
  )
}

export function SpotlightCards({ rows, ctx }: { rows: BoardRow[]; ctx: BoardContext }) {
  const top = rows.slice(0, 3)
  if (top.length === 0) return null
  return (
    <div className="-mx-3.5 flex gap-3 overflow-x-auto px-3.5 pb-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
      {top.map((r, i) => (
        <SpotlightCard key={`${r.name}-${r.team}`} row={r} index={i} ctx={ctx} />
      ))}
    </div>
  )
}
