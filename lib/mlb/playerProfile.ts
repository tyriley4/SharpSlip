import type { PlayerRow, RecentFormGame, StatLine } from '@/lib/players/types'
import { getPerson, getPlayerGameLog, getPlayerStats } from './api'
import { getMlbTeamsIndex } from './teams'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Builds a PlayerRow-compatible object from live MLB Stats API data for a resolved player ID.
 * Sections with no real free-data equivalent (prop bets, opponent/venue splits, career-vs-opponent
 * history) are intentionally left empty — the player page already hides empty sections gracefully.
 */
export async function buildLiveMlbPlayerRow(playerId: number, slug: string): Promise<PlayerRow | null> {
  const person = await getPerson(playerId)
  if (!person) return null

  const isPitcher = person.primaryPosition?.abbreviation === 'P'
  const group = isPitcher ? 'pitching' : 'hitting'

  const [season, gameLog, teams] = await Promise.all([
    getPlayerStats(playerId, group),
    getPlayerGameLog(playerId, group),
    getMlbTeamsIndex(),
  ])

  const headline = isPitcher
    ? season?.stat.era
      ? `${season.stat.era} ERA`
      : null
    : season?.stat.avg
      ? `${season.stat.avg} AVG`
      : null

  const recentForm: RecentFormGame[] = (gameLog ?? [])
    .slice(-10)
    .reverse()
    .map((g) => ({
      opp: teams?.get(g.opponent.id)?.abbr ?? g.opponent.name.slice(0, 3).toUpperCase(),
      date: formatDate(g.date),
      result: g.isWin ? 'W' : ('L' as const),
      stats: (isPitcher
        ? {
            ip: g.stat.inningsPitched,
            h: g.stat.hits,
            er: g.stat.earnedRuns,
            k: g.stat.strikeOuts,
            bb: g.stat.baseOnBalls,
          }
        : {
            ab: g.stat.atBats,
            h: g.stat.hits,
            hr: g.stat.homeRuns,
            rbi: g.stat.rbi,
            bb: g.stat.baseOnBalls,
            avg: g.stat.avg,
          }) as StatLine,
    }))

  return {
    id: `mlb-${playerId}`,
    slug,
    name: person.fullName,
    team: person.currentTeam ? (teams?.get(person.currentTeam.id)?.abbr ?? person.currentTeam.name) : '—',
    sport: 'mlb',
    position: person.primaryPosition?.abbreviation ?? '—',
    is_hot: false,
    headline_stat: headline,
    season_stats: season?.stat ?? {},
    recent_form: recentForm,
    prop_records: [],
    best_opponents: [],
    worst_opponents: [],
    best_venues: [],
    worst_venues: [],
    career_vs_opponents: {},
    tonight_edge: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}
