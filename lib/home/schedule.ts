import { getGamesForDate as getMlbGamesForDate, type RawScheduleGame } from '@/lib/mlb/api'
import { getActiveNFLSeason, getNFLSchedule } from '@/lib/nfl/api'
import { getNetworkMap } from '@/lib/espn/api'
import { normalizeNflAbbr } from '@/lib/nfl/divisions'
import { getNBAGamesForDate } from '@/lib/nba/api'
import { isNbaPreseasonDate } from '@/lib/edges/seasonText'
import { getNHLScheduleForDate } from '@/lib/nhl/api'
import { getCollegeSlate } from '@/lib/college/slate'
import type { Sport } from '@/lib/sport/SportContext'

export type UnifiedGameStatus = 'Pregame' | 'Live' | 'Final'

export interface UnifiedGame {
  id: string
  sport: Sport
  status: UnifiedGameStatus
  statusText: string
  startTime: string | null
  network: string | null
  venue: string
  away: { abbr: string; score: number | null }
  home: { abbr: string; score: number | null }
  href: string
  /** College polls: AP rank of each side when ranked. */
  awayRank?: number | null
  homeRank?: number | null
}

function n(v: string | undefined): number | null {
  if (v === undefined || v === '') return null
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : null
}

async function mlbGamesForDate(date: string): Promise<UnifiedGame[]> {
  const raw = await getMlbGamesForDate(date)
  if (!raw) return []
  return raw.map((g: RawScheduleGame): UnifiedGame => {
    const state = g.status.abstractGameState as 'Preview' | 'Live' | 'Final'
    const status: UnifiedGameStatus = state === 'Preview' ? 'Pregame' : state
    return {
      id: String(g.gamePk),
      sport: 'mlb',
      status,
      statusText: status === 'Pregame' ? new Date(g.gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : g.status.detailedState,
      startTime: g.gameDate,
      network: null,
      venue: g.venue?.name ?? '',
      away: { abbr: g.teams.away.team.abbreviation ?? g.teams.away.team.name.slice(0, 3).toUpperCase(), score: g.teams.away.score ?? null },
      home: { abbr: g.teams.home.team.abbreviation ?? g.teams.home.team.name.slice(0, 3).toUpperCase(), score: g.teams.home.score ?? null },
      href: `/games/${g.gamePk}`,
    }
  })
}

async function nflGamesForDate(date: string): Promise<UnifiedGame[]> {
  const schedule = await getNFLSchedule(await getActiveNFLSeason())
  if (!schedule) return []
  const networks = await getNetworkMap('nfl')
  return schedule
    .filter((r) => r.game_type === 'REG' && r.gameday === date)
    .map((r): UnifiedGame => {
      const played = r.home_score !== '' && r.away_score !== ''
      const status: UnifiedGameStatus = played ? 'Final' : 'Pregame'
      return {
        id: r.game_id,
        sport: 'nfl',
        status,
        statusText: status === 'Final' ? 'Final' : r.gametime || 'Scheduled',
        startTime: r.gametime ? `${r.gameday}T${r.gametime}` : r.gameday,
        network: networks.get(`${normalizeNflAbbr(r.away_team)}@${normalizeNflAbbr(r.home_team)}`) ?? null,
        venue: r.stadium ?? '',
        away: { abbr: normalizeNflAbbr(r.away_team), score: n(r.away_score) },
        home: { abbr: normalizeNflAbbr(r.home_team), score: n(r.home_score) },
        href: `/games/${r.game_id}`,
      }
    })
}

async function nbaGamesForDate(date: string): Promise<UnifiedGame[]> {
  const games = await getNBAGamesForDate(date)
  if (!games) return []
  // Preseason games are hidden until opening night: rotations and minutes are experimental.
  return games.filter((g) => !isNbaPreseasonDate(g.gameDate)).map((g): UnifiedGame => ({
    id: g.gameId,
    sport: 'nba',
    status: g.status,
    statusText: g.statusText,
    startTime: g.gameDate,
    network: g.network,
    venue: g.arena,
    away: { abbr: g.away.abbr, score: g.away.score },
    home: { abbr: g.home.abbr, score: g.home.score },
    href: `/games/nba/${g.gameId}`,
  }))
}

async function nhlGamesForDate(date: string): Promise<UnifiedGame[]> {
  const games = await getNHLScheduleForDate(date)
  if (!games) return []
  return games.map((g): UnifiedGame => ({
    id: g.gameId,
    sport: 'nhl',
    status: g.status,
    statusText: g.statusText,
    startTime: g.startTimeUTC,
    network: g.network,
    venue: g.venue,
    away: { abbr: g.away.abbr, score: g.away.score },
    home: { abbr: g.home.abbr, score: g.home.score },
    href: `/games/nhl/${g.gameId}`,
  }))
}

/** College games on a given ET date from the ESPN slate (football's current week, or basketball's board). Basketball returns nothing before tip-off. */
async function collegeGamesForDate(sport: 'cfb' | 'cbb', date: string): Promise<UnifiedGame[]> {
  const slate = await getCollegeSlate(sport).catch(() => null)
  if (!slate || (sport === 'cbb' && slate.preseason)) return []
  return slate.games
    .filter((g) => g.day === date)
    .map((g): UnifiedGame => ({
      id: g.id,
      sport,
      status: g.state === 'in' ? 'Live' : g.state === 'post' ? 'Final' : 'Pregame',
      statusText: g.state === 'pre' ? new Date(g.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) : g.shortStatus,
      startTime: g.date,
      network: g.network,
      venue: g.venue ?? '',
      away: { abbr: g.away.abbr, score: g.away.score },
      home: { abbr: g.home.abbr, score: g.home.score },
      href: `/games/${sport}/${g.id}`,
      awayRank: g.away.rank,
      homeRank: g.home.rank,
    }))
}

/** Merges all 6 sports' games for a given date (YYYY-MM-DD), sorted by start time. */
export async function getUnifiedGamesForDate(date: string): Promise<UnifiedGame[]> {
  const [mlb, nfl, nba, nhl, cfb, cbb] = await Promise.all([
    mlbGamesForDate(date),
    nflGamesForDate(date),
    nbaGamesForDate(date),
    nhlGamesForDate(date),
    collegeGamesForDate('cfb', date),
    collegeGamesForDate('cbb', date),
  ])
  const all = [...mlb, ...nfl, ...nba, ...nhl, ...cfb, ...cbb]
  return all.sort((a, b) => {
    if (!a.startTime) return 1
    if (!b.startTime) return -1
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  })
}

/** The US Eastern calendar date `days` from now: an 8pm Eastern first pitch is still "today", not tomorrow in UTC. */
export function dateOffset(days: number): string {
  const d = new Date(Date.now() + days * 86400000)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}
