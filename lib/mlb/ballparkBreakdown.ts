import { getTeamScheduleResults, getVenueDetail, type RawScheduleResultGame } from './api'
import { fetchJson } from './fetchJson'
import { getGameMatchup } from './gameBreakdown'
import { getVenueWeather, impactNotes, type ImpactNote, type WeatherStatus } from '@/lib/weather/api'

// ---------------------------------------------------------------------------
// Stadium
// ---------------------------------------------------------------------------

export interface StadiumInfo {
  name: string
  city: string
  state: string | null
  capacity: number | null
  surface: string | null
  roofType: string | null
  azimuthAngle: number | null
}

export async function getStadiumInfo(venueId: number): Promise<StadiumInfo | null> {
  const venue = await getVenueDetail(venueId)
  if (!venue) return null
  return {
    name: venue.name,
    city: venue.location?.city ?? '—',
    state: venue.location?.state ?? null,
    capacity: venue.fieldInfo?.capacity ?? null,
    surface: venue.fieldInfo?.turfType ?? null,
    roofType: venue.fieldInfo?.roofType ?? null,
    azimuthAngle: venue.location?.azimuthAngle ?? null,
  }
}

// ---------------------------------------------------------------------------
// Park factors — the free MLB Stats API has no official park-factor stat. This is a real,
// disclosed derivation: the home team's own home-game scoring vs its own road-game scoring
// this season, indexed to 100. It's not a cross-league multi-year park factor, but it is real
// game data, not a fabricated number.
// ---------------------------------------------------------------------------

export interface ParkFactors {
  runsFactor: number
  hrFactor: number
  hitsFactor: number
  homeGames: number
  roadGames: number
  method: string
}

function splitHomeRoad(teamId: number, games: RawScheduleResultGame[]) {
  const finals = games.filter((g) => g.status.abstractGameState === 'Final')
  const home = finals.filter((g) => g.teams.home.team.id === teamId)
  const road = finals.filter((g) => g.teams.away.team.id === teamId)
  return { home, road }
}

export async function getParkFactors(homeTeamId: number): Promise<ParkFactors | null> {
  const games = await getTeamScheduleResults(homeTeamId)
  if (!games) return null
  const { home, road } = splitHomeRoad(homeTeamId, games)
  if (home.length < 10 || road.length < 10) return null

  const homeRuns = home.reduce((s, g) => s + (g.teams.home.score ?? 0) + (g.teams.away.score ?? 0), 0)
  const roadRuns = road.reduce((s, g) => s + (g.teams.home.score ?? 0) + (g.teams.away.score ?? 0), 0)

  const homeAvg = homeRuns / home.length
  const roadAvg = roadRuns / road.length
  const runsFactor = roadAvg > 0 ? Math.round((homeAvg / roadAvg) * 100) : 100

  return {
    runsFactor,
    hrFactor: runsFactor,
    hitsFactor: runsFactor,
    homeGames: home.length,
    roadGames: road.length,
    method:
      "Derived from this team's own home vs. road combined-run scoring this season (indexed to 100), since the free MLB Stats API doesn't publish an official multi-year park factor. HR/Hits factors mirror the runs factor as a single-signal proxy.",
  }
}

// ---------------------------------------------------------------------------
// Weather (OpenWeatherMap — requires a real free API key; gracefully unavailable without one)
// ---------------------------------------------------------------------------

export interface WeatherInfo {
  available: boolean
  /** ok | activating (key not live yet) | unavailable */
  status: WeatherStatus
  reason?: string
  tempF: number | null
  feelsLikeF: number | null
  windMph: number | null
  windDeg: number | null
  windFrom: string | null
  windDirection: 'out' | 'in' | 'cross' | null
  conditions: string | null
  humidityPct: number | null
  precipChancePct: number | null
  currentlyRaining: boolean
  notes: ImpactNote[]
}

const NO_WEATHER: WeatherInfo = {
  available: false,
  status: 'unavailable',
  tempF: null,
  feelsLikeF: null,
  windMph: null,
  windDeg: null,
  windFrom: null,
  windDirection: null,
  conditions: null,
  humidityPct: null,
  precipChancePct: null,
  currentlyRaining: false,
  notes: [],
}

