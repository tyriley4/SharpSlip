import { fetchJson } from '../mlb/fetchJson'
import { getVenueWeather, impactNotes, type ImpactNote, type WeatherStatus } from '@/lib/weather/api'
import { getNFLSchedule } from './api'
import { normalizeNflAbbr, NFL_TEAM_CITY } from './divisions'
import { getNFLGameMatchup, type NFLGameMatchup } from './gameBreakdown'

function n(v: string | undefined): number {
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : 0
}

export interface NFLStadiumInfo {
  name: string
  city: string
  roof: string
  surface: string
  indoor: boolean
}

export interface NFLWeatherInfo {
  available: boolean
  status: WeatherStatus
  reason?: string
  indoor: boolean
  tempF: number | null
  feelsLikeF: number | null
  windMph: number | null
  windFrom: string | null
  conditions: string | null
  humidityPct: number | null
  precipChancePct: number | null
  snow: boolean
  notes: ImpactNote[]
}

/** Kickoff as an ISO instant. nflverse gives the date and an Eastern-time clock; DST runs ~Mar–early Nov. */
export function kickoffIso(gameday: string, gametime: string): string | null {
  if (!gameday || !/^d{1,2}:d{2}/.test(gametime)) return null
  const month = Number(gameday.slice(5, 7))
  const offset = month >= 4 && month <= 10 ? '-04:00' : month === 11 && Number(gameday.slice(8, 10)) < 3 ? '-04:00' : '-05:00'
  const t = new Date(`${gameday}T${gametime.padStart(5, '0')}:00${offset}`)
  return Number.isNaN(t.getTime()) ? null : t.toISOString()
}

export async function getNFLWeather(city: string, indoor: boolean, kickoff: string | null = null): Promise<NFLWeatherInfo> {
  if (indoor) {
    return { available: true, status: 'ok', indoor: true, tempF: null, feelsLikeF: null, windMph: null, windFrom: null, conditions: 'Indoor — weather neutral', humidityPct: null, precipChancePct: null, snow: false, notes: [] }
  }
  const w = await getVenueWeather(city, { gameTime: kickoff })
  return {
    available: w.status === 'ok',
    status: w.status,
    reason: w.message,
    indoor: false,
    tempF: w.tempF,
    feelsLikeF: w.feelsLikeF,
    windMph: w.windMph,
    windFrom: w.windFrom,
    conditions: w.conditions,
    humidityPct: w.humidityPct,
    precipChancePct: w.precipChancePct,
    snow: w.snow,
    notes: impactNotes(w, 'nfl'),
  }
}

export interface NFLHomeEdge {
  homeWinPct: number | null
  atsHome: { wins: number; losses: number; pct: number } | null
  overUnderHome: { wins: number; losses: number; pct: number } | null
  crowdNoiseNote: string
}

export async function getNFLHomeEdge(homeTeamAbbr: string, season: number): Promise<NFLHomeEdge> {
  const schedule = await getNFLSchedule(season)
  if (!schedule) return { homeWinPct: null, atsHome: null, overUnderHome: null, crowdNoiseNote: 'Data unavailable.' }

  const homeGames = schedule.filter(
    (r) => r.game_type === 'REG' && r.home_score !== '' && r.away_score !== '' && normalizeNflAbbr(r.home_team) === homeTeamAbbr
  )
  if (homeGames.length === 0) return { homeWinPct: null, atsHome: null, overUnderHome: null, crowdNoiseNote: 'No home games played yet.' }

  let wins = 0
  let atsW = 0
  let atsTotal = 0
  let overW = 0
  let overTotal = 0
  for (const g of homeGames) {
    const my = n(g.home_score)
    const opp = n(g.away_score)
    if (my > opp) wins++
    if (g.spread_line) {
      atsTotal++
      const covered = my - opp - Number(g.spread_line) > 0
      if (covered) atsW++
    }
    if (g.total_line) {
      overTotal++
      if (n(g.total) > Number(g.total_line)) overW++
    }
  }

  const homeWinPct = Math.round((wins / homeGames.length) * 1000) / 10
  const crowdNoiseNote =
    homeWinPct >= 70 ? 'Deafening — one of the toughest road environments in the league.' : homeWinPct >= 55 ? 'Loud — a real home-field factor.' : homeWinPct >= 40 ? 'Moderate home-field impact.' : 'Minimal home-field impact this season.'

  return {
    homeWinPct,
    atsHome: atsTotal > 0 ? { wins: atsW, losses: atsTotal - atsW, pct: Math.round((atsW / atsTotal) * 1000) / 10 } : null,
    overUnderHome: overTotal > 0 ? { wins: overW, losses: overTotal - overW, pct: Math.round((overW / overTotal) * 1000) / 10 } : null,
    crowdNoiseNote,
  }
}

export interface NFLStadiumHistorySeason {
  season: number
  homeWins: number
  homeLosses: number
  atsWins: number
  atsLosses: number
  avgTotalPoints: number
}

