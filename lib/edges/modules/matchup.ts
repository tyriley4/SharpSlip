import type { DefenseRank, Edge, GameContext, ModuleOutput } from '../types'
import { q } from '../evidenceFramework'
import { avg, fmtPct, outcomeNoun, subjectTeam, type ModuleInput } from './shared'

const W_DEFENSE = 0.22
const W_QUALITY = 0.18
const W_VENUE = 0.1
const W_MARGIN = 0.16

type Tier = 'soft' | 'tough' | 'middle'

function tierOf(r: DefenseRank): Tier {
  const third = r.of / 3
  if (r.rank <= third) return 'soft'
  if (r.rank > r.of - third) return 'tough'
  return 'middle'
}

const POWER_FOOTBALL = ['Southeastern Conference', 'Big Ten Conference', 'Big 12 Conference', 'Atlantic Coast Conference', 'Pac-12 Conference']
const POWER_BASKETBALL = [...POWER_FOOTBALL, 'Big East Conference']

/**
 * Opposition quality weighting. College football weighs power-conference opponents 1.3x and group-of-five 0.8x; college
 * basketball weighs conference strength; everything else uses the opponent's season win percentage.
 */
function oppMultiplier(game: GameContext, opp: string): number | undefined {
  const conf = game.conference[opp]
  if (game.sport === 'cfb' && conf) return POWER_FOOTBALL.includes(conf) || opp === 'ND' ? 1.3 : 0.8
  if (game.sport === 'cbb' && conf) return POWER_BASKETBALL.includes(conf) ? 1.2 : 0.85
  const w = game.winPct[opp]
  if (w === undefined) return undefined
  return w > 0.5 ? 1.2 : w >= 0.4 ? 1.0 : 0.8
}

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}

/** Mean margin of a team over its latest-season games (null below five games). */
function seasonMargin(game: GameContext, abbr: string): number | null {
  const games = game.results[abbr] ?? []
  if (games.length === 0) return null
  const season = Math.max(...games.map((g) => g.season))
  const cur = games.filter((g) => g.season === season)
  return cur.length >= 5 ? avg(cur.map((g) => g.us - g.them)) : null
}

function venueWinPct(game: GameContext, abbr: string, home: boolean): { rate: number; n: number } | null {
  const games = (game.results[abbr] ?? []).filter((g) => g.home === home)
  if (games.length === 0) return null
  const season = Math.max(...games.map((g) => g.season))
  const cur = games.filter((g) => g.season === season && g.us !== g.them)
  return cur.length >= 8 ? { rate: cur.filter((g) => g.us > g.them).length / cur.length, n: cur.length } : null
}

/**
 * MODULE 3: does tonight opponent create favorable conditions for this outcome? Props use the opposing defense
 * national rank for the stat; game lines use opponent quality, venue splits and margins. Middle-of-the-pack
 * matchups do not fire.
 */
