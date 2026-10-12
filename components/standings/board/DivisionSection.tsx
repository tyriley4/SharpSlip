import type { CSSProperties } from 'react'
import type { TeamStatus } from '@/lib/standings/playoffs'
import type { SportStandings, StandingsRow } from '@/lib/standings/types'
import type { BetSport } from '@/lib/account/types'
import { TIER_CLASS, type GridTemplates, type StandingsColumn } from './columns'
import { TeamRow } from './TeamRow'

function divisionSummary(rows: StandingsRow[], data: SportStandings): string {
  const w = rows.reduce((s, r) => s + r.w, 0)
  const l = rows.reduce((s, r) => s + r.l, 0)
  const t = rows.reduce((s, r) => s + r.t, 0)
  const rec = data.tColumn ? `${w}-${l}-${t}` : `${w}-${l}`
  return `Combined ${rec}`
}

export function DivisionSection({
  division,
  rows,
  data,
  cols,
  templates,
  teamColors,
  statuses,
  highlight,
  onHighlight,
}: {
  division: string
  rows: StandingsRow[]
  data: SportStandings
  cols: StandingsColumn[]
  templates: GridTemplates
  teamColors: Record<string, string>
  statuses: Map<string, TeamStatus>
  highlight: string | null
  onHighlight: (key: string) => void
}) {
  const style = { ['--cols-base' as string]: templates.base, ['--cols-md' as string]: templates.md, ['--cols-lg' as string]: templates.lg } as CSSProperties

  return (
    <section className="overflow-clip rounded-[14px] border border-[#1F2229]" style={style}>
      <div
        className="flex items-center justify-between gap-3 border-l-[3px] border-accent px-4 py-3 shadow-[0_4px_14px_rgba(0,0,0,0.4)]"
        style={{ background: 'linear-gradient(90deg, #0E1014 0%, #111318 100%)' }}
      >
        <h3 className="text-[15px] font-extrabold text-white">{division}</h3>
        <span className="text-[11px] font-medium tabular-nums text-[#8B909A]">{divisionSummary(rows, data)}</span>
      </div>

      <div className="st-grid sticky top-[103px] z-10 h-7 border-b border-[#1F2229] bg-[#0E1014] pl-2.5 pr-1 lg:top-0">
        <div className="pl-1 text-[11px] md:pl-[18px] font-bold tracking-wide text-[#8B909A]">TEAM</div>
        {cols.map((c) => {
          const on = highlight === c.key
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onHighlight(c.key)}
              aria-pressed={on}
              title={`Highlight ${c.label}`}
              className={`${TIER_CLASS[c.tier]} items-center justify-center self-stretch text-[11px] font-bold tracking-wide transition-colors duration-150 ${
                on ? 'bg-accent/[0.18] text-white' : 'text-[#8B909A] hover:bg-white/[0.04] hover:text-[#C4C8D0]'
              }`}
            >
              {c.label}
            </button>
          )
        })}
        <div />
      </div>

      {rows.map((r) => (
        <TeamRow
          key={r.abbr}
          sport={data.sport as BetSport}
          row={r}
          teamColor={teamColors[r.abbr] ?? '#3B9EFF'}
          status={statuses.get(r.abbr)}
          cols={cols}
          highlight={highlight}
          leader={r.divRank === 1 && r.gp > 0}
        />
      ))}
    </section>
  )
}
