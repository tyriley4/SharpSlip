import { cached } from '@/lib/net/ttlCache'
import type { Sport } from '@/lib/sport/SportContext'
import type { CareerStage, PlayerHistory } from '../types'

/**
 * Career stage from age and professional experience. The stage decides how much a player's own history counts: an
 * ascending player's career is context while the current season leads; a declining veteran's career flatters him, so the
 * last two seasons are the baseline. Ages come from the league feeds (MLB Stats API, ESPN for the NFL, the NHL API); the
 * NBA's own feed publishes no age, so NBA players carry no stage.
 */

const get = async <T>(url: string): Promise<T | null> => {
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

const ageOf = (birth: string) => {
  const b = Date.parse(birth)
  return Number.isFinite(b) ? Math.floor((Date.now() - b) / (365.25 * 86400000)) : null
}

const SKILL = ['QB', 'RB', 'WR', 'TE', 'HB', 'FB']

/** Classify from age and experience using the per-sport bands. */
export function classifyStage(sport: Sport, age: number | null, years: number | null, position: string, pitching: boolean): CareerStage | null {
  if (age === null) return null
  const exp = years ?? 99
  const young = sport === 'mlb' ? age < 28 && exp < 4 : sport === 'nhl' ? age < 25 && exp < 4 : age < 26 && exp < 4
  const vet =
    sport === 'mlb'
      ? pitching
        ? age >= 33
        : age >= 35
      : sport === 'nfl' || sport === 'cfb'
        ? age >= 30 && SKILL.includes(position.toUpperCase())
        : age >= 32
  const stage: CareerStage['stage'] = young ? 'ascending' : vet ? 'declining' : 'prime'
  const label =
    stage === 'ascending'
      ? 'ascending player — recent trajectory weighted heavily'
      : stage === 'declining'
        ? 'veteran — the last two seasons are the baseline; career averages include peak years'
        : 'prime years — career and current season both count'
  return { stage, age, years, label }
}

export async function loadCareerStage(sport: Sport, history: PlayerHistory, opts: { pitching?: boolean } = {}): Promise<CareerStage | null> {
  if (sport !== 'mlb' && sport !== 'nfl' && sport !== 'nhl') return null
  const key = `edges:stage:${sport}:${history.playerId}:${opts.pitching ? 'p' : 'h'}`
  return cached(key, 86400, async () => {
    const year = new Date().getUTCFullYear()
    if (sport === 'mlb') {
      const d = await get<{ people?: { birthDate?: string; mlbDebutDate?: string; primaryPosition?: { abbreviation?: string } }[] }>(`https://statsapi.mlb.com/api/v1/people/${history.playerId}?fields=people,birthDate,mlbDebutDate,primaryPosition,abbreviation`)
      const p = d?.people?.[0]
      if (!p?.birthDate) return null
      const debut = p.mlbDebutDate ? Number(p.mlbDebutDate.slice(0, 4)) : null
      return classifyStage('mlb', ageOf(p.birthDate), debut ? year - debut + 1 : null, p.primaryPosition?.abbreviation ?? '', !!opts.pitching)
    }
    if (sport === 'nfl') {
      const d = await get<{ athlete?: { age?: number; debutYear?: number; position?: { abbreviation?: string } } }>(`https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${history.playerId}`)
      const a = d?.athlete
      if (!a || typeof a.age !== 'number') return null
      return classifyStage('nfl', a.age, a.debutYear ? year - a.debutYear + 1 : null, a.position?.abbreviation ?? history.position, false)
    }
    const d = await get<{ birthDate?: string; seasonTotals?: { leagueAbbrev?: string; season?: number }[] }>(`https://api-web.nhle.com/v1/player/${history.playerId}/landing`)
    if (!d?.birthDate) return null
    const seasons = new Set((d.seasonTotals ?? []).filter((s) => s.leagueAbbrev === 'NHL').map((s) => s.season))
    return classifyStage('nhl', ageOf(d.birthDate), seasons.size || null, history.position, false)
  })
}
