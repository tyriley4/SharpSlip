import { LeadersPageClient } from '@/components/leaders/LeadersPageClient'
import { buildCbbLeaders } from '@/lib/college/cbbLeaders'
import { buildCfbLeaders } from '@/lib/college/cfbLeaders'
import { getCollegeDirectory } from '@/lib/college/directory'
import { getLeagueData } from '@/lib/football/league'
import { buildMlbLeaders } from '@/lib/mlb/buildLeaders'
import { getMlbTeamsIndex } from '@/lib/mlb/teams'
import { buildNbaLeaders } from '@/lib/nba/buildLeaders'
import { NBA_CURRENT_SEASON } from '@/lib/nba/divisions'
import { getActiveNFLSeason, getNFLStatsSeason } from '@/lib/nfl/api'
import { buildNflLeaders } from '@/lib/nfl/buildLeaders'
import { buildNhlLeaders } from '@/lib/nhl/buildLeaders'

export const revalidate = 3600

// Boards load deeper than the 15 rows they display so the scatter-plot builder has enough players to overlap.
const BOARD_DEPTH = 40

export default async function LeadersPage() {
  const nflSeason = await getActiveNFLSeason()
  const [mlbLeaders, nflLeaders, mlbTeamsIndex, nbaLeaders, nhlLeaders, nflStatsSeason, cfbLeaders, cfbDir, cbbBoards, cbbDir] = await Promise.all([
    buildMlbLeaders(BOARD_DEPTH),
    buildNflLeaders(nflSeason, BOARD_DEPTH),
    getMlbTeamsIndex(),
    buildNbaLeaders(NBA_CURRENT_SEASON, BOARD_DEPTH),
    buildNhlLeaders(BOARD_DEPTH),
    getNFLStatsSeason(nflSeason),
    buildCfbLeaders(BOARD_DEPTH).catch((err) => {
      console.error('[leaders] CFB failed', err)
      return null
    }),
    getCollegeDirectory('cfb').catch(() => null),
    buildCbbLeaders(BOARD_DEPTH).catch((err) => {
      console.error('[leaders] CBB failed', err)
      return null
    }),
    getCollegeDirectory('cbb').catch(() => null),
  ])
  const cbbTeams = (cbbDir?.teams ?? []).map((t) => ({ abbr: t.abbr, name: t.shortName })).sort((a, b) => a.name.localeCompare(b.name))
  const cbbNotice = cbbBoards?.info.lastSeason ? `Showing ${cbbBoards.info.label} season leaders — the new college basketball season hasn’t started yet. Boards switch to current-season stats once games are played.` : null
  const cfbTeams = (cfbDir?.teams ?? []).map((t) => ({ abbr: t.abbr, name: t.shortName })).sort((a, b) => a.name.localeCompare(b.name))
  const cfbConferences = (cfbDir?.conferences ?? []).filter((c) => c.teamIds.length >= 6).map((c) => ({ abbr: c.abbr, name: c.name })).sort((a, b) => a.name.localeCompare(b.name))

  const mlbTeams = mlbTeamsIndex
    ? Array.from(mlbTeamsIndex.values())
        .map((t) => ({ abbr: t.abbr, name: t.name }))
        .sort((a, b) => a.name.localeCompare(b.name))
    : []

  return (
    <LeadersPageClient
      mlbLeaders={mlbLeaders}
      nflLeaders={nflLeaders}
      nflSeason={nflStatsSeason ?? nflSeason}
      nflDataUpdating={nflStatsSeason === null || nflStatsSeason !== nflSeason}
      mlbTeams={mlbTeams}
      nbaLeaders={nbaLeaders}
      nbaSeason={NBA_CURRENT_SEASON}
      nhlLeaders={nhlLeaders}
      cfb={{ leaders: cfbLeaders, teams: cfbTeams, conferences: cfbConferences, colors: cfbDir?.colors ?? {}, building: getLeagueData('college-football').building }}
      cbb={{ leaders: cbbBoards?.leaders ?? null, teams: cbbTeams, colors: cbbDir?.colors ?? {}, notice: cbbNotice }}
    />
  )
}
