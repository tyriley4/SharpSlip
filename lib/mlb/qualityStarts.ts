import type { LeaderRow } from '@/data/leaders/types'
import { getPlayerGameLog } from './api'
import { NOTABLE_PITCHERS } from './notablePlayers'
import { resolvePlayerIds } from './playerLookup'
import type { MlbTeamInfo } from './teams'

/**
 * Quality Starts has no `leaderCategories` support in the public MLB Stats API, so this is
 * computed from full-season game logs for the notable-pitchers pool (see notablePlayers.ts)
 * rather than the entire league.
 */
export async function getQualityStartsLeaders(teams: Map<number, MlbTeamInfo> | null, limit = 15): Promise<LeaderRow[]> {
  const resolved = await resolvePlayerIds(NOTABLE_PITCHERS)

  const results = await Promise.all(
    resolved.map(async (p) => {
      const log = await getPlayerGameLog(p.id, 'pitching')
      let qs = 0
      let teamId: number | undefined
      for (const g of log ?? []) {
        const ip = parseFloat(String(g.stat.inningsPitched ?? '0'))
        const er = Number(g.stat.earnedRuns ?? 99)
        if (ip >= 6 && er <= 3) qs++
        teamId = g.team.id
      }
      return { name: p.fullName, teamId, qs }
    })
  )

  return results
    .sort((a, b) => b.qs - a.qs)
    .slice(0, limit)
    .map((r, i) => ({
      rank: i + 1,
      name: r.name,
      team: teams && r.teamId ? (teams.get(r.teamId)?.abbr ?? '') : '',
      value: String(r.qs),
      record: '—',
      hitPct: 0,
    }))
}
