import { getAllNHLTeamStats, getNHLPlayerGameLog } from '@/lib/nhl/api'
import { cached } from '@/lib/net/ttlCache'
import { slugify } from '@/lib/players/slug'
import { getNHLStartingGoalie } from '@/lib/nhl/gameBreakdown'
import { q } from '../evidenceFramework'
import { daysSince } from '../historicalRates'
import type { ModuleInput } from '../modules/shared'
import type { Edge, ModuleOutput } from '../types'

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
const f1 = (n: number) => n.toFixed(1)
const sv = (n: number) => n.toFixed(3).replace(/^0/, '')
const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}

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

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`

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

/** Skater props and totals: the opposing goalie's recent form, rest, and the power play against the penalty kill. */
export function getNhlEvidence({ outcome: o, game }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  const facts = game.facts.nhl
  if (!facts) return { edges, conflicts }

  if (o.type === 'player_prop' && o.player && o.opponent && ['Points', 'Assists', 'Shots on Goal'].includes(o.category ?? '') && (o.player.position ?? '') !== 'G') {
    const over = o.direction !== 'under'
    const oppSide = o.opponent === game.home ? 'home' : 'away'
    const goalie = facts.goalies[oppSide]
    if (goalie?.last5SvPct != null) {
      const weak = goalie.last5SvPct <= 0.895
      const strong = goalie.last5SvPct >= 0.925
      if ((over && weak) || (!over && strong)) {
        edges.push({
          description: `${o.opponent}'s likely starter ${goalie.name} has stopped ${sv(goalie.last5SvPct)} of shots over his last ${goalie.last5.length} starts (${sv(goalie.seasonSavePct)} for the season)${goalie.startedYesterday ? ' and played yesterday, so a backup may start' : ''}`,
          category: 'matchup',
          horizon: 'last15',
          layer: 'opportunity',
          relevanceScore: Math.min(1, 0.5 + Math.abs(goalie.last5SvPct - 0.91) * 8),
          supportingData: goalie.last5.map((r) => `${r.sv}/${r.sa} vs ${r.opp}`).join(' · '),
          weight: 0.18,
          ageDays: daysSince(goalie.last5[0].date),
          quality: q(3, 3, 3, 1),
          sample: goalie.last5.length,
          metrics: { rate: goalie.last5SvPct, n: goalie.last5.length },
        })
      } else if ((over && strong) || (!over && weak)) conflicts++
    } else if (goalie?.startedYesterday && over) {
      edges.push({ description: `${o.opponent}'s likely starter ${goalie.name} played yesterday, so a backup goalie may be in net`, category: 'situational', horizon: 'tonight', layer: 'situational', relevanceScore: 0.45, supportingData: 'Goalie game log', weight: 0.06, ageDays: 0, quality: q(3, 3, 3, 1) })
    }
    // His own power-play role: minutes on the first unit are where a skater's points come from.
    const role = facts.ppRoles[`${slugify(o.player.name)}|${o.player.team}`]
    if (over && role && role.gp >= 4 && (o.category === 'Points' || o.category === 'Assists')) {
      if (role.ppToiSec >= 90) edges.push({ description: `Averaging ${mmss(role.ppToiSec)} of power-play time per game (${Math.round(role.ppShare * 100)}% of his team's power-play minutes) with ${role.ppPoints} power-play point${role.ppPoints === 1 ? '' : 's'} in ${role.gp} games`, category: 'role', horizon: 'season', layer: 'opportunity', relevanceScore: Math.min(1, 0.5 + (role.ppToiSec - 90) / 150), supportingData: 'NHL stats service, power play', weight: 0.14, quality: q(3, 3, 2, role.gp >= 8 ? 2 : 1), sample: role.gp, smallSample: role.gp < 8 ? role.gp : undefined })
      else if (role.ppToiSec <= 20) conflicts++
    }
    if (over && (o.category === 'Points' || o.category === 'Assists')) {
      const mine = facts.special[o.player.team]
      const theirs = facts.special[o.opponent]
      if (mine && theirs && mine.ppRank <= mine.of / 3 && theirs.pkRank > (theirs.of * 2) / 3) {
        edges.push({ description: `${o.player.team}'s power play converts ${f1(mine.ppPct)}% (${ordinal(mine.ppRank)} in the league) against ${o.opponent}'s ${f1(theirs.pkPct)}% penalty kill (${ordinal(theirs.pkRank)} of ${theirs.of})`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevanceScore: 0.6, supportingData: 'Team special teams this season', weight: 0.12, quality: q(3, 3, 2, 2), sample: mine.of })
      }
    }
  }

  if (o.type === 'total') {
    const over = o.direction !== 'under'
    const a = facts.goalies.away
    const h = facts.goalies.home
    if (a?.last5SvPct != null && h?.last5SvPct != null) {
      if (over && a.last5SvPct <= 0.9 && h.last5SvPct <= 0.9) edges.push({ description: `Both likely goalies have struggled lately: ${a.name} ${sv(a.last5SvPct)} and ${h.name} ${sv(h.last5SvPct)} over their last five starts`, category: 'recent_form', horizon: 'last15', layer: 'statistical', relevanceScore: 0.6, supportingData: 'Goalie game logs', weight: 0.12, ageDays: 3, quality: q(3, 3, 3, 1) })
      else if (!over && a.last5SvPct >= 0.92 && h.last5SvPct >= 0.92) edges.push({ description: `Both likely goalies are sharp: ${a.name} ${sv(a.last5SvPct)} and ${h.name} ${sv(h.last5SvPct)} over their last five starts`, category: 'recent_form', horizon: 'last15', layer: 'statistical', relevanceScore: 0.6, supportingData: 'Goalie game logs', weight: 0.12, ageDays: 3, quality: q(3, 3, 3, 1) })
    }
  }
  return { edges, conflicts }
}
