import { fetchJson } from './fetchJson'

export interface MlbTeamInfo {
  id: number
  abbr: string
  name: string
  divisionId: number
  divisionName: string
  leagueId: number
}

interface TeamsResponse {
  teams: {
    id: number
    abbreviation: string
    name: string
    division?: { id: number; name: string }
    league?: { id: number; name: string }
  }[]
}

/** Converts "American League East" -> "AL East", "National League Central" -> "NL Central". */
export function shortDivisionName(fullName: string): string {
  return fullName.replace('American League', 'AL').replace('National League', 'NL')
}

let teamsIndexPromise: Promise<Map<number, MlbTeamInfo> | null> | null = null

/** Cached (24h) id -> team info index for all 30 MLB teams. */
export async function getMlbTeamsIndex(): Promise<Map<number, MlbTeamInfo> | null> {
  if (!teamsIndexPromise) {
    teamsIndexPromise = (async () => {
      const data = await fetchJson<TeamsResponse>(
        'https://statsapi.mlb.com/api/v1/teams?sportId=1&activeStatus=Y',
        86400,
        'mlb-teams-index'
      )
      if (!data) return null
      const map = new Map<number, MlbTeamInfo>()
      for (const t of data.teams) {
        map.set(t.id, {
          id: t.id,
          abbr: t.abbreviation,
          name: t.name,
          divisionId: t.division?.id ?? 0,
          divisionName: t.division ? shortDivisionName(t.division.name) : '',
          leagueId: t.league?.id ?? 0,
        })
      }
      return map
    })()
    // Don't hold onto a rejected/stale promise across requests.
    teamsIndexPromise.then((v) => {
      if (!v) teamsIndexPromise = null
    })
  }
  return teamsIndexPromise
}
