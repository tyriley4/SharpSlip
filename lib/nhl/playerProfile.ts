import type { PlayerRow, RecentFormGame, StatLine } from '@/lib/players/types'
import { getAllNHLGoalieStats, getAllNHLSkaterStats, getNHLPlayerGameLog, getNHLPlayerInfo } from './api'
import { mostRecentFirst } from './bettingStats'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Builds a PlayerRow-compatible object from live NHL API data for a resolved player ID.
 * Sections with no real free-data equivalent (opponent/venue splits, career-vs-opponent history)
 * are intentionally left empty — the player page already hides empty sections gracefully.
 */
export async function buildLiveNhlPlayerRow(playerId: number, slug: string): Promise<PlayerRow | null> {
  const info = await getNHLPlayerInfo(playerId)
  if (!info) return null

  const [gameLog, skaterStats, goalieStats] = await Promise.all([
    getNHLPlayerGameLog(playerId),
    info.isGoalie ? Promise.resolve(null) : getAllNHLSkaterStats(),
    info.isGoalie ? getAllNHLGoalieStats() : Promise.resolve(null),
  ])

  const season = info.isGoalie ? goalieStats?.find((g) => g.playerId === playerId) : skaterStats?.find((s) => s.playerId === playerId)

  const recentForm: RecentFormGame[] = mostRecentFirst(gameLog ?? [])
    .slice(0, 10)
    .map((g) => ({
      opp: g.opponentAbbr,
      date: formatDate(g.gameDate),
      result: (info.isGoalie ? g.decision === 'W' : g.result === 'W') ? 'W' : ('L' as const),
      stats: (info.isGoalie
        ? {
            dec: g.decision ?? '—',
            sa: g.shotsAgainst,
            sv: g.saves,
            ga: g.goalsAgainst,
            svPct: `${(g.savePct * 100).toFixed(1)}%`,
            toi: g.toi,
          }
        : {
            g: g.goals,
            a: g.assists,
            pts: g.points,
            plusMinus: g.plusMinus >= 0 ? `+${g.plusMinus}` : g.plusMinus,
            sog: g.shots,
            toi: g.toi,
          }) as StatLine,
    }))

  const headline = info.isGoalie
    ? season && 'savePct' in season
      ? `${(season.savePct * 100).toFixed(1)}% SV%`
      : null
    : season && 'points' in season
      ? `${season.points} PTS`
      : null

  return {
    id: `nhl-${playerId}`,
    slug,
    name: info.name,
    team: info.teamAbbr,
    sport: 'nhl',
    position: info.position || '—',
    is_hot: false,
    headline_stat: headline,
    season_stats: (season ?? {}) as StatLine,
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
