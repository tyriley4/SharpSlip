import { cachedResult, fetchJsonSafe } from '@/lib/net/ttlCache'

/**
 * OpenWeatherMap lookups for outdoor venues (current conditions + the 3-hour forecast for chance of
 * precipitation). Cached 30 minutes. A brand-new key can take up to ~2 hours to activate and answers
 * 401 until then; that is reported as `activating` rather than as an error.
 */

const BASE = 'https://api.openweathermap.org/data/2.5'
const TTL = 1800

export type WeatherStatus = 'ok' | 'activating' | 'unavailable'

export interface WeatherReport {
  status: WeatherStatus
  /** Human-readable reason when status isn't ok. */
  message?: string
  tempF: number | null
  feelsLikeF: number | null
  windMph: number | null
  windGustMph: number | null
  windDeg: number | null
  /** Compass point the wind is coming FROM, e.g. "SW". */
  windFrom: string | null
  /** Relative to the field's orientation (MLB only, when the park azimuth is known). */
  windDirection: 'out' | 'in' | 'cross' | null
  conditions: string | null
  humidityPct: number | null
  /** Chance of precipitation (0–100) from the nearest forecast slot. */
  precipChancePct: number | null
  currentlyRaining: boolean
  snow: boolean
  /** ISO time the numbers are for (now, or the forecast slot nearest the game). */
  validFor: string | null
}

export interface ImpactNote {
  text: string
  tone: 'over' | 'under' | 'caution'
}

type Json = Record<string, any>

const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
export function compass(deg: number): string {
  return POINTS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16]
}

/** Wind relative to the outfield: `azimuthOut` is the compass bearing from home plate to center field. */
export function classifyWind(windFromDeg: number, azimuthOut: number): 'out' | 'in' | 'cross' {
  const blowsToward = (windFromDeg + 180) % 360
  const diff = Math.min(Math.abs(blowsToward - azimuthOut), 360 - Math.abs(blowsToward - azimuthOut))
  if (diff <= 45) return 'out'
  if (diff >= 135) return 'in'
  return 'cross'
}

const EMPTY: WeatherReport = {
  status: 'unavailable',
  tempF: null,
  feelsLikeF: null,
  windMph: null,
  windGustMph: null,
  windDeg: null,
  windFrom: null,
  windDirection: null,
  conditions: null,
  humidityPct: null,
  precipChancePct: null,
  currentlyRaining: false,
  snow: false,
  validFor: null,
}

const ACTIVATING_MESSAGE = 'Weather data activating — check back shortly'

async function call(path: string, city: string): Promise<{ data: Json | null; keyPending: boolean }> {
  const key = process.env.OPENWEATHERMAP_API_KEY
  if (!key) return { data: null, keyPending: false }
  const url = `${BASE}${path}?q=${encodeURIComponent(city)}&appid=${key}&units=imperial`
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (res.status === 401) return { data: null, keyPending: true }
    if (!res.ok) {
      console.error(`[weather] ${path} ${res.status} for "${city}"`)
      return { data: null, keyPending: false }
    }
    return { data: (await res.json()) as Json, keyPending: false }
  } catch (err) {
    console.error(`[weather] ${path} failed for "${city}":`, (err as Error).message)
    return { data: null, keyPending: false }
  }
}

/** Cities whose last lookup was rejected with 401 (key not active yet). Keyed per city so concurrent lookups don't mislabel each other. */
const pendingKey = new Set<string>()

