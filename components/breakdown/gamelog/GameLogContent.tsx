import type { TeamSummary, LogTone } from '@/data/breakdown/summaryTypes'

const TONE_TEXT: Record<LogTone, string> = {
  positive: 'text-positive',
  negative: 'text-negative',
  warning: 'text-warning',
  accent: 'text-accent',
  neutral: 'text-muted',
}

function cellByKey(team: TeamSummary, row: (typeof team.log)[number], key: string) {
  const idx = team.logColumns.findIndex((c) => c.key === key)
  return idx >= 0 ? row.cells[idx] : undefined
}

function TeamLog({ team, teamColor }: { team: TeamSummary; teamColor: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[13px] font-black text-text">{team.abbr}</div>
          <div className="text-[9px] text-muted">Last {team.log.length} games</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-black" style={{ color: teamColor }}>
            {team.record}
          </div>
          <div className="text-[9px] text-muted">{team.winPct}% win rate</div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {team.log.map((row, i) => {
          const date = cellByKey(team, row, 'date')?.value ?? ''
          const opp = cellByKey(team, row, 'opp')?.value ?? ''
          const wl = cellByKey(team, row, 'wl')
          const venue = cellByKey(team, row, 'venue')?.value ?? ''
          const rs = cellByKey(team, row, 'rs')?.value ?? ''
          const ra = cellByKey(team, row, 'ra')?.value ?? ''
          const sp = cellByKey(team, row, 'sp')?.value ?? ''
          const ats = cellByKey(team, row, 'ats')
          const ou = cellByKey(team, row, 'ou')

          return (
            <div key={i} className="rounded-xl bg-card3 px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[12px] font-extrabold text-white ${
                    wl?.tone === 'positive' ? 'bg-positive' : 'bg-negative'
                  }`}
                >
                  {wl?.value ?? '-'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-bold text-text">
                    {venue === 'Away' || venue === '@' ? '@' : 'vs'} {opp}
                  </div>
                  <div className="text-[9px] text-muted">
                    {date} · SP {sp}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[13px] font-black text-text">
                    {rs}-{ra}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex gap-1.5">
                <div className="flex-1 rounded-lg bg-card2 py-1 text-center">
                  <span className="text-[8px] text-muted">ATS </span>
                  <span className={`text-[10px] font-bold ${ats?.tone ? TONE_TEXT[ats.tone] : 'text-text2'}`}>
                    {ats?.value ?? '--'}
                  </span>
                </div>
                <div className="flex-1 rounded-lg bg-card2 py-1 text-center">
                  <span className="text-[8px] text-muted">O/U </span>
                  <span className={`text-[10px] font-bold ${ou?.tone ? TONE_TEXT[ou.tone] : 'text-text2'}`}>
                    {ou?.value ?? '--'}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function GameLogContent({
  away,
  home,
  teamColors,
}: {
  away: TeamSummary
  home: TeamSummary
  teamColors: Record<string, string>
}) {
  return (
    <div className="flex flex-col gap-3 px-3.5 pt-3 md:px-8 md:pt-5">
      <div className="md:grid md:grid-cols-2 md:items-start md:gap-4">
        <TeamLog team={away} teamColor={teamColors[away.abbr] ?? '#4d9fff'} />
        <TeamLog team={home} teamColor={teamColors[home.abbr] ?? '#4d9fff'} />
      </div>
    </div>
  )
}
