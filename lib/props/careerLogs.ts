import { getPlayerGameLog as getEspnGameLog } from '@/lib/espn/api'
import { getPlayerGameLog as getMlbGameLog } from '@/lib/mlb/api'
import { getMlbTeamsIndex } from '@/lib/mlb/teams'
import { categoryStatKey, HITTER_PROP_CATEGORIES, PITCHER_PROP_CATEGORIES } from '@/lib/mlb/bettingCategories'
import { getNBAPlayerGameLog } from '@/lib/nba/api'
import { NBA_CURRENT_SEASON } from '@/lib/nba/divisions'
import { NBA_BETTING_CATEGORIES, NBA_BETTING_STAT_KEY } from '@/lib/nba/leaderCategories'
import { getCurrentNFLSeason, getNFLPlayerStats } from '@/lib/nfl/api'
import { getNHLPlayerGameLog } from '@/lib/nhl/api'
import { NHL_CURRENT_SEASON } from '@/lib/nhl/divisions'
import { NHL_GOALIE_PLAYER_PROP_STAT_KEY, NHL_SKATER_BETTING_STAT_KEY } from '@/lib/nhl/leaderCategories'
import { reportError } from '@/lib/monitoring/sentry'
import { cached } from '@/lib/net/ttlCache'
import { slugify } from '@/lib/players/slug'
import type { CareerGame } from './careerHitRates'

/**
 * Multi-season game logs for the player-page Career column. Each game is flattened to the value of every prop
 * category its sport offers, so the browser can compute hit rates at any threshold without more requests.
 * Finished seasons cache for seven days (the underlying fetchers keep their own caches too).
 */

export type CareerSport = 'mlb' | 'nfl' | 'nba' | 'nhl'
export const CAREER_SEASONS = 5
const WEEK = 604800

export interface CareerQuery {
  sport: CareerSport
  playerId: string
  /** MLB: hitting or pitching. */
  group?: 'hitting' | 'pitching'
  goalie?: boolean
  /** "season" returns only the in-progress season (fast); "career" the last five. */
  scope: 'season' | 'career'
}

export interface CareerPayload {
  games: CareerGame[]
  seasons: string[]
}

const ymd = (d: string | null | undefined) => (d ?? '').slice(0, 10)

async function mlb(q: CareerQuery, count: number): Promise<CareerGame[]> {
  const group = q.group ?? 'hitting'
  const cats = group === 'hitting' ? HITTER_PROP_CATEGORIES : PITCHER_PROP_CATEGORIES
  const year = new Date().getFullYear()
  const years = Array.from({ length: count }, (_, i) => year - i)
  const [logs, teams] = await Promise.all([Promise.all(years.map((y) => getMlbGameLog(Number(q.playerId), group, y).catch(() => null))), getMlbTeamsIndex().catch(() => null)])
  // The postseason log for the current year (the league feed keeps it apart from the regular season).
  let post: typeof logs[number] = null
  try {
    const res = await fetch(`https://statsapi.mlb.com/api/v1/people/${q.playerId}/stats?stats=gameLog&group=${group}&season=${year}&gameType=P`, { next: { revalidate: 3600 } })
    if (res.ok) {
      const d = (await res.json()) as { stats?: { splits?: { date: string; isHome: boolean; isWin: boolean; opponent: { id: number; abbreviation?: string }; team?: { id: number; abbreviation?: string }; stat: Record<string, string | number> }[] }[] }
      post = (d.stats?.[0]?.splits ?? []) as unknown as typeof logs[number]
    }
  } catch {
    /* postseason log unavailable: the regular season still stands */
  }
  if (post && logs[0]) logs[0] = [...logs[0], ...post]
  else if (post) logs[0] = post
  const out: CareerGame[] = []
  logs.forEach((log, i) => {
    for (const g of log ?? []) {
      const values: Record<string, number> = {}
      for (const c of cats) values[c] = Number(g.stat[categoryStatKey(c, group)] ?? 0)
      out.push({ season: String(years[i]), date: ymd(g.date), home: g.isHome, opp: teams?.get(g.opponent.id)?.abbr ?? g.opponent.abbreviation, team: teams?.get(g.team?.id)?.abbr, values })
    }
  })
  return out
}

function priorNbaSeason(season: string, back: number): string {
  const start = Number(season.slice(0, 4)) - back
  return `${start}-${String(start + 1).slice(2)}`
}

