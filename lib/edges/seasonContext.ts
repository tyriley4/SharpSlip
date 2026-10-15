import { ESPN_REF } from '@/lib/espn/api'
import { loadMlbGameInfo } from './data/mlbGame'
import { reportError } from '@/lib/monitoring/sentry'
import { cached } from '@/lib/net/ttlCache'
import { getNFLSchedule } from '@/lib/nfl/api'
import type { Sport } from '@/lib/sport/SportContext'
import type { SeasonContext } from './types'

import { isNbaPreseasonDate } from './seasonText'
export { EARLY_SEASON_NOTE, NBA_PRESEASON_BANNER, PLAYOFF_BANNER, PRESEASON_ANALYSIS_NOTE, NBA_REGULAR_SEASON_START, isNbaPreseasonDate } from './seasonText'

/** Approximate regular-season openers by sport, used for the "first four weeks" flag. */
function seasonOpener(sport: Sport, date: Date): Date {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth() + 1
  const start = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day))
  if (sport === 'mlb') return start(y, 3, 26)
  if (sport === 'nfl') return start(m >= 6 ? y : y - 1, 9, 10)
  if (sport === 'cfb') return start(m >= 6 ? y : y - 1, 8, 29)
  if (sport === 'nba') return start(m >= 8 ? y : y - 1, 10, 20)
  if (sport === 'nhl') return start(m >= 8 ? y : y - 1, 10, 7)
  return start(m >= 8 ? y : y - 1, 11, 2)
}

const REGULAR: SeasonContext = { isPreseason: false, isPlayoffs: false, isRegularSeason: true, isEarlySeason: false }

function early(sport: Sport, startTime: string | null, week?: number): boolean {
  if (sport === 'nfl' && week !== undefined) return week <= 4
  const d = startTime ? new Date(startTime) : new Date()
  const days = (d.getTime() - seasonOpener(sport, d).getTime()) / 86400000
  return days >= 0 && days < 28
}

interface EspnSummary {
  header?: {
    season?: { type?: number }
    competitions?: { series?: { type?: string; title?: string; summary?: string; totalCompetitions?: number }; notes?: { headline?: string }[] }[]
  }
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

/** "BOS leads series 2-1" / "Series tied 1-1" -> games played so far. */
function gamesPlayed(summary: string | undefined): number | undefined {
  const m = /(\d+)\s*-\s*(\d+)/.exec(summary ?? '')
  return m ? Number(m[1]) + Number(m[2]) : undefined
}

async function mlbContext(gameId: string, startTime: string | null): Promise<SeasonContext> {
  const g = await loadMlbGameInfo(gameId)
  const t = g?.gameType ?? 'R'
  if (['S', 'E'].includes(t)) return { isPreseason: true, isPlayoffs: false, isRegularSeason: false, isEarlySeason: false }
  if (['F', 'D', 'L', 'W', 'P'].includes(t)) return { isPreseason: false, isPlayoffs: true, isRegularSeason: false, isEarlySeason: false, playoffRound: g?.seriesDescription, seriesGame: g?.seriesGame }
  return { ...REGULAR, isEarlySeason: early('mlb', startTime) }
}

/** NFL season year for now: the season is named for the year it starts in. */
const nflSeasonYear = () => {
  const d = new Date()
  return d.getUTCMonth() + 1 >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1
}

async function nflContext(gameId: string, startTime: string | null): Promise<SeasonContext> {
  const rows = await getNFLSchedule(nflSeasonYear()).catch(() => null)
  const row = rows?.find((r) => r.game_id === gameId)
  const type = row?.game_type ?? 'REG'
  if (type === 'PRE') return { isPreseason: true, isPlayoffs: false, isRegularSeason: false, isEarlySeason: false }
  if (type !== 'REG') return { isPreseason: false, isPlayoffs: true, isRegularSeason: false, isEarlySeason: false, playoffRound: { WC: 'Wild Card', DIV: 'Divisional', CON: 'Conference Championship', SB: 'Super Bowl' }[type] }
  const week = Number(/^\d{4}_(\d{2})_/.exec(gameId)?.[1])
  return { ...REGULAR, isEarlySeason: early('nfl', startTime, Number.isFinite(week) ? week : undefined) }
}

function nhlContext(gameId: string, startTime: string | null): SeasonContext {
  // NHL ids are YYYY TT NNNN: 01 preseason, 02 regular season, 03 playoffs (then round, series, game).
  const type = gameId.slice(4, 6)
  if (type === '01') return { isPreseason: true, isPlayoffs: false, isRegularSeason: false, isEarlySeason: false }
  if (type === '03') {
    const round = Number(gameId.slice(7, 8))
    return { isPreseason: false, isPlayoffs: true, isRegularSeason: false, isEarlySeason: false, playoffRound: round ? `Round ${round}` : undefined, seriesGame: Number(gameId.slice(9, 10)) || undefined }
  }
  return { ...REGULAR, isEarlySeason: early('nhl', startTime) }
}

async function espnContext(sport: 'nba' | 'cbb' | 'cfb', gameId: string, startTime: string | null): Promise<SeasonContext> {
  const ref = ESPN_REF[sport]
  const id = gameId.replace(/^espn-/, '')
  const data = await getJson<EspnSummary>(`https://site.api.espn.com/apis/site/v2/sports/${ref.sport}/${ref.league}/summary?event=${id}`)
  const type = data?.header?.season?.type
  const comp = data?.header?.competitions?.[0]
  if (sport === 'nba' && (type === 1 || isNbaPreseasonDate(startTime))) return { isPreseason: true, isPlayoffs: false, isRegularSeason: false, isEarlySeason: false }
  if (type === 1) return { isPreseason: true, isPlayoffs: false, isRegularSeason: false, isEarlySeason: false }
  if (type === 3 || type === 5) {
    const series = comp?.series
    const played = gamesPlayed(series?.summary)
    return { isPreseason: false, isPlayoffs: true, isRegularSeason: false, isEarlySeason: false, playoffRound: series?.title ?? comp?.notes?.[0]?.headline, seriesGame: played !== undefined ? played + 1 : undefined }
  }
  return { ...REGULAR, isEarlySeason: early(sport, startTime) }
}

/**
 * What kind of game this is: preseason, playoffs or regular season, plus an early-season flag. Cached an hour; when the
 * lookup fails the game is treated as an ordinary regular-season game rather than guessed otherwise.
 */
export async function detectGameContext(game: { sport: Sport; gameId: string; startTime: string | null }): Promise<SeasonContext> {
  const out = await cached(`edges:season:${game.sport}:${game.gameId}`, 3600, async () => {
    try {
      if (game.sport === 'mlb') return await mlbContext(game.gameId, game.startTime)
      if (game.sport === 'nfl') return await nflContext(game.gameId, game.startTime)
      if (game.sport === 'nhl') return nhlContext(game.gameId, game.startTime)
      return await espnContext(game.sport, game.gameId, game.startTime)
    } catch (err) {
      reportError(err, 'season-context')
      return { ...REGULAR }
    }
  })
  return out ?? { ...REGULAR }
}

/** Playoff evidence weights from the spec: team trends fade, matchup and recent form rise, sample minimums double. */
export const PLAYOFF_WEIGHTS = { teamTrend: 0.6, matchup: 1.4, recentForm: 1.5, minSampleScale: 2, sharpGap: 0.06 } as const
