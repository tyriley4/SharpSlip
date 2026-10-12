import { getPlayerGameLog } from '@/lib/mlb/api'
import { NOTABLE_HITTERS, NOTABLE_PITCHERS } from '@/lib/mlb/notablePlayers'
import { resolvePlayerIds } from '@/lib/mlb/playerLookup'
import { getNBAPlayerGameLog, getNBATeamGameLog } from '@/lib/nba/api'
import { NBA_TEAM_IDS } from '@/lib/nba/divisions'
import { NOTABLE_NBA_PLAYERS } from '@/lib/nba/notablePlayers'
import { resolveNbaPlayerIds } from '@/lib/nba/playerLookup'
import { getNHLPlayerGameLog, getNHLTeamGameLog } from '@/lib/nhl/api'
import { NHL_TEAM_IDS } from '@/lib/nhl/divisions'
import { NOTABLE_NHL_SKATERS } from '@/lib/nhl/notablePlayers'
import { resolveNhlSkaterIds } from '@/lib/nhl/playerLookup'
import { getActiveNFLSeason, getNFLSchedule } from '@/lib/nfl/api'
import { normalizeNflAbbr } from '@/lib/nfl/divisions'
import { cfbTrendItems } from './cfbTicker'
import { dateOffset, getUnifiedGamesForDate } from './schedule'
import { sportMeta } from '@/lib/sport/meta'
import type { Sport } from '@/lib/sport/SportContext'
import { mapWithConcurrency, withTimeout } from '@/lib/utils/concurrency'

// Bounds how many concurrent requests hit any one external API at once — firing all ~30-50 at
// once can queue behind that origin's connection pool and stall well past any per-request timeout.
const CONCURRENCY = 5

export interface TickerItem {
  id: string
  text: string
  sport: Sport
  type: 'trend' | 'score' | 'alert'
  linkTo: string
  sportColor: string
}

const MAX_ITEMS = 30

function currentStreak(valuesMostRecentFirst: number[], threshold: number): number {
  let streak = 0
  for (const v of valuesMostRecentFirst) {
    if (v >= threshold) streak++
    else break
  }
  return streak
}

