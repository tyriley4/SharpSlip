import { toEspnAbbr, fromEspnAbbr } from '@/lib/espn/teams'
import { cached, fetchJsonSafe } from '@/lib/net/ttlCache'
import type { Sport } from '@/lib/sport/SportContext'
import type { TeamGameRecord } from '../types'

type Json = Record<string, any>

const PATH: Record<Sport, string> = {
  nfl: 'football/nfl',
  cfb: 'football/college-football',
  mlb: 'baseball/mlb',
  nba: 'basketball/nba',
  cbb: 'basketball/mens-college-basketball',
  nhl: 'hockey/nhl',
}

const num = (v: unknown) => (typeof v === 'number' ? v : Number.isFinite(Number(v)) && v !== '' && v !== null && v !== undefined ? Number(v) : null)

/**
 * A team's finished postseason games this season. The regular-season schedule call (`seasontype=2`) never includes
 * them, so without this every October "recent form" is really September form. Cached an hour.
 */
export async function getPostseasonRecords(sport: Sport, abbr: string, season: number): Promise<TeamGameRecord[]> {
  const slug = toEspnAbbr(sport, abbr).toLowerCase()
  const out = await cached(`edges:postseason:${sport}:${slug}:${season}`, 3600, async () => {
    const res = await fetchJsonSafe<Json>(`https://site.api.espn.com/apis/site/v2/sports/${PATH[sport]}/teams/${slug}/schedule?season=${season}&seasontype=3`, { timeoutMs: 12000, cache: 'no-store' }, 'espn-postseason')
    if (!res) return null
    const rows: TeamGameRecord[] = []
    for (const ev of (res.data.events as Json[] | undefined) ?? []) {
      const comp = ev.competitions?.[0]
      if (!comp || comp.status?.type?.state !== 'post') continue
      const cs: Json[] = comp.competitors ?? []
      const home = cs.find((c) => c.homeAway === 'home')
      const away = cs.find((c) => c.homeAway === 'away')
      const hs = num(home?.score?.value ?? home?.score)
      const as = num(away?.score?.value ?? away?.score)
      if (!home || !away || hs === null || as === null) continue
      const homeAbbr = fromEspnAbbr(sport, String(home.team?.abbreviation ?? ''))
      const awayAbbr = fromEspnAbbr(sport, String(away.team?.abbreviation ?? ''))
      const isHome = homeAbbr === abbr
      rows.push({ playoff: true, season, date: String(ev.date).slice(0, 10), opp: isHome ? awayAbbr : homeAbbr, home: isHome, us: isHome ? hs : as, them: isHome ? as : hs })
    }
    return rows
  })
  return out ?? []
}
