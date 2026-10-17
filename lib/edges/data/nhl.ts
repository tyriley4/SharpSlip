import { getAllNHLTeamStats, getNHLPlayerGameLog } from '@/lib/nhl/api'
import { cached } from '@/lib/net/ttlCache'
import { slugify } from '@/lib/players/slug'
import { getNHLStartingGoalie } from '@/lib/nhl/gameBreakdown'

/**
 * NHL data connections. The league is always indoors, so no weather is ever read. Goalies come from the NHL API (the
 * likely starter is the goalie with the most starts until a box score names tonight's), special teams from team stats.
 */

export interface GoalieFacts {
  name: string
  seasonSavePct: number
  /** Save percentage across his last five starts (null under three). */
  last5SvPct: number | null
  last5: { date: string; opp: string; sa: number; sv: number }[]
  startedYesterday: boolean
}

export interface SpecialTeams {
  ppPct: number
  pkPct: number
  ppRank: number
  pkRank: number
  of: number
}

/** A skater's power-play role this season, from the NHL stats service. */
export interface PpRole {
  /** Power-play seconds per game. */
  ppToiSec: number
  /** Share of his team's power-play time he plays, 0-1. */
  ppShare: number
  ppPoints: number
  ppPer60: number
  gp: number
}

export interface NhlGameFacts {
  goalies: { away: GoalieFacts | null; home: GoalieFacts | null }
  special: Record<string, SpecialTeams>
  /** Power-play role by player-name slug and team (slug|TEAM). */
  ppRoles: Record<string, PpRole>
}

const pct = (v: number) => (v <= 1 ? v * 100 : v)

async function goalieFor(team: string, gameDate: string | null): Promise<GoalieFacts | null> {
  const g = await getNHLStartingGoalie(team, null).catch(() => null)
  if (!g) return null
  const log = (await getNHLPlayerGameLog(g.playerId).catch(() => null)) ?? []
  const starts = log.filter((r) => r.decision !== null && r.shotsAgainst > 0).sort((a, b) => b.gameDate.localeCompare(a.gameDate))
  const last5 = starts.slice(0, 5).map((r) => ({ date: r.gameDate.slice(0, 10), opp: r.opponentAbbr, sa: r.shotsAgainst, sv: r.saves }))
  const sa = last5.reduce((n, r) => n + r.sa, 0)
  const saves = last5.reduce((n, r) => n + r.sv, 0)
  const ref = gameDate ? Date.parse(gameDate) : Date.now()
  return {
    name: g.name,
    seasonSavePct: g.savePct,
    last5SvPct: last5.length >= 3 && sa > 0 ? saves / sa : null,
    last5,
    startedYesterday: !!last5[0] && Math.round((ref - Date.parse(last5[0].date)) / 86400000) <= 1,
  }
}

async function loadPpRoles(teams: string[]): Promise<Record<string, PpRole>> {
  const d = new Date()
  const y = d.getUTCMonth() + 1 >= 9 ? d.getUTCFullYear() : d.getUTCFullYear() - 1
  const season = `${y}${y + 1}`
  const all = await cached(`edges:nhlpp:${season}`, 3 * 3600, async () => {
    try {
      const res = await fetch(`https://api.nhle.com/stats/rest/en/skater/powerplay?limit=1500&cayenneExp=seasonId=${season}%20and%20gameTypeId=2`, { next: { revalidate: 10800 } })
      if (!res.ok) return null
      const rows = ((await res.json()) as { data?: { skaterFullName: string; teamAbbrevs: string; gamesPlayed: number; ppTimeOnIcePerGame: number; ppTimeOnIcePctPerGame: number; ppPoints: number; ppPointsPer60: number | null }[] }).data ?? []
      const out: Record<string, PpRole> = {}
      for (const r of rows) {
        const team = (r.teamAbbrevs ?? '').split(',').pop()?.trim() ?? ''
        out[`${slugify(r.skaterFullName)}|${team}`] = { ppToiSec: r.ppTimeOnIcePerGame ?? 0, ppShare: r.ppTimeOnIcePctPerGame ?? 0, ppPoints: r.ppPoints ?? 0, ppPer60: r.ppPointsPer60 ?? 0, gp: r.gamesPlayed ?? 0 }
      }
      return out
    } catch {
      return null
    }
  })
  return Object.fromEntries(Object.entries(all ?? {}).filter(([k]) => teams.some((t) => k.endsWith(`|${t}`))))
}


export async function loadNhlGameFacts(away: string, home: string, gameDate: string | null): Promise<NhlGameFacts | null> {
  const [gAway, gHome, teams, ppRoles] = await Promise.all([goalieFor(away, gameDate), goalieFor(home, gameDate), getAllNHLTeamStats().catch(() => null), loadPpRoles([away, home])])
  const usable = (teams ?? []).filter((t) => t.gamesPlayed >= 3)
  const ppSorted = [...usable].sort((a, b) => pct(b.powerPlayPct) - pct(a.powerPlayPct))
  // Rank 1 = best penalty kill; the worst penalty kills sit at the bottom.
  const pkSorted = [...usable].sort((a, b) => pct(b.penaltyKillPct) - pct(a.penaltyKillPct))
  const special: Record<string, SpecialTeams> = {}
  for (const t of usable) special[t.abbr] = { ppPct: pct(t.powerPlayPct), pkPct: pct(t.penaltyKillPct), ppRank: ppSorted.indexOf(t) + 1, pkRank: pkSorted.indexOf(t) + 1, of: usable.length }
  return { goalies: { away: gAway, home: gHome }, special, ppRoles }
}