function bestStreakThreshold(valuesMostRecentFirst: number[], candidates: number[], minStreak: number): { threshold: number; streak: number } | null {
  let best: { threshold: number; streak: number } | null = null
  for (const t of candidates) {
    const s = currentStreak(valuesMostRecentFirst, t)
    if (s >= minStreak && (!best || s > best.streak || (s === best.streak && t > best.threshold))) {
      best = { threshold: t, streak: s }
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// Player prop streaks
// ---------------------------------------------------------------------------

async function mlbHitterStreaks(): Promise<TickerItem[]> {
  const resolved = await resolvePlayerIds(NOTABLE_HITTERS)
  const items = await mapWithConcurrency(
    resolved,
    CONCURRENCY,
    async (p): Promise<TickerItem | null> => {
      const log = await getPlayerGameLog(p.id, 'hitting')
      if (!log) return null
      const sorted = [...log].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      const hits = sorted.map((g) => Number(g.stat.hits ?? 0))
      const streak = currentStreak(hits, 1)
      if (streak < 3) return null
      return {
        id: `mlb-hit-${p.id}`,
        text: `${p.fullName} 1+ Hit in ${streak} straight`,
        sport: 'mlb',
        type: streak >= 4 ? 'trend' : 'alert',
        linkTo: `/players/${slugify(p.fullName)}`,
        sportColor: sportMeta('mlb').color,
      }
    }
  )
  return items.filter((i): i is TickerItem => i !== null)
}

async function mlbPitcherStreaks(): Promise<TickerItem[]> {
  const resolved = await resolvePlayerIds(NOTABLE_PITCHERS)
  const items = await mapWithConcurrency(
    resolved,
    CONCURRENCY,
    async (p): Promise<TickerItem | null> => {
      const log = await getPlayerGameLog(p.id, 'pitching')
      if (!log) return null
      const sorted = [...log].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      const ks = sorted.map((g) => Number(g.stat.strikeOuts ?? 0))
      const best = bestStreakThreshold(ks, [7, 6, 5, 4], 3)
      if (!best) return null
      return {
        id: `mlb-k-${p.id}`,
        text: `${p.fullName} ${best.threshold}+ Ks in ${best.streak} straight starts`,
        sport: 'mlb',
        type: best.streak >= 4 ? 'trend' : 'alert',
        linkTo: `/players/${slugify(p.fullName)}`,
        sportColor: sportMeta('mlb').color,
      }
    }
  )
  return items.filter((i): i is TickerItem => i !== null)
}

async function nbaPlayerStreaks(): Promise<TickerItem[]> {
  const resolved = await resolveNbaPlayerIds(NOTABLE_NBA_PLAYERS)
  const items = await mapWithConcurrency(
    resolved,
    CONCURRENCY,
    async (p): Promise<TickerItem | null> => {
      const log = await getNBAPlayerGameLog(p.playerId)
      if (!log) return null
      const sorted = [...log].sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
      const pts = sorted.map((g) => g.pts)
      const best = bestStreakThreshold(pts, [30, 25, 20, 15], 3)
      if (!best) return null
      const text = best.threshold === 20 ? `${p.name} 20+ Pts in ${best.streak} straight` : `${p.name} Over ${best.threshold} Pts in ${best.streak} straight`
      return {
        id: `nba-pts-${p.playerId}`,
        text,
        sport: 'nba',
        type: best.streak >= 4 ? 'trend' : 'alert',
        linkTo: `/players/${slugify(p.name)}`,
        sportColor: sportMeta('nba').color,
      }
    }
  )
  return items.filter((i): i is TickerItem => i !== null)
}

async function nhlPlayerStreaks(): Promise<TickerItem[]> {
  const resolved = await resolveNhlSkaterIds(NOTABLE_NHL_SKATERS)
  const items = await mapWithConcurrency(
    resolved,
    CONCURRENCY,
    async (p): Promise<TickerItem | null> => {
      const log = await getNHLPlayerGameLog(p.playerId)
      if (!log) return null
      const sorted = [...log].sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
      const sog = sorted.map((g) => g.shots)
      const streak = currentStreak(sog, 1)
      if (streak < 3) return null
      return {
        id: `nhl-sog-${p.playerId}`,
        text: `${p.name} 1+ SOG in ${streak} straight`,
        sport: 'nhl',
        type: streak >= 4 ? 'trend' : 'alert',
        linkTo: `/players/${slugify(p.name)}`,
        sportColor: sportMeta('nhl').color,
      }
    }
  )
  return items.filter((i): i is TickerItem => i !== null)
}

function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.']/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ---------------------------------------------------------------------------
// Team trends
// ---------------------------------------------------------------------------

const NBA_LEAGUE_AVG_TOTAL = 224
const NHL_LEAGUE_AVG_TOTAL = 6

async function nbaTeamTrends(): Promise<TickerItem[]> {
  const entries = Object.entries(NBA_TEAM_IDS)
  const items = await mapWithConcurrency(
    entries,
    CONCURRENCY,
    async ([abbr, teamId]): Promise<TickerItem[]> => {
      const log = await getNBATeamGameLog(teamId)
      if (!log || log.length < 7) return []
      const sorted = [...log].sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
      const last10 = sorted.slice(0, 10)
      const last7 = sorted.slice(0, 7)
      const out: TickerItem[] = []

      const overHits = last10.filter((g) => g.pts + g.oppPts > NBA_LEAGUE_AVG_TOTAL).length
      if (overHits >= 6) out.push({ id: `nba-over-${abbr}`, text: `${abbr} Over has hit ${overHits} of last 10`, sport: 'nba', type: 'trend', linkTo: '/standings', sportColor: sportMeta('nba').color })
      const underHits = last10.length - overHits
      if (underHits >= 6) out.push({ id: `nba-under-${abbr}`, text: `${abbr} Under has hit ${underHits} of last 10`, sport: 'nba', type: 'trend', linkTo: '/standings', sportColor: sportMeta('nba').color })

      const atsHits = last7.filter((g) => g.pts - g.oppPts >= 5.5).length
      if (atsHits >= 6) out.push({ id: `nba-ats-${abbr}`, text: `${abbr} covered ${atsHits} of last 7`, sport: 'nba', type: 'trend', linkTo: '/standings', sportColor: sportMeta('nba').color })

      const scoringStreak = bestStreakThreshold(sorted.map((g) => g.pts), [120, 115, 110], 4)
      if (scoringStreak) out.push({ id: `nba-scored-${abbr}`, text: `${abbr} scored ${scoringStreak.threshold}+ in ${scoringStreak.streak} straight`, sport: 'nba', type: 'trend', linkTo: '/standings', sportColor: sportMeta('nba').color })

      return out
    }
  )
  return items.flat()
}

async function nhlTeamTrends(): Promise<TickerItem[]> {
  const abbrs = Object.keys(NHL_TEAM_IDS)
  const items = await mapWithConcurrency(
    abbrs,
    CONCURRENCY,
    async (abbr): Promise<TickerItem[]> => {
      const log = await getNHLTeamGameLog(abbr)
      if (!log || log.length < 7) return []
      const sorted = [...log].sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
      const last10 = sorted.slice(0, 10)
      const last7 = sorted.slice(0, 7)
      const out: TickerItem[] = []

      const overHits = last10.filter((g) => g.goalsFor + g.goalsAgainst > NHL_LEAGUE_AVG_TOTAL).length
      if (overHits >= 6) out.push({ id: `nhl-over-${abbr}`, text: `${abbr} Over has hit ${overHits} of last 10`, sport: 'nhl', type: 'trend', linkTo: '/standings', sportColor: sportMeta('nhl').color })
      const underHits = last10.length - overHits
      if (underHits >= 6) out.push({ id: `nhl-under-${abbr}`, text: `${abbr} Under has hit ${underHits} of last 10`, sport: 'nhl', type: 'trend', linkTo: '/standings', sportColor: sportMeta('nhl').color })

      const atsHits = last7.filter((g) => g.goalsFor - g.goalsAgainst >= 1.5).length
      if (atsHits >= 6) out.push({ id: `nhl-ats-${abbr}`, text: `${abbr} covered ${atsHits} of last 7`, sport: 'nhl', type: 'trend', linkTo: '/standings', sportColor: sportMeta('nhl').color })

      const scoringStreak = bestStreakThreshold(sorted.map((g) => g.goalsFor), [5, 4, 3], 4)
      if (scoringStreak) out.push({ id: `nhl-scored-${abbr}`, text: `${abbr} scored ${scoringStreak.threshold}+ in ${scoringStreak.streak} straight`, sport: 'nhl', type: 'trend', linkTo: '/standings', sportColor: sportMeta('nhl').color })

      return out
    }
  )
  return items.flat()
}

async function nflTeamTrends(): Promise<TickerItem[]> {
  const schedule = await getNFLSchedule(await getActiveNFLSeason())
  if (!schedule) return []

  const played = schedule.filter((r) => r.game_type === 'REG' && r.home_score !== '' && r.away_score !== '')
  const byTeam = new Map<string, { date: string; isHome: boolean; my: number; opp: number; spread: number | null; total: number | null }[]>()

  for (const r of played) {
    const home = normalizeNflAbbr(r.home_team)
    const away = normalizeNflAbbr(r.away_team)
    const homeScore = Number(r.home_score)
    const awayScore = Number(r.away_score)
    const spread = r.spread_line ? Number(r.spread_line) : null
    const total = r.total_line ? Number(r.total_line) : null

    const homeRows = byTeam.get(home) ?? []
    homeRows.push({ date: r.gameday, isHome: true, my: homeScore, opp: awayScore, spread: spread !== null ? -spread : null, total })
    byTeam.set(home, homeRows)

    const awayRows = byTeam.get(away) ?? []
    awayRows.push({ date: r.gameday, isHome: false, my: awayScore, opp: homeScore, spread, total })
    byTeam.set(away, awayRows)
  }

  const out: TickerItem[] = []
  for (const [abbr, rows] of Array.from(byTeam.entries())) {
    const sorted = [...rows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const last10 = sorted.slice(0, 10)
    const last7 = sorted.slice(0, 7)
    if (last10.length < 7) continue

    const withTotal = last10.filter((g) => g.total !== null)
    const overHits = withTotal.filter((g) => g.my + g.opp > (g.total ?? 0)).length
    if (withTotal.length >= 7 && overHits >= 6) out.push({ id: `nfl-over-${abbr}`, text: `${abbr} Over has hit ${overHits} of last ${withTotal.length}`, sport: 'nfl', type: 'trend', linkTo: '/standings', sportColor: sportMeta('nfl').color })

    const withSpread = last7.filter((g) => g.spread !== null)
    const atsHits = withSpread.filter((g) => g.my - g.opp + (g.spread ?? 0) > 0).length
    if (withSpread.length >= 6 && atsHits >= 6) out.push({ id: `nfl-ats-${abbr}`, text: `${abbr} covered ${atsHits} of last ${withSpread.length}`, sport: 'nfl', type: 'trend', linkTo: '/standings', sportColor: sportMeta('nfl').color })
  }
  return out
}

// ---------------------------------------------------------------------------
// Live scores
// ---------------------------------------------------------------------------

async function liveScores(): Promise<TickerItem[]> {
  const games = await getUnifiedGamesForDate(dateOffset(0))
  return games
    .filter((g) => g.status === 'Live')
    .map((g) => ({
      id: `live-${g.sport}-${g.id}`,
      text: `${g.away.abbr} ${g.away.score ?? 0} ${g.home.abbr} ${g.home.score ?? 0} • LIVE`,
      sport: g.sport,
      type: 'score' as const,
      linkTo: g.href,
      sportColor: sportMeta(g.sport).color,
    }))
}

// ---------------------------------------------------------------------------
// Aggregator
// ---------------------------------------------------------------------------

function interleave(groups: TickerItem[][]): TickerItem[] {
  const out: TickerItem[] = []
  const maxLen = Math.max(0, ...groups.map((g) => g.length))
  for (let i = 0; i < maxLen; i++) {
    for (const g of groups) {
      if (g[i]) out.push(g[i])
    }
  }
  return out
}

/**
 * Builds the ticker feed from real game-log-derived streaks/trends across all 4 sports.
 * NRFI/YRFI streaks are not implemented — first-inning-runs data isn't exposed by the simple
 * game-log endpoints this app already uses (would need per-start linescore/play-by-play parsing).
 */
export async function getTickerItems(): Promise<TickerItem[]> {
  // Each section is independently time-boxed — if one sport's scan stalls under heavy concurrent
  // load against a rate-limited API, the others still return promptly and the ticker degrades
  // gracefully instead of hanging the page.
  const bounded = <T,>(p: Promise<T[]>) => withTimeout(p, 20000, [] as T[])

  const [mlbHitters, mlbPitchers, nbaPlayers, nhlPlayers, nbaTeams, nhlTeams, nflTeams, live, cfbTrends] = await Promise.all([
    bounded(mlbHitterStreaks()),
    bounded(mlbPitcherStreaks()),
    bounded(nbaPlayerStreaks()),
    bounded(nhlPlayerStreaks()),
    bounded(nbaTeamTrends()),
    bounded(nhlTeamTrends()),
    bounded(nflTeamTrends()),
    bounded(liveScores()),
    bounded(cfbTrendItems()),
  ])

  const merged = interleave([live, mlbHitters, nbaPlayers, nhlPlayers, mlbPitchers, nbaTeams, nhlTeams, nflTeams, cfbTrends])
  return merged.slice(0, MAX_ITEMS)
}
