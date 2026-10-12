import { StandingsPageClient } from '@/components/standings/StandingsPageClient'
import { getMlbTeamsIndex, getStandings, getTeamStats } from '@/lib/mlb/api'
import { getCollegeStandings } from '@/lib/college/standings'
import { getNBAStandings } from '@/lib/nba/api'
import { NBA_CURRENT_SEASON } from '@/lib/nba/divisions'
import { getActiveNFLSeason, getCurrentNFLSeason, getNFLSchedule } from '@/lib/nfl/api'
import { getNHLStandings } from '@/lib/nhl/api'
import { NHL_CURRENT_SEASON_LABEL } from '@/lib/nhl/divisions'
import { buildMlbStandings } from '@/lib/standings/mlb'
import { buildNbaStandings } from '@/lib/standings/nba'
import { buildNflStandings } from '@/lib/standings/nfl'
import { buildNhlStandings } from '@/lib/standings/nhl'

export const revalidate = 3600

export default async function StandingsPage() {
  const nflSeason = await getActiveNFLSeason()
  const [rawStandings, teams, pitching, rawNflSchedule, nbaStandings, nhlStandings, cfbStandings, cbbStandings] = await Promise.all([
    getStandings(),
    getMlbTeamsIndex(),
    getTeamStats('pitching'),
    getNFLSchedule(nflSeason),
    getNBAStandings(),
    getNHLStandings(),
    getCollegeStandings('cfb').catch((err) => {
      console.error('[standings] CFB failed', err)
      return null
    }),
    getCollegeStandings('cbb').catch((err) => {
      console.error('[standings] CBB failed', err)
      return null
    }),
  ])

  return (
    <StandingsPageClient
      standings={{
        mlb: rawStandings && teams ? buildMlbStandings(rawStandings, teams, pitching) : null,
        nfl: rawNflSchedule ? buildNflStandings(rawNflSchedule) : null,
        nba: nbaStandings ? buildNbaStandings(nbaStandings) : null,
        nhl: nhlStandings ? buildNhlStandings(nhlStandings) : null,
        cfb: null,
        cbb: null,
      }}
      nflSeason={nflSeason}
      nflDataUpdating={nflSeason !== getCurrentNFLSeason()}
      nbaSeason={NBA_CURRENT_SEASON}
      nhlSeason={NHL_CURRENT_SEASON_LABEL}
      college={{ cfb: cfbStandings, cbb: cbbStandings }}
    />
  )
}
