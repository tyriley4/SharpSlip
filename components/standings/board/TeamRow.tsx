import type { CSSProperties } from 'react'
import { FavoriteTeamStar } from '@/components/account/FavoriteStarButton'
import { readableTeamColor } from '@/components/leaders/board/theme'
import { TeamLink } from '@/components/teams/TeamLink'
import type { BetSport } from '@/lib/account/types'
import type { TeamStatus } from '@/lib/standings/playoffs'
import type { StandingsRow } from '@/lib/standings/types'
import { TIER_CLASS, type StandingsColumn } from './columns'
import { MagicBadge } from './MagicBadge'
import { StreakBadge } from './StreakBadge'

const DOT: Record<string, string> = { green: '#00E5A0', amber: '#FFB800' }

export function TeamCircle({ abbr, color, size = 36 }: { abbr: string; color: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-extrabold tracking-tight text-white ring-1 ring-white/15"
      style={{ width: size, height: size, background: color, fontSize: size >= 36 ? 13 : 11 }}
    >
      {abbr}
    </div>
  )
}

function Cell({ col, row, highlight }: { col: StandingsColumn; row: StandingsRow; highlight: string | null }) {
  const v = col.value(row)
  const on = highlight === col.key
  let content: React.ReactNode = v
  let color = col.prominent ? '#F0F2F5' : '#C4C8D0'
  if (col.kind === 'streak') content = <StreakBadge streak={v} />
  if (col.kind === 'win') color = '#F0F2F5'
  if (col.kind === 'loss') color = '#8B909A'
  if (col.key === 'gb' || col.key === 't') color = '#8B909A'
  if (col.key === 'pd' || col.key === 'rd' || col.key === 'diff') {
    if (v.startsWith('+')) color = '#00E5A0'
    else if (v.startsWith('-')) color = '#EF4444'
  }
  return (
    <div
      className={`${TIER_CLASS[col.tier]} row-span-2 flex-col self-stretch text-[13px] tabular-nums transition-colors duration-150 ${
        col.prominent ? 'font-extrabold' : 'font-semibold'
      } ${on ? 'bg-accent/[0.2]' : ''}`}
      style={{ color: on ? '#FFFFFF' : color }}
    >
      <div className="flex h-14 items-center justify-center">{content}</div>
    </div>
  )
}

export function TeamRow({
  row,
  teamColor,
  status,
  cols,
  highlight,
  leader,
  sport,
}: {
  sport: BetSport
  row: StandingsRow
  teamColor: string
  status: TeamStatus | undefined
  cols: StandingsColumn[]
  highlight: string | null
  leader: boolean
}) {
  const border = readableTeamColor(teamColor)
  const dot = status?.tone ? DOT[status.tone] : undefined
  const sub = [
    ...row.subline,
    ...(row.ats ? [{ key: 'ats', label: 'ATS', value: row.ats }] : []),
    ...(row.ou ? [{ key: 'ou', label: 'O/U', value: row.ou }] : []),
  ]

  return (
    <div className={`st-team ${leader ? 'leader' : ''}`} style={{ ['--tc' as string]: border } as CSSProperties}>
      <div className="st-grid pl-2.5 pr-1" style={{ gridTemplateRows: '56px auto' }}>
        <div className="flex min-w-0 items-center gap-2 md:gap-2.5">
          <span className="hidden h-2 w-2 shrink-0 rounded-full md:block" style={{ background: dot ?? 'transparent' }} aria-label={status?.label} />
          <div className="relative shrink-0">
            <TeamLink sport={sport} abbr={row.abbr} className="block rounded-full">
              <TeamCircle abbr={row.abbr} color={teamColor} />
            </TeamLink>
            {dot && <span className="absolute -left-1 top-0 h-2.5 w-2.5 rounded-full ring-2 ring-[#111318] md:hidden" style={{ background: dot }} />}
          </div>
          <div className="min-w-0 flex-1">
            <TeamLink sport={sport} abbr={row.abbr} className="block truncate text-sm font-bold leading-tight text-white hover:text-accent hover:underline">
              {row.name}
            </TeamLink>
            <div className="flex items-center gap-1.5">
              <span className="min-w-0 truncate text-[11px] leading-tight text-[#8B909A]">{row.city}</span>
              {leader && (
                <span className="shrink-0 rounded px-1 py-px text-[8px] font-extrabold tracking-wider" style={{ color: border, background: `color-mix(in srgb, ${border} 16%, transparent)` }}>
                  DIV LEADER
                </span>
              )}
              <MagicBadge magic={status?.magic ?? null} compact />
            </div>
          </div>
        </div>
        {cols.map((c) => (
          <Cell key={c.key} col={c} row={row} highlight={highlight} />
        ))}
        <div className="row-span-2 flex h-14 items-center justify-center">
          <FavoriteTeamStar sport={sport} abbr={row.abbr} />
        </div>
        {sub.length > 0 && (
          <div className="col-start-1 row-start-2 hidden flex-wrap items-center gap-x-3 gap-y-0.5 pb-1.5 pl-[62px] pr-2 text-[10px] text-[#8B909A] md:flex">
            {sub.map((s) => (
              <span key={s.key} className="tabular-nums">
                <span className="font-bold tracking-wide">{s.label}:</span> <span className="text-[#C4C8D0]">{s.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