export function matchupModule({ outcome: o, game }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0

  if (o.type === 'player_prop') {
    const opp = o.opponent
    const cat = o.category
    if (!opp || !cat) return { edges, conflicts }
    const rank = game.defense[opp]?.[cat]
    if (!rank) return { edges, conflicts }
    const tier = tierOf(rank)
    const over = o.direction !== 'under'
    const supports = (over && tier === 'soft') || (!over && tier === 'tough')
    const against = (over && tier === 'tough') || (!over && tier === 'soft')
    if (supports) {
      const depth = tier === 'soft' ? (rank.of / 3 - (rank.rank - 1)) / (rank.of / 3) : (rank.rank - (rank.of - rank.of / 3)) / (rank.of / 3)
      edges.push({
        description: `${opp} ranks ${ordinal(rank.rank)} of ${rank.of} for ${rank.label} (${rank.value.toFixed(1)}), ${tier === 'soft' ? 'among the most generous defenses against' : 'among the stingiest defenses against'} ${cat}`,
        category: 'matchup',
        relevanceScore: Math.max(0.5, Math.min(1, 0.5 + depth * 0.5)),
        supportingData: `${tier === 'soft' ? 'Bottom' : 'Top'} third nationally against ${cat}`,
        weight: W_DEFENSE,
        oppositionMultiplier: oppMultiplier(game, opp),
        sample: rank.of,
        quality: q(3, 3, 2, 3),
      })
    } else if (against) conflicts++
    return { edges, conflicts }
  }

  if (o.type === 'total') {
    const ranks = [game.away, game.home].map((t) => game.defense[t]?.['Points'])
    if (ranks.every(Boolean)) {
      const tiers = ranks.map((r) => tierOf(r as DefenseRank))
      const over = o.direction !== 'under'
      if (tiers.every((t) => t === (over ? 'soft' : 'tough'))) {
        edges.push({
          description: `Both defenses sit in the ${over ? 'bottom' : 'top'} third at points allowed (${game.away} ${ordinal((ranks[0] as DefenseRank).rank)}, ${game.home} ${ordinal((ranks[1] as DefenseRank).rank)})`,
          category: 'matchup',
          relevanceScore: 0.75,
          supportingData: `${(ranks[0] as DefenseRank).value.toFixed(1)} and ${(ranks[1] as DefenseRank).value.toFixed(1)} allowed per game`,
          weight: W_DEFENSE,
          sample: (ranks[0] as DefenseRank).of,
          quality: q(2, 2, 2, 3),
        })
      } else if (tiers.every((t) => t === (over ? 'tough' : 'soft'))) conflicts++
    }
    return { edges, conflicts }
  }

  // Moneyline and spread: the side being backed against the opponent.
  const team = subjectTeam(o)
  const opp = o.team?.opponent
  if (!team || !opp) return { edges, conflicts }
  const mine = game.winPct[team]
  const theirs = game.winPct[opp]
  if (mine !== undefined && theirs !== undefined) {
    if (mine - theirs >= 0.15) {
      edges.push({
        description: `${team} is winning ${fmtPct(mine)} of its games against ${fmtPct(theirs)} for ${opp}`,
        category: 'matchup',
        relevanceScore: Math.min(1, 0.5 + (mine - theirs)),
        supportingData: 'Season win percentage',
        weight: W_QUALITY,
        oppositionMultiplier: oppMultiplier(game, opp),
        sample: 10,
        quality: q(2, 2, 2, 2),
      })
    } else if (theirs - mine >= 0.15) conflicts++
  }
  const myVenue = venueWinPct(game, team, o.team!.home)
  const theirVenue = venueWinPct(game, opp, !o.team!.home)
  if (myVenue && theirVenue && myVenue.rate - theirVenue.rate >= 0.15) {
    edges.push({
      description: `${team} wins ${fmtPct(myVenue.rate)} ${o.team!.home ? 'at home' : 'on the road'} while ${opp} wins ${fmtPct(theirVenue.rate)} ${o.team!.home ? 'on the road' : 'at home'}`,
      category: 'matchup',
      relevanceScore: Math.min(1, 0.5 + (myVenue.rate - theirVenue.rate)),
      supportingData: `${myVenue.n} and ${theirVenue.n} games`,
      weight: game.sport === 'cfb' || game.sport === 'cbb' ? W_VENUE * 1.4 : W_VENUE,
      quality: q(3, 2, 2, 2),
      sample: Math.min(myVenue.n, theirVenue.n),
    })
  } else if (myVenue && theirVenue && theirVenue.rate - myVenue.rate >= 0.15) conflicts++

  if (o.type === 'spread' && o.threshold !== undefined) {
    const m1 = seasonMargin(game, team)
    const m2 = seasonMargin(game, opp)
    if (m1 !== null && m2 !== null) {
      const expected = m1 - m2
      if (expected + o.threshold >= 1) {
        edges.push({
          description: `Season margins point to ${team} by about ${expected.toFixed(1)} against ${opp}; the number is ${outcomeNoun(o)}`,
          category: 'matchup',
          relevanceScore: Math.min(1, 0.5 + (expected + o.threshold) / 20),
          supportingData: `${team} ${m1 >= 0 ? '+' : ''}${m1.toFixed(1)} per game, ${opp} ${m2 >= 0 ? '+' : ''}${m2.toFixed(1)}`,
          weight: W_MARGIN,
          sample: 5,
          quality: q(2, 2, 2, 2),
        })
      } else if (expected + o.threshold <= -1) conflicts++
    }
  }
  return { edges, conflicts }
}
