import { q } from '../evidenceFramework'
import type { DefenseRank, Edge, ModuleOutput } from '../types'
import { scriptOf, type ModuleInput } from './shared'

const W_SCRIPT = 0.14
const W_PACE = 0.08
const W_LINEUP_K = 0.22
const W_HITTER = 0.14

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}

const fmtAvg = (a: number) => a.toFixed(3).replace(/^0/, '')

/**
 * Layer 1, opportunity: is this player or team positioned to succeed tonight? Game script from the posted spread
 * (favourites run the ball, underdogs throw), pace from the total, and the sport-specific matchups a sharp bettor starts
 * with: the opposing lineup's strikeout rate for pitcher K props, platoon split and history against tonight's starter
 * for hitters.
 */
export function opportunityModule({ outcome: o, game, extras }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  if (o.type !== 'player_prop' || !o.category || !o.player) return { edges, conflicts }
  const over = o.direction !== 'under'
  const { margin, total } = scriptOf(game, o.player.team)
  const cat = o.category

  // ---- Football game script
  if (game.sport === 'nfl' || game.sport === 'cfb') {
    const rushing = cat === 'Rush Yards'
    const passing = cat === 'Pass Yards' || cat === 'Receiving Yards' || cat === 'Receptions'
    if (margin !== null && (rushing || passing)) {
      const favored = margin >= 3.5
      const heavyFavorite = margin >= 9
      const underdog = margin <= -3.5
      const team = o.player.team
      if (rushing) {
        if (over && favored) edges.push({ description: `${team} is a ${margin.toFixed(1)}-point favorite — the likely game script (leading late) favors ball control and a heavier share of rushing volume`, category: 'role', layer: 'opportunity', relevanceScore: Math.min(1, 0.5 + margin / 20), supportingData: 'Spread-implied game flow', weight: W_SCRIPT, ageDays: 0, quality: q(3, 3, 3, 1) })
        else if (over && margin <= -7) conflicts++
        else if (!over && margin <= -7) edges.push({ description: `${team} is a ${Math.abs(margin).toFixed(1)}-point underdog — trailing game scripts lean pass-heavy and cut into rushing volume`, category: 'role', layer: 'opportunity', relevanceScore: 0.6, supportingData: 'Spread-implied game flow', weight: W_SCRIPT, ageDays: 0, quality: q(3, 3, 3, 1) })
      } else {
        if (over && underdog) edges.push({ description: `${team} is a ${Math.abs(margin).toFixed(1)}-point underdog — a trailing game script raises passing volume`, category: 'role', layer: 'opportunity', relevanceScore: Math.min(1, 0.5 + Math.abs(margin) / 20), supportingData: 'Spread-implied game flow', weight: W_SCRIPT, ageDays: 0, quality: q(3, 3, 3, 1) })
        else if (over && heavyFavorite) conflicts++
        else if (!over && heavyFavorite) edges.push({ description: `${team} is a ${margin.toFixed(1)}-point favorite — a lead tends to shift to the run game and trims passing volume`, category: 'role', layer: 'opportunity', relevanceScore: 0.6, supportingData: 'Spread-implied game flow', weight: W_SCRIPT, ageDays: 0, quality: q(3, 3, 3, 1) })
      }
    }
    const highTotal = game.sport === 'nfl' ? 48 : 58
    if (passing && over && total !== null && total >= highTotal) {
      edges.push({ description: `The game total of ${total} points points to pace and passing volume`, category: 'role', layer: 'opportunity', relevanceScore: Math.min(1, 0.5 + (total - highTotal) / 12), supportingData: 'Posted total', weight: W_PACE, ageDays: 0, quality: q(2, 2, 3, 1) })
    }
  }

  // ---- Basketball pace and blowout risk
  if ((game.sport === 'nba' || game.sport === 'cbb') && ['Points', 'Rebounds', 'Assists'].includes(cat)) {
    const fast = game.sport === 'nba' ? 230 : 150
    if (over && total !== null && total >= fast) edges.push({ description: `The game total of ${total} points signals a fast pace with extra possessions to go around`, category: 'role', layer: 'opportunity', relevanceScore: Math.min(1, 0.5 + (total - fast) / 20), supportingData: 'Posted total', weight: W_PACE, ageDays: 0, quality: q(2, 2, 3, 1) })
    const blowout = game.sport === 'nba' ? 12 : 15
    if (over && margin !== null && Math.abs(margin) >= blowout) conflicts++
  }

  // ---- MLB
  if (game.sport === 'mlb') {
    // Pitcher strikeouts: the opposing lineup's strikeout rate is the primary driver.
    if (cat === 'Strikeouts' && o.opponent) {
      const rank: DefenseRank | undefined = game.defense[o.opponent]?.['Strikeout rate']
      if (rank) {
        const third = rank.of / 3
        const high = rank.rank <= third
        const low = rank.rank > rank.of - third
        const text = `${o.opponent}'s lineup strikes out in ${rank.value.toFixed(1)}% of plate appearances — ${ordinal(rank.rank)}-highest of ${rank.of} teams`
        if ((over && high) || (!over && low)) {
          edges.push({ description: over ? text : `${o.opponent}'s lineup strikes out in only ${rank.value.toFixed(1)}% of plate appearances — ${ordinal(rank.of - rank.rank + 1)}-lowest of ${rank.of} teams`, category: 'matchup', layer: 'opportunity', relevanceScore: Math.min(1, 0.55 + (over ? third - rank.rank : rank.rank - (rank.of - third)) / third / 2), supportingData: 'Team strikeout rate this season', weight: W_LINEUP_K, ageDays: undefined, quality: q(3, 3, 2, 3), sample: rank.of })
        } else if ((over && low) || (!over && high)) conflicts++
      }
    }
    // Hitters: platoon split and history against tonight's starter.
    const m = extras?.hitterMatchup
    if (m && ['Hits', 'Total Bases', 'Home Runs'].includes(cat)) {
      const handWord = m.hand === 'L' ? 'left-handed' : m.hand === 'R' ? 'right-handed' : null
      if (m.platoon && handWord && m.platoon.atBats >= 40) {
        const a = m.platoon.avg
        if (cat === 'Hits' || cat === 'Total Bases') {
          if (over && a >= 0.285) edges.push({ description: `Hitting ${fmtAvg(a)} against ${handWord} pitching this season (${m.platoon.atBats} AB, ${m.platoon.ops} OPS); tonight's starter ${m.pitcher} throws ${m.hand === 'L' ? 'left' : 'right'}`, category: 'matchup', layer: 'opportunity', relevanceScore: Math.min(1, 0.45 + (a - 0.27) * 3), supportingData: 'Platoon split', weight: W_HITTER, quality: q(3, 3, 2, m.platoon.atBats >= 100 ? 3 : 2), sample: m.platoon.atBats })
          else if (over && a <= 0.2) conflicts++
          else if (!over && a <= 0.22) edges.push({ description: `Hitting only ${fmtAvg(a)} against ${handWord} pitching this season (${m.platoon.atBats} AB); tonight's starter ${m.pitcher} throws ${m.hand === 'L' ? 'left' : 'right'}`, category: 'matchup', layer: 'opportunity', relevanceScore: Math.min(1, 0.45 + (0.25 - a) * 3), supportingData: 'Platoon split', weight: W_HITTER, quality: q(3, 3, 2, m.platoon.atBats >= 100 ? 3 : 2), sample: m.platoon.atBats })
        } else if (cat === 'Home Runs' && over && m.platoon.homeRuns >= 3 && m.platoon.atBats >= 60) {
          edges.push({ description: `${m.platoon.homeRuns} home runs in ${m.platoon.atBats} at-bats against ${handWord} pitching this season; tonight's starter ${m.pitcher} throws ${m.hand === 'L' ? 'left' : 'right'}`, category: 'matchup', layer: 'opportunity', relevanceScore: 0.6, supportingData: 'Platoon split', weight: W_HITTER, quality: q(3, 3, 2, 2), sample: m.platoon.atBats })
        }
      }
      // Career against this exact pitcher: at least eight plate appearances, or it is anecdote.
      if (m.vs && m.vs.plateAppearances >= 8) {
        const { hits, atBats, plateAppearances, homeRuns } = m.vs
        const text = `${hits}-for-${atBats} career against ${m.pitcher} (${plateAppearances} plate appearances${homeRuns ? `, ${homeRuns} HR` : ''})`
        if ((cat === 'Hits' || cat === 'Total Bases') && over && m.vs.avg >= 0.3) edges.push({ description: text, category: 'h2h', layer: 'statistical', relevanceScore: Math.min(1, 0.45 + (m.vs.avg - 0.28) * 2.5), supportingData: `${fmtAvg(m.vs.avg)} batting average in the matchup`, weight: 0.1, seasonsAgo: 1, quality: q(3, 3, 1, plateAppearances >= 20 ? 2 : 1), sample: plateAppearances })
        else if ((cat === 'Hits' || cat === 'Total Bases') && over && m.vs.avg <= 0.15) conflicts++
        else if (cat === 'Home Runs' && over && homeRuns >= 1) edges.push({ description: text, category: 'h2h', layer: 'statistical', relevanceScore: 0.6, supportingData: 'Career history against tonight\'s starter', weight: 0.08, seasonsAgo: 1, quality: q(3, 3, 1, plateAppearances >= 20 ? 2 : 1), sample: plateAppearances })
      }
    }
  }

  return { edges, conflicts }
}