export async function getNFLStadiumHistory(homeTeamAbbr: string, currentSeason: number): Promise<NFLStadiumHistorySeason[]> {
  const seasons = [currentSeason - 1, currentSeason - 2, currentSeason - 3]
  const results = await Promise.all(
    seasons.map(async (season): Promise<NFLStadiumHistorySeason | null> => {
      const schedule = await getNFLSchedule(season)
      if (!schedule) return null
      const homeGames = schedule.filter(
        (r) => r.game_type === 'REG' && r.home_score !== '' && r.away_score !== '' && normalizeNflAbbr(r.home_team) === homeTeamAbbr
      )
      if (homeGames.length === 0) return null

      let homeWins = 0
      let atsW = 0
      let atsTotal = 0
      let totalPoints = 0
      for (const g of homeGames) {
        const my = n(g.home_score)
        const opp = n(g.away_score)
        if (my > opp) homeWins++
        totalPoints += my + opp
        if (g.spread_line) {
          atsTotal++
          if (my - opp - Number(g.spread_line) > 0) atsW++
        }
      }

      return {
        season,
        homeWins,
        homeLosses: homeGames.length - homeWins,
        atsWins: atsW,
        atsLosses: atsTotal - atsW,
        avgTotalPoints: Math.round((totalPoints / homeGames.length) * 10) / 10,
      }
    })
  )
  return results.filter((r): r is NFLStadiumHistorySeason => r !== null)
}

export interface NFLBetImpactCard {
  title: string
  detail: string
  affects: string[]
}

export function getNFLBetImpactCards(weather: NFLWeatherInfo, homeEdge: NFLHomeEdge, history: NFLStadiumHistorySeason[]): NFLBetImpactCard[] {
  const cards: NFLBetImpactCard[] = []

  if (!weather.indoor && weather.available && (weather.windMph ?? 0) > 15) {
    cards.push({
      title: 'High Wind — Passing Affected',
      detail: `Wind at ${weather.windMph?.toFixed(0)} mph — this trend favors a run-heavy game script and the under.`,
      affects: ['Under', 'Passing Props'],
    })
  }

  if (!weather.indoor && weather.available && weather.tempF !== null && weather.tempF < 32) {
    cards.push({
      title: 'Cold Weather Game',
      detail: `${weather.tempF.toFixed(0)}°F at kickoff — expect lower scoring and a run-heavier approach.`,
      affects: ['Under'],
    })
  }

  if (!weather.indoor && weather.available && weather.conditions?.toLowerCase().includes('snow')) {
    cards.push({ title: 'Snow', detail: 'Snow in the forecast — a major factor. Historically, snow games have skewed toward lower totals and more rushing.', affects: ['Under', 'Run Game'] })
  }

  if (weather.indoor) {
    cards.push({ title: 'Indoor Venue', detail: 'Dome/closed roof — weather is a non-factor for this game.', affects: ['Neutral'] })
  }

  if (homeEdge.homeWinPct !== null && homeEdge.homeWinPct >= 65) {
    cards.push({ title: 'Strong Home-Field Edge', detail: `${homeEdge.homeWinPct.toFixed(0)}% home win rate this season — real edge for the home side.`, affects: ['Moneyline', 'Spread'] })
  }

  if (history.length > 0) {
    const avgHistTotal = history.reduce((s, h) => s + h.avgTotalPoints, 0) / history.length
    if (avgHistTotal > 0) {
      cards.push({
        title: 'Historical Scoring at This Venue',
        detail: `Averaging ${avgHistTotal.toFixed(1)} combined points per home game over the last ${history.length} season${history.length !== 1 ? 's' : ''}.`,
        affects: ['Totals'],
      })
    }
  }

  return cards.slice(0, 4)
}

export interface NFLStadiumTabData {
  stadium: NFLStadiumInfo
  weather: NFLWeatherInfo
  homeEdge: NFLHomeEdge
  history: NFLStadiumHistorySeason[]
  betImpact: NFLBetImpactCard[]
}

function stadiumFromMatchup(matchup: NFLGameMatchup): NFLStadiumInfo {
  const indoor = matchup.venue.roof === 'dome' || matchup.venue.roof === 'closed'
  return {
    name: matchup.venue.stadium,
    city: NFL_TEAM_CITY[matchup.home.abbr] ?? '—',
    roof: matchup.venue.roof,
    surface: matchup.venue.surface,
    indoor,
  }
}

export async function getNFLStadiumTabData(gameId: string): Promise<NFLStadiumTabData | null> {
  const matchup = await getNFLGameMatchup(gameId)
  if (!matchup) return null

  const stadium = stadiumFromMatchup(matchup)
  const [weather, homeEdge, history] = await Promise.all([
    getNFLWeather(stadium.city, stadium.indoor, kickoffIso(matchup.gameday, matchup.gametime)),
    getNFLHomeEdge(matchup.home.abbr, matchup.season),
    getNFLStadiumHistory(matchup.home.abbr, matchup.season),
  ])

  const betImpact = getNFLBetImpactCards(weather, homeEdge, history)

  return { stadium, weather, homeEdge, history, betImpact }
}
