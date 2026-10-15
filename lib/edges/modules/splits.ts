import { q } from '../evidenceFramework'
import { MIN_SIGNAL_RATE } from '../historicalRates'
import type { Edge, ModuleOutput, TeamGameRecord } from '../types'
import { fmtPct, lineNoun, scaled, subjectTeam, teamHit, type ModuleInput } from './shared'

const W_TIER = 0.2

const pctText = (p: number) => p.toFixed(3).replace(/^0/, '')

/**
 * How the backed side does against opponents of tonight's quality, e.g. "15-4 against teams under .500 - tonight's
 * opponent is at .300". Uses this season only (opponent records are this season's), needs at least eight games in the
 * tier, and is sharpened by venue when the home/road slice has enough games of its own.
 */
export function splitsModule({ outcome: o, game }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  if (o.type !== 'moneyline' && o.type !== 'spread') return { edges, conflicts }
  const team = subjectTeam(o)
  const opp = o.team?.opponent
  if (!team || !opp) return { edges, conflicts }
  const oppPct = game.leagueWinPct[opp]
  if (oppPct === undefined) return { edges, conflicts }

  const all = game.results[team] ?? []
  if (all.length === 0) return { edges, conflicts }
  const season = Math.max(...all.map((g) => g.season))
  const cur = all.filter((g) => g.season === season && game.leagueWinPct[g.opp] !== undefined)
  const tonightTier = oppPct >= 0.5 ? 'strong' : 'weak'
  const inTier = (g: TeamGameRecord) => (game.leagueWinPct[g.opp] >= 0.5 ? 'strong' : 'weak') === tonightTier
  const tier = cur.filter(inTier)
  const venueTier = tier.filter((g) => g.home === o.team!.home)

  const rate = (games: TeamGameRecord[]) => {
    const res = games.map((g) => teamHit(o, g)).filter((x): x is boolean => x !== null)
    return { n: res.length, k: res.filter(Boolean).length }
  }
  const candidates = [
    { label: `against teams ${tonightTier === 'weak' ? 'under' : 'at or above'} .500`, r: rate(tier), min: scaled(8, game) },
    { label: `${o.team!.home ? 'at home' : 'on the road'} against teams ${tonightTier === 'weak' ? 'under' : 'at or above'} .500`, r: rate(venueTier), min: scaled(6, game) },
  ].filter((c) => c.r.n >= c.min)
  if (candidates.length === 0) return { edges, conflicts }
  const best = candidates.sort((a, b) => b.r.k / b.r.n - a.r.k / a.r.n || b.r.n - a.r.n)[0]
  const share = best.r.k / best.r.n
  const verb = o.type === 'moneyline' ? `${team} is ${best.r.k}-${best.r.n - best.r.k}` : `${team} has beaten the ${lineNoun(o)} number in ${best.r.k} of ${best.r.n} games`
  if (share > MIN_SIGNAL_RATE + 0.08) {
    edges.push({
      description: `${verb} ${best.label} — tonight's opponent ${opp} is at ${pctText(oppPct)}`,
      category: 'hit_rate',
      relevanceScore: Math.min(1, 0.4 + (share - 0.55) * 2),
      supportingData: `${fmtPct(share)} in this situation this season`,
      weight: W_TIER,
      quality: q(3, 3, 2, best.r.n >= 15 ? 3 : 2),
      sample: best.r.n,
    })
  } else if (share < 0.45) conflicts++
  return { edges, conflicts }
}
