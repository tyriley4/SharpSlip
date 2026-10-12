import type { PlayerRow, RecentFormGame, StatLine } from '@/lib/players/types'
import { getAllNBAPlayerSeasonStats, getNBAPlayerGameLog } from './api'
import { mostRecentFirst } from './bettingStats'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Builds a PlayerRow-compatible object from live NBA Stats API data for a resolved player ID.
 * Sections with no real free-data equivalent (opponent/venue splits, career-vs-opponent history)
 * are intentionally left empty — the player page already hides empty sections gracefully.
 */
export async function buildLiveNbaPlayerRow(playerId: number, slug: string): Promise<PlayerRow | null> {
  const allStats = await getAllNBAPlayerSeasonStats()
  const season = allStats?.find((p) => p.playerId === playerId)
  if (!season) return null

  const gameLog = await getNBAPlayerGameLog(playerId)

  const recentForm: RecentFormGame[] = mostRecentFirst(gameLog ?? [])
    .slice(0, 10)
    .map((g) => ({
      opp: g.opponentAbbr,
      date: formatDate(g.gameDate),
      result: g.wl === 'W' ? 'W' : ('L' as const),
      stats: {
        pts: g.pts,
        reb: g.reb,
        ast: g.ast,
        stl: g.stl,
        blk: g.blk,
        min: g.min,
      } as StatLine,
    }))

  return {
    id: `nba-${playerId}`,
    slug,
    name: season.name,
    team: season.teamAbbr,
    sport: 'nba',
    position: season.position || '—',
    is_hot: false,
    headline_stat: season.pts ? `${season.pts.toFixed(1)} PPG` : null,
    season_stats: {
      pts: season.pts,
      reb: season.reb,
      ast: season.ast,
      stl: season.stl,
      blk: season.blk,
      min: season.min,
      fgPct: season.fgPct,
      fg3Pct: season.fg3Pct,
      ftPct: season.ftPct,
    },
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
