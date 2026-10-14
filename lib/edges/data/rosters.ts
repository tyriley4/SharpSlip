import { findCollegeTeam } from '@/lib/college/directory'
import { ESPN_REF, getTeamList, getTeamRoster } from '@/lib/espn/api'
import { fromEspnAbbr } from '@/lib/espn/teams'
import { cached } from '@/lib/net/ttlCache'
import { slugify } from '@/lib/players/slug'
import type { Sport } from '@/lib/sport/SportContext'

export interface RosterHit {
  team: string
  position: string
  name: string
}

async function espnTeamId(sport: Sport, abbr: string): Promise<string | null> {
  if (sport === 'cfb' || sport === 'cbb') return (await findCollegeTeam(sport, abbr))?.id ?? null
  const ref = ESPN_REF[sport]
  const list = await getTeamList(ref.sport, ref.league)
  return list?.find((t) => fromEspnAbbr(sport, t.abbr) === abbr)?.id ?? null
}

/** name-slug -> team and position for both teams in a game, from ESPN rosters (cached a day by the roster call). */
export async function rosterIndex(sport: Sport, away: string, home: string): Promise<Map<string, RosterHit>> {
  const key = `edges:roster:${sport}:${away}:${home}`
  const out = await cached(key, 6 * 3600, async () => {
    const ref = ESPN_REF[sport]
    const map: [string, RosterHit][] = []
    for (const abbr of [away, home]) {
      const id = await espnTeamId(sport, abbr)
      if (!id) continue
      const roster = await getTeamRoster(ref.sport, ref.league, id).catch(() => null)
      for (const p of roster?.players ?? []) map.push([slugify(p.name), { team: abbr, position: p.position, name: p.name }])
    }
    return map
  })
  return new Map(out ?? [])
}
