import { GamesPageClient } from '@/components/games/GamesPageClient'
import { getTodaysGames } from '@/lib/mlb/api'
import { mapScheduleGame } from '@/lib/mlb/mappers'
import { getAllNBATeamStats, getNBAStandings, getTodaysNBAGames } from '@/lib/nba/api'
import { mapNbaGamesForList } from '@/lib/nba/mappers'
import { getCollegeSlate } from '@/lib/college/slate'
import { getActiveNFLSeason, getCurrentNFLSeason, getNFLSchedule } from '@/lib/nfl/api'
import { nflWeekSlate } from '@/lib/nfl/espnOverlay'
import { getAllNHLGoalieStats, getAllNHLTeamStats, getNHLStandings, getTodaysNHLGames } from '@/lib/nhl/api'
import { mapNhlGamesForList } from '@/lib/nhl/mappers'

export const revalidate = 3600

export default async function GamesPage() {
  const nflSeason = await getActiveNFLSeason()
  const [rawMlbGames, rawNflGames, nbaGames, nbaStandings, nbaTeamStats, nhlGames, nhlStandings, nhlTeamStats, nhlGoalieStats, cfbSlate, cbbSlate] = await Promise.all([
    getTodaysGames(),
    getNFLSchedule(nflSeason),
    getTodaysNBAGames(),
    getNBAStandings(),
    getAllNBATeamStats(),
    getTodaysNHLGames(),
    getNHLStandings(),
    getAllNHLTeamStats(),
    getAllNHLGoalieStats(),
    getCollegeSlate('cfb').catch((err) => {
      console.error('[games] CFB slate failed', err)
      return null
    }),
    getCollegeSlate('cbb').catch((err) => {
      console.error('[games] CBB slate failed', err)
      return null
    }),
  ])

  const mlbGames = rawMlbGames ? rawMlbGames.map(mapScheduleGame) : null
  const nflGames = await nflWeekSlate(rawNflGames)
  const nflWeek = nflGames && nflGames.length > 0 ? nflGames[0].week : null

  const nbaTeamStatsMap = new Map((nbaTeamStats ?? []).map((t) => [t.teamId, t]))
  const nbaGameCards = nbaGames ? mapNbaGamesForList(nbaGames, nbaStandings, nbaTeamStatsMap) : null

  const nhlTeamStatsMap = new Map((nhlTeamStats ?? []).map((t) => [t.abbr, t]))
  const nhlGameCards = nhlGames ? mapNhlGamesForList(nhlGames, nhlStandings, nhlTeamStatsMap, nhlGoalieStats ?? []) : null

  return (
    <GamesPageClient
      mlbGames={mlbGames}
      nflGames={nflGames}
      nflSeason={nflSeason}
      nflDataUpdating={nflSeason !== getCurrentNFLSeason()}
      nflWeek={nflWeek}
      nbaGames={nbaGameCards}
      nhlGames={nhlGameCards}
      cfbSlate={cfbSlate}
      cbbSlate={cbbSlate}
    />
  )
}
