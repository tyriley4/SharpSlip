import { q } from './evidenceFramework'
import type { BetCardData } from './recommended'
import type { BettingOutcome, Edge, GameContext } from './types'

/**
 * Team synthesis. After every player prop is graded, the grade A and B individual edges are grouped by the team outcome
 * they support. When several line up behind the same team the case for that team is stronger than any one of them alone:
 * three clustering edges lift its conviction by 20%, four or more by 35%. The same clusters feed the totals (a cluster of
 * offensive advantages supports the Over) and, in the NFL, an opposing secondary that is both thin and soft supports the
 * attack against it.
 */

export interface Synthesis {
  /** Edges supporting each team's win/cover, by team abbreviation. */
  teams: Record<string, { count: number; players: string[] }>
  overs: { count: number; players: string[]; team: string | null }
  unders: { count: number; players: string[]; team: string | null }
}

export const SYNTHESIS_MULTIPLIER = { three: 1.2, fourPlus: 1.35 } as const
const multiplierFor = (n: number) => (n >= 4 ? SYNTHESIS_MULTIPLIER.fourPlus : n >= 3 ? SYNTHESIS_MULTIPLIER.three : 1)

const list = (names: string[]) => (names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`)

export function computeSynthesis(cards: BetCardData[], game: Pick<GameContext, 'away' | 'home'>): Synthesis {
  const teams: Synthesis['teams'] = {}
  const overs: string[] = []
  const unders: string[] = []
  const byTeamOvers: Record<string, number> = {}
  const byTeamUnders: Record<string, number> = {}
  const seen = new Set<string>()
  for (const c of cards) {
    if (c.section !== 'prop' || (c.grade !== 'A' && c.grade !== 'B') || !c.player?.team || !c.explain) continue
    const team = c.player.team
    const opp = team === game.home ? game.away : game.home
    const over = c.explain.outcome.direction !== 'under'
    // One edge per player per direction: a player's several thresholds are one advantage, not several.
    const key = `${c.player.name}|${over ? 'o' : 'u'}`
    if (seen.has(key)) continue
    seen.add(key)
    const supports = over ? team : opp
    const t = (teams[supports] ??= { count: 0, players: [] })
    t.count++
    t.players.push(c.player.name)
    if (over) {
      overs.push(c.player.name)
      byTeamOvers[team] = (byTeamOvers[team] ?? 0) + 1
    } else {
      unders.push(c.player.name)
      byTeamUnders[team] = (byTeamUnders[team] ?? 0) + 1
    }
  }
  const top = (m: Record<string, number>) => Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  return { teams, overs: { count: overs.length, players: overs, team: top(byTeamOvers) }, unders: { count: unders.length, players: unders, team: top(byTeamUnders) } }
}

/** The evidence item and conviction multiplier a team or total outcome receives from the clusters. */
export function synthesisFor(outcome: BettingOutcome, s: Synthesis | undefined, game: GameContext): { edges: Edge[]; multiplier: number } {
  const edges: Edge[] = []
  let multiplier = 1
  const base = { category: 'context' as const, horizon: 'tonight' as const, layer: 'opportunity' as const, ageDays: 0, quality: q(3, 3, 3, 2) }

  if ((outcome.type === 'moneyline' || outcome.type === 'spread') && outcome.team && s) {
    const t = s.teams[outcome.team.abbr]
    if (t && t.count >= 3) {
      multiplier = multiplierFor(t.count)
      edges.push({ ...base, description: `Multiple individual matchup advantages converge for ${outcome.team.abbr} tonight — ${list(t.players.slice(0, 4))} each present favorable situations that collectively support ${outcome.type === 'moneyline' ? `${outcome.team.abbr} to win` : `${outcome.team.abbr} covering`}`, relevanceScore: Math.min(1, 0.55 + t.count * 0.08), supportingData: `${t.count} grade A/B player edges point the same way`, weight: 0.16, sample: t.count })
    }
  }

  if (outcome.type === 'total' && s) {
    const over = outcome.direction !== 'under'
    const g = over ? s.overs : s.unders
    if (g.count >= 3 && g.team) {
      multiplier = multiplierFor(g.count)
      edges.push({ ...base, description: over ? `Elevated offensive matchups, led by ${g.team}, suggest scoring above recent averages — ${list(g.players.slice(0, 4))} each carry grade A or B over cases, which supports the Over` : `Several players project below their usual output — ${list(g.players.slice(0, 4))} each carry grade A or B under cases, which supports the Under`, relevanceScore: Math.min(1, 0.55 + g.count * 0.08), supportingData: `${g.count} grade A/B player edges point the same way`, weight: 0.14, sample: g.count })
    }
  }

  // NFL: an opposing secondary that is both thin (starters out) and soft against the position supports the attack against it.
  const nfl = game.facts.nfl
  if (nfl && (outcome.type === 'moneyline' || outcome.type === 'spread' || (outcome.type === 'total' && outcome.direction !== 'under'))) {
    const attackers = outcome.type === 'total' ? [game.away, game.home] : outcome.team ? [outcome.team.abbr] : []
    for (const team of attackers) {
      const opp = team === game.home ? game.away : game.home
      const out = nfl.depth[opp]?.outStarters.filter((x) => x.pos === 'CB' || x.pos === 'S') ?? []
      const rank = nfl.vsPosition[opp]?.rank.WR.recYds
      const n = nfl.vsPosition[opp]?.of
      if (out.length > 0 && rank && n && rank <= 12) {
        edges.push({ ...base, description: `${opp} is missing ${list(out.map((x) => `${x.name} (${x.pos})`))} and ranks ${rank}${rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'} of ${n} in receiving yards allowed to wide receivers — supports ${team}'s offensive output`, relevanceScore: 0.6, supportingData: 'ESPN depth chart and position-specific defense', weight: 0.1, quality: q(3, 3, 3, 1) })
        break
      }
    }
  }
  return { edges, multiplier }
}