async function nba(q: CareerQuery, count: number): Promise<CareerGame[]> {
  const seasons = Array.from({ length: count }, (_, i) => priorNbaSeason(NBA_CURRENT_SEASON, i))
  const logs = await Promise.all(seasons.map((s) => getNBAPlayerGameLog(Number(q.playerId), s).catch(() => null)))
  const out: CareerGame[] = []
  logs.forEach((log, i) => {
    for (const g of log ?? []) {
      const values: Record<string, number> = {}
      for (const c of NBA_BETTING_CATEGORIES) {
        const key = NBA_BETTING_STAT_KEY[c]
        values[c] = key === 'pra' ? g.pts + g.reb + g.ast : g[key]
      }
      values.Minutes = g.min
      out.push({ season: seasons[i], date: ymd(g.gameDate), home: g.isHome, opp: g.opponentAbbr, team: g.matchup.split(' ')[0], values })
    }
  })
  return out
}

async function nhl(q: CareerQuery, count: number): Promise<CareerGame[]> {
  const seasons = Array.from({ length: count }, (_, i) => NHL_CURRENT_SEASON - i * 10001)
  const logs = await Promise.all(seasons.map((s) => getNHLPlayerGameLog(Number(q.playerId), s).catch(() => null)))
  const map: Record<string, string> = q.goalie ? NHL_GOALIE_PLAYER_PROP_STAT_KEY : NHL_SKATER_BETTING_STAT_KEY
  const out: CareerGame[] = []
  logs.forEach((log, i) => {
    for (const g of log ?? []) {
      const values: Record<string, number> = {}
      for (const [cat, key] of Object.entries(map)) values[cat] = Number((g as unknown as Record<string, number>)[key] ?? 0)
      const [mm, ss] = (g.toi || '0:0').split(':').map(Number)
      if (!q.goalie) values.TOI = Math.round(((mm || 0) + (ss || 0) / 60) * 10) / 10
      out.push({ season: String(seasons[i]), date: ymd(g.gameDate), home: g.isHome, opp: g.opponentAbbr, team: g.teamAbbr, values })
    }
  })
  return out
}

async function nfl(q: CareerQuery, count: number): Promise<CareerGame[]> {
  const year = getCurrentNFLSeason()
  const years = Array.from({ length: count }, (_, i) => year - i)
  const logs = await Promise.all(years.map((y) => getEspnGameLog('football', 'nfl', q.playerId, y).catch(() => null)))
  const out: CareerGame[] = []
  logs.forEach((log, i) => {
    for (const g of log?.rows ?? []) {
      const s = g.stats
      out.push({
        season: String(years[i]),
        date: ymd(g.date),
        home: g.home,
        opp: g.opponent,
        values: {
          'Pass Yards': s.passingYards ?? 0,
          'TD Passes': s.passingTouchdowns ?? 0,
          Completions: s.completions ?? 0,
          INTs: s.interceptions ?? 0,
          'Rush Yards': s.rushingYards ?? 0,
          'Rush Attempts': s.rushingAttempts ?? 0,
          Targets: s.receivingTargets ?? 0,
          'Receiving Yards': s.receivingYards ?? 0,
          Receptions: s.receptions ?? 0,
          'Anytime TD': (s.rushingTouchdowns ?? 0) + (s.receivingTouchdowns ?? 0),
        },
      })
    }
  })
  return out
}

export async function getCareerPayload(q: CareerQuery): Promise<CareerPayload | null> {
  const count = q.scope === 'season' ? 1 : CAREER_SEASONS
  const key = `career:${q.sport}:${q.playerId}:${q.group ?? ''}:${q.goalie ? 'g' : ''}:${q.scope}`
  return cached(key, WEEK, async () => {
    try {
      const games = q.sport === 'mlb' ? await mlb(q, count) : q.sport === 'nba' ? await nba(q, count) : q.sport === 'nhl' ? await nhl(q, count) : await nfl(q, count)
      if (games.length === 0) return null
      games.sort((a, b) => b.date.localeCompare(a.date))
      return { games, seasons: Array.from(new Set(games.map((g) => g.season))).sort() }
    } catch (err) {
      reportError(err, 'career-logs')
      return null
    }
  })
}

/** Finds an NFL player's ESPN id from his name slug (this season's box-score rows carry ESPN ids). */
export async function findNflPlayerId(slug: string, team?: string): Promise<{ id: string; position: string; team: string } | null> {
  const rows = await getNFLPlayerStats(getCurrentNFLSeason())
  const hits = (rows ?? []).filter((r) => slugify(r.player_display_name || r.player_name) === slug)
  if (hits.length === 0) return null
  const pick = (team ? hits.find((r) => (r.recent_team || r.team) === team.toUpperCase()) : undefined) ?? hits[0]
  return { id: pick.player_id, position: pick.position, team: pick.recent_team || pick.team }
}