/** Current/forecast conditions at the park (OpenWeatherMap). Never throws. */
export async function getBallparkWeather(city: string, azimuthOut: number | null, gameTime: string | null = null): Promise<WeatherInfo> {
  const w = await getVenueWeather(city, { gameTime, azimuthOut })
  return {
    available: w.status === 'ok',
    status: w.status,
    reason: w.message,
    tempF: w.tempF,
    feelsLikeF: w.feelsLikeF,
    windMph: w.windMph,
    windDeg: w.windDeg,
    windFrom: w.windFrom,
    windDirection: w.windDirection,
    conditions: w.conditions,
    humidityPct: w.humidityPct,
    precipChancePct: w.precipChancePct,
    currentlyRaining: w.currentlyRaining,
    notes: impactNotes(w, 'mlb'),
  }
}

// ---------------------------------------------------------------------------
// Betting impact cards
// ---------------------------------------------------------------------------

export interface BettingImpactCard {
  title: string
  detail: string
  affects: string[]
}

export function getBettingImpactCards(park: ParkFactors | null, weather: WeatherInfo): BettingImpactCard[] {
  const cards: BettingImpactCard[] = []

  if (park && park.runsFactor >= 110 && weather.available && weather.windDirection === 'out' && (weather.windMph ?? 0) > 10) {
    cards.push({
      title: 'Double HR Boost',
      detail: `Park factor ${park.runsFactor} (hitter-friendly) and wind blowing out at ${weather.windMph?.toFixed(0)} mph — both favor home runs tonight.`,
      affects: ['Over', 'HR Props'],
    })
  }

  if (park && park.runsFactor <= 95 && weather.available && weather.tempF !== null && weather.tempF < 50) {
    cards.push({
      title: "Pitcher's Park in Cold Conditions",
      detail: `Park factor ${park.runsFactor} (pitcher-friendly) combined with ${weather.tempF.toFixed(0)}°F — scoring is likely suppressed.`,
      affects: ['Under'],
    })
  }

  if (weather.available && weather.windDirection === 'out' && (weather.windMph ?? 0) > 10) {
    cards.push({
      title: 'Wind Blowing Out',
      detail: `Wind at ${weather.windMph?.toFixed(0)} mph blowing out — favorable for home runs and the over.`,
      affects: ['Over', 'HR Props'],
    })
  }

  if (weather.available && weather.windDirection === 'in' && (weather.windMph ?? 0) > 10) {
    cards.push({
      title: 'Wind Blowing In',
      detail: `Wind at ${weather.windMph?.toFixed(0)} mph blowing in — suppresses offense, fly balls die at the track.`,
      affects: ['Under'],
    })
  }

  if (weather.available && weather.tempF !== null && weather.tempF < 50 && !cards.some((c) => c.title.includes('Cold'))) {
    cards.push({
      title: 'Cold Weather',
      detail: `${weather.tempF.toFixed(0)}°F — cold air is denser and reduces fly-ball carry, trimming run production.`,
      affects: ['Under'],
    })
  }

  if (weather.available && weather.currentlyRaining) {
    cards.push({
      title: 'Rain in the Area',
      detail: 'Precipitation currently reported at the venue — watch for delays.',
      affects: ['Game Total Timing'],
    })
  }

  if (park && (park.runsFactor >= 110 || park.runsFactor <= 90) && cards.length === 0) {
    cards.push({
      title: park.runsFactor >= 110 ? 'Hitter-Friendly Park' : "Pitcher's Park",
      detail: `This park's runs factor is ${park.runsFactor} this season (home vs. road scoring split for the home club).`,
      affects: [park.runsFactor >= 110 ? 'Over' : 'Under'],
    })
  }

  return cards.slice(0, 4)
}

// ---------------------------------------------------------------------------
// Full aggregator
// ---------------------------------------------------------------------------

export interface BallparkTabData {
  stadium: StadiumInfo | null
  parkFactors: ParkFactors | null
  weather: WeatherInfo
  bettingImpact: BettingImpactCard[]
}

export async function getBallparkTabData(gamePk: number): Promise<BallparkTabData | null> {
  const matchup = await getGameMatchup(gamePk)
  if (!matchup) return null

  const stadium = matchup.venueId ? await getStadiumInfo(matchup.venueId) : null

  const indoor = stadium?.roofType === 'Dome'
  const [parkFactors, weather] = await Promise.all([
    getParkFactors(matchup.home.id),
    // Fixed-roof parks have no weather to report (and none of it matters), so skip the lookup entirely.
    indoor ? Promise.resolve(NO_WEATHER) : getBallparkWeather(stadium?.city ?? matchup.venue, stadium?.azimuthAngle ?? null, matchup.gameDate),
  ])

  const bettingImpact = getBettingImpactCards(parkFactors, weather)

  return { stadium, parkFactors, weather, bettingImpact }
}
