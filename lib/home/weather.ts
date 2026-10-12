import { getTodaysGames as getTodaysMlbGames } from '@/lib/mlb/api'
import { mapScheduleGame } from '@/lib/mlb/mappers'
import { getBallparkWeather, getStadiumInfo } from '@/lib/mlb/ballparkBreakdown'
import { getGameMatchup as getMlbGameMatchup } from '@/lib/mlb/gameBreakdown'
import { getActiveNFLSeason, getNFLSchedule } from '@/lib/nfl/api'
import { mapCurrentWeekGames } from '@/lib/nfl/mappers'
import { normalizeNflAbbr, NFL_TEAM_CITY } from '@/lib/nfl/divisions'
import { getNFLGameMatchup } from '@/lib/nfl/gameBreakdown'
import { getNFLWeather, kickoffIso } from '@/lib/nfl/stadiumBreakdown'
import type { WeatherStatus } from '@/lib/weather/api'

export interface WeatherWatchCard {
  sport: 'mlb' | 'nfl'
  gameId: string
  matchup: string
  venue: string
  /** 'activating' = the OpenWeatherMap key was just created and isn't live yet. */
  status: WeatherStatus
  tempF: number | null
  windMph: number | null
  windFrom: string | null
  windDirection: 'out' | 'in' | 'cross' | null
  conditions: string | null
  precipChancePct: number | null
  precipConcern: boolean
  impactNote: string
  href: string
}

/** A game makes the Weather Watch when conditions could move the line: wind 10+, under 45°F, 30%+ precipitation, or snow. */
function worthWatching(windMph: number | null, tempF: number | null, precipChancePct: number | null, rainingNow: boolean, snow: boolean): boolean {
  return (windMph ?? 0) >= 10 || (tempF !== null && tempF < 45) || (precipChancePct ?? 0) >= 30 || rainingNow || snow
}

function activatingCard(sport: 'mlb' | 'nfl', gameId: string, matchup: string, venue: string, href: string): WeatherWatchCard {
  return {
    sport,
    gameId,
    matchup,
    venue,
    status: 'activating',
    tempF: null,
    windMph: null,
    windFrom: null,
    windDirection: null,
    conditions: null,
    precipChancePct: null,
    precipConcern: false,
    impactNote: 'Weather data activating — check back shortly',
    href,
  }
}

async function todaysMlbWeather(): Promise<WeatherWatchCard[]> {
  const raw = await getTodaysMlbGames()
  if (!raw) return []
  const games = raw.map(mapScheduleGame).filter((g) => g.status !== 'Final')

  const cards = await Promise.all(
    games.slice(0, 15).map(async (g): Promise<WeatherWatchCard | null> => {
      try {
        const matchup = await getMlbGameMatchup(g.id)
        if (!matchup) return null
        const stadium = await getStadiumInfo(matchup.venueId)
        if (!stadium || stadium.roofType === 'Dome') return null

        const label = `${g.away.abbr} @ ${g.home.abbr}`
        const weather = await getBallparkWeather(stadium.city, stadium.azimuthAngle, matchup.gameDate)
        if (weather.status === 'activating') return activatingCard('mlb', String(g.id), label, stadium.name, `/games/${g.id}`)
        if (!weather.available) return null
        if (!worthWatching(weather.windMph, weather.tempF, weather.precipChancePct, weather.currentlyRaining, false)) return null

        return {
          sport: 'mlb',
          gameId: String(g.id),
          matchup: label,
          venue: stadium.name,
          status: 'ok',
          tempF: weather.tempF,
          windMph: weather.windMph,
          windFrom: weather.windFrom,
          windDirection: weather.windDirection,
          conditions: weather.conditions,
          precipChancePct: weather.precipChancePct,
          precipConcern: weather.currentlyRaining || (weather.precipChancePct ?? 0) >= 30,
          impactNote: weather.notes[0]?.text ?? 'Worth monitoring before first pitch.',
          href: `/games/${g.id}`,
        }
      } catch (err) {
        console.error(`[home/weather] MLB game ${g.id} failed:`, err)
        return null
      }
    })
  )

  return cards.filter((c): c is WeatherWatchCard => c !== null)
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

async function upcomingNflWeather(): Promise<WeatherWatchCard[]> {
  const schedule = await getNFLSchedule(await getActiveNFLSeason())
  if (!schedule) return []
  const today = new Date().toISOString().slice(0, 10)
  const horizon = addDays(today, 2)
  const games = mapCurrentWeekGames(schedule).filter((g) => g.gameday >= today && g.gameday <= horizon)
  if (games.length === 0) return []

  const cards = await Promise.all(
    games.map(async (g): Promise<WeatherWatchCard | null> => {
      try {
        const matchup = await getNFLGameMatchup(g.id)
        if (!matchup) return null
        if (matchup.venue.roof === 'dome' || matchup.venue.roof === 'closed') return null

        const label = `${g.away.abbr} @ ${g.home.abbr}`
        const city = NFL_TEAM_CITY[normalizeNflAbbr(matchup.home.abbr)] ?? matchup.venue.stadium
        const weather = await getNFLWeather(city, false, kickoffIso(matchup.gameday, matchup.gametime))
        if (weather.status === 'activating') return activatingCard('nfl', g.id, label, matchup.venue.stadium, `/games/${g.id}`)
        if (!weather.available) return null
        if (!worthWatching(weather.windMph, weather.tempF, weather.precipChancePct, false, weather.snow)) return null

        return {
          sport: 'nfl',
          gameId: g.id,
          matchup: label,
          venue: matchup.venue.stadium,
          status: 'ok',
          tempF: weather.tempF,
          windMph: weather.windMph,
          windFrom: weather.windFrom,
          windDirection: null,
          conditions: weather.conditions,
          precipChancePct: weather.precipChancePct,
          precipConcern: weather.snow || (weather.precipChancePct ?? 0) >= 30,
          impactNote: weather.notes[0]?.text ?? 'Worth monitoring before kickoff.',
          href: `/games/${g.id}`,
        }
      } catch (err) {
        console.error(`[home/weather] NFL game ${g.id} failed:`, err)
        return null
      }
    })
  )

  return cards.filter((c): c is WeatherWatchCard => c !== null)
}

export async function getWeatherWatchCards(): Promise<WeatherWatchCard[]> {
  const [mlb, nfl] = await Promise.all([todaysMlbWeather().catch(() => []), upcomingNflWeather().catch(() => [])])
  const all = [...mlb, ...nfl]
  // While the API key is still activating every card says the same thing; collapse them into one notice.
  const pending = all.filter((c) => c.status === 'activating')
  if (pending.length > 0) return [pending[0]]
  return all
}
