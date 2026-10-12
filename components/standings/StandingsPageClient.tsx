'use client'

import { AppShell } from '@/components/layout/AppShell'
import { StandingsBoard } from '@/components/standings/board/StandingsBoard'
import { DataUnavailable } from '@/components/ui/DataUnavailable'
import { NflSeasonNote } from '@/components/ui/NflSeasonNote'
import { MLB_TEAM_COLORS } from '@/data/mlb/teamColors'
import { NBA_TEAM_COLORS } from '@/data/nba/teamColors'
import { NFL_TEAM_COLORS } from '@/data/nfl/teamColors'
import { NHL_TEAM_COLORS } from '@/data/nhl/teamColors'
import { CollegeStandingsView } from '@/components/standings/CollegeStandingsView'
import type { CollegeStandingsData } from '@/lib/college/standings'
import { useSport } from '@/lib/sport/SportContext'
import type { Sport } from '@/lib/sport/SportContext'
import type { SportStandings } from '@/lib/standings/types'

const COLORS: Record<Sport, Record<string, string>> = {
  mlb: MLB_TEAM_COLORS,
  nfl: NFL_TEAM_COLORS,
  nba: NBA_TEAM_COLORS,
  nhl: NHL_TEAM_COLORS,
  cfb: {},
  cbb: {},
}

const LABELS: Record<Sport, string> = { mlb: 'MLB', nfl: 'NFL', cfb: 'CFB', nba: 'NBA', cbb: 'CBB', nhl: 'NHL' }

export function StandingsPageClient({
  standings,
  nflSeason,
  nflDataUpdating,
  nbaSeason,
  nhlSeason,
  college,
}: {
  standings: Record<Sport, SportStandings | null>
  nflSeason: number
  nflDataUpdating: boolean
  nbaSeason: string
  nhlSeason: string
  college: { cfb: CollegeStandingsData | null; cbb: CollegeStandingsData | null }
}) {
  const { sport } = useSport()
  if (sport === 'cfb' || sport === 'cbb') {
    const c = college[sport]
    return (
      <AppShell>
        <div className="flex flex-col gap-3 px-3.5 pt-1 md:px-0 md:pt-0">{c ? <CollegeStandingsView key={sport} data={c} sport={sport} /> : <DataUnavailable label={`${LABELS[sport]} standings`} />}</div>
      </AppShell>
    )
  }
  const data = standings[sport]
  const empty = !data || data.rows.length === 0

  const note =
    sport === 'nfl' ? (
      <NflSeasonNote season={nflSeason} updating={nflDataUpdating} />
    ) : sport === 'nhl' ? (
      <div className="rounded-xl border border-accent/25 bg-accent/[0.06] px-3.5 py-2.5 text-[11px] leading-relaxed text-text2">
        Showing live {nhlSeason} season standings. Updates automatically as games are played.
      </div>
    ) : sport === 'nba' ? (
      <div className="rounded-xl border border-accent/25 bg-accent/[0.06] px-3.5 py-2.5 text-[11px] leading-relaxed text-text2">
        Showing final {nbaSeason} season standings. The next NBA season&apos;s data will update automatically once it tips off.
      </div>
    ) : null

  return (
    <AppShell>
      <div className="flex flex-col gap-3 px-3.5 pt-1 md:px-0 md:pt-0">
        {note}
        {empty || !data ? <DataUnavailable label={`${LABELS[sport]} standings`} /> : <StandingsBoard key={sport} data={data} teamColors={COLORS[sport]} />}
      </div>
    </AppShell>
  )
}