async function load(city: string, gameTime: string | null, azimuthOut: number | null): Promise<WeatherReport | null> {
  const [now, forecast] = await Promise.all([call('/weather', city), call('/forecast', city)])
  if (now.keyPending || forecast.keyPending) {
    pendingKey.add(city)
    return null // not cached, so the next view retries immediately
  }
  const cur = now.data
  if (!cur) return null

  // Pick the forecast slot nearest the game (or the next slot when no start time is known).
  const slots: Json[] = forecast.data?.list ?? []
  const target = gameTime ? Date.parse(gameTime) : Date.now()
  const slot = slots.length
    ? slots.reduce((best, s) => (Math.abs(s.dt * 1000 - target) < Math.abs(best.dt * 1000 - target) ? s : best), slots[0])
    : null
  // Within ~3h (or no game time) the live reading is the best estimate; beyond that use the forecast slot.
  const useForecast = !!slot && !!gameTime && target - Date.now() > 3 * 3600 * 1000
  const src: Json = useForecast ? slot! : cur

  const windDeg = typeof src.wind?.deg === 'number' ? src.wind.deg : null
  const main = String(src.weather?.[0]?.main ?? '').toLowerCase()
  const pop = typeof slot?.pop === 'number' ? Math.round(slot.pop * 100) : null
  return {
    status: 'ok',
    tempF: src.main?.temp ?? null,
    feelsLikeF: src.main?.feels_like ?? null,
    windMph: src.wind?.speed ?? null,
    windGustMph: src.wind?.gust ?? null,
    windDeg,
    windFrom: windDeg !== null ? compass(windDeg) : null,
    windDirection: windDeg !== null && azimuthOut !== null ? classifyWind(windDeg, azimuthOut) : null,
    conditions: src.weather?.[0]?.description ?? null,
    humidityPct: src.main?.humidity ?? null,
    precipChancePct: pop,
    currentlyRaining: !useForecast && Boolean(cur.rain?.['1h'] ?? cur.rain?.['3h']),
    snow: main === 'snow' || Boolean(src.snow),
    validFor: useForecast ? new Date(slot!.dt * 1000).toISOString() : new Date().toISOString(),
  }
}

/** Weather at a venue's city. Never throws; `status` tells the UI what to say. */
export async function getVenueWeather(city: string, options: { gameTime?: string | null; azimuthOut?: number | null } = {}): Promise<WeatherReport> {
  if (!process.env.OPENWEATHERMAP_API_KEY) return { ...EMPTY, message: 'Weather isn’t configured (OPENWEATHERMAP_API_KEY is missing).' }
  const gameTime = options.gameTime ?? null
  // Bucket the game time to the hour so one cached entry serves every caller for that game.
  const bucket = gameTime ? gameTime.slice(0, 13) : 'now'
  const azimuth = options.azimuthOut ?? null
  pendingKey.delete(city)
  const r = await cachedResult(`weather:${city}:${bucket}:${azimuth ?? '-'}`, TTL, () => load(city, gameTime, azimuth), { maxStaleSeconds: 6 * 3600 })
  if (!r.value) {
    return pendingKey.has(city) ? { ...EMPTY, status: 'activating', message: ACTIVATING_MESSAGE } : { ...EMPTY, message: 'Weather temporarily unavailable.' }
  }
  if (r.origin === 'live') console.log(`[weather] ${city}: ok (${r.value.tempF?.toFixed(0) ?? '—'}°F, ${r.value.windMph?.toFixed(0) ?? '—'} mph, precip ${r.value.precipChancePct ?? '—'}%)`)
  return r.value
}

/**
 * Betting-impact notes from the numbers. `sport` shapes the wording: wind direction only means
 * something at a ballpark, and rain delays matter most in baseball.
 */
export function impactNotes(w: WeatherReport, sport: 'mlb' | 'nfl'): ImpactNote[] {
  if (w.status !== 'ok') return []
  const notes: ImpactNote[] = []
  const wind = w.windMph ?? 0
  if (sport === 'mlb' && wind >= 10) {
    if (w.windDirection === 'out') notes.push({ text: `Wind ${wind.toFixed(0)} mph blowing out — favorable for HRs and the Over.`, tone: 'over' })
    else if (w.windDirection === 'in') notes.push({ text: `Wind ${wind.toFixed(0)} mph blowing in — suppresses offense; historical data supports the Under.`, tone: 'under' })
    else notes.push({ text: `Wind ${wind.toFixed(0)} mph across the field — watch fly-ball carry.`, tone: 'caution' })
  } else if (sport === 'nfl' && wind >= 15) {
    notes.push({ text: `Wind ${wind.toFixed(0)} mph — hurts the deep passing game and kicking; this trend supports the Under and the run game.`, tone: 'under' })
  }
  if (w.snow) notes.push({ text: 'Snow — a major factor; this trend supports the Under and the run game.', tone: 'under' })
  if (w.tempF !== null && w.tempF < 45) notes.push({ text: 'Cold weather game — expect lower scoring.', tone: 'under' })
  if (!w.snow && ((w.precipChancePct ?? 0) >= 30 || w.currentlyRaining)) {
    notes.push({ text: `${w.currentlyRaining ? 'Rain now' : `${w.precipChancePct}% chance of precipitation`} — watch for delays.`, tone: 'caution' })
  }
  return notes
}
