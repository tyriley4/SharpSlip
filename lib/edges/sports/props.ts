import { daysSince } from '../historicalRates'
import type { BettingOutcome, Edge, Horizon, PlayerGameRecord, PlayerHistory } from '../types'
import { ev, f1, mean, recRelevance } from './format'

/**
 * Player-prop evidence shared by every sport: how the player has done at this exact number over the last 7, 10 and 15
 * games, this season at home or on the road, and against tonight's opponent. Every figure is a count of games.
 */
export interface PropRead {
  edges: Edge[]
  conflicts: number
}

export const propName = (o: BettingOutcome) => o.player?.name ?? 'The player'
export const propLine = (o: BettingOutcome) => `${o.direction === 'under' ? 'Under' : 'Over'} ${o.threshold} ${o.category}`

const valueOf = (o: BettingOutcome, g: PlayerGameRecord): number | null => {
  const v = o.category ? g.values[o.category] : undefined
  return typeof v === 'number' ? v : null
}

export function clears(o: BettingOutcome, v: number): boolean {
  return o.direction === 'under' ? v < (o.threshold as number) : v > (o.threshold as number)
}

interface Window {
  n: number
  hits: number
  avg: number
}

function windowOf(o: BettingOutcome, games: PlayerGameRecord[], n: number): Window | null {
  const vals = games
    .slice(0, n)
    .map((g) => valueOf(o, g))
    .filter((v): v is number => v !== null)
  if (vals.length < Math.min(n, 3)) return null
  return { n: vals.length, hits: vals.filter((v) => clears(o, v)).length, avg: mean(vals) }
}

/** The calendar of one season's games from the player log, newest first. */
export function currentGames(history: PlayerHistory | null): PlayerGameRecord[] {
  const gs = history?.games ?? []
  if (gs.length === 0) return []
  return gs.filter((g) => g.season === gs[0].season)
}

/**
 * Recent form at the line: the window (7, 10 or 15) where the record is strongest, then the trend between the last five
 * games and the last fifteen. Returns the item, or a conflict when every window runs against the bet.
 */
export function recentAtLine(o: BettingOutcome, history: PlayerHistory | null, tier: 3 | 4 = 3, sizes: readonly number[] = [7, 10, 15]): PropRead {
  const edges: Edge[] = []
  let conflicts = 0
  const games = history?.games ?? []
  if (!history || games.length < 3 || o.threshold === undefined || !o.category) return { edges, conflicts }
  const wins = sizes.map((n) => windowOf(o, games, n)).filter((w): w is Window => w !== null)
  if (wins.length === 0) return { edges, conflicts }
  const rateOf = (w: Window) => w.hits / w.n
  const best = [...wins].sort((a, b) => rateOf(b) - rateOf(a) || a.n - b.n)[0]
  const line = propLine(o)
  const name = propName(o)
  if (rateOf(best) >= 0.6 && best.hits >= Math.min(3, best.n)) {
    const longest = sizes[sizes.length - 1]
    const shortest = sizes[0] <= 5 ? sizes[0] : 5
    const l15 = windowOf(o, games, longest)
    const l5 = windowOf(o, games, shortest)
    const trend = l5 && l15 && l15.n >= Math.min(10, longest) ? ((l5.avg - l15.avg) / (Math.abs(l15.avg) || 1) >= 0.15 ? 'up' : (l5.avg - l15.avg) / (Math.abs(l15.avg) || 1) <= -0.15 ? 'down' : null) : null
    // The trend only reads as support when it moves the bet's way (an under backer wants it falling).
    const helpful = trend === null ? null : o.direction === 'under' ? trend === 'down' : trend === 'up'
    const trendText = trend && l5 && l15 && helpful !== false ? ` — trending ${trend}: ${f1(l5.avg)} per game over the last ${l5.n} against ${f1(l15.avg)} over the last ${l15.n}` : ''
    if (helpful === false) conflicts++
    const horizon: Horizon = best.n <= 7 ? 'last7' : best.n <= 10 ? 'last15' : 'last30'
    edges.push(
      ev({
        tier,
        text: `${name}: ${line} in ${best.hits} of the last ${best.n} games (${f1(best.avg)} per game)${trendText}`,
        category: 'recent_form',
        horizon,
        relevance: recRelevance(best.hits, best.n - best.hits),
        support: wins.map((w) => `last ${w.n}: ${w.hits}-${w.n - w.hits}`).join(' · '),
        n: best.n,
        ageDays: daysSince(games[0].date),
        metrics: { rate: rateOf(best), avg: best.avg, n: best.n },
      })
    )
  } else if (rateOf(best) <= 0.4) conflicts++
  return { edges, conflicts }
}

/** This season's record at the line, split to tonight's venue (home or road) when both have enough games. */
export function seasonAtLine(o: BettingOutcome, history: PlayerHistory | null, homeFlag: boolean | null): PropRead {
  const edges: Edge[] = []
  let conflicts = 0
  const cur = currentGames(history)
  if (!history || cur.length < 6 || o.threshold === undefined) return { edges, conflicts }
  const vals = (gs: PlayerGameRecord[]) => gs.map((g) => valueOf(o, g)).filter((v): v is number => v !== null)
  const all = vals(cur)
  if (all.length < 6) return { edges, conflicts }
  const hits = all.filter((v) => clears(o, v)).length
  const line = propLine(o)
  const name = propName(o)
  if (homeFlag !== null) {
    const here = vals(cur.filter((g) => g.home === homeFlag))
    if (here.length >= 4) {
      const h = here.filter((v) => clears(o, v)).length
      if (h / here.length >= 0.6) {
        edges.push(ev({ tier: 4, text: `${name} ${homeFlag ? 'at home' : 'on the road'} this season: ${line} in ${h} of ${here.length} games (${f1(mean(here))} per game; ${hits} of ${all.length} overall)`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(h, here.length - h), support: `${homeFlag ? 'Home' : 'Road'} games this season`, n: here.length }))
        return { edges, conflicts }
      }
      if (h / here.length <= 0.4) conflicts++
    }
  }
  if (hits / all.length >= 0.6) edges.push(ev({ tier: 5, text: `${name} this season: ${line} in ${hits} of ${all.length} games (${f1(mean(all))} per game)`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(hits, all.length - hits), support: 'Season game log', n: all.length, metrics: { rate: hits / all.length, avg: mean(all), n: all.length } }))
  else if (hits / all.length <= 0.4) conflicts++
  return { edges, conflicts }
}

/** The player's career record against tonight's opponent (a full career is valid for an individual matchup). */
export function vsOpponentCareer(o: BettingOutcome, history: PlayerHistory | null, minGames: number): PropRead {
  const edges: Edge[] = []
  let conflicts = 0
  if (!history || !o.opponent || o.threshold === undefined || !o.category) return { edges, conflicts }
  const vs = history.games.filter((g) => g.opp === o.opponent)
  const vals = vs.map((g) => valueOf(o, g)).filter((v): v is number => v !== null)
  if (vals.length < minGames) return { edges, conflicts }
  const hits = vals.filter((v) => clears(o, v)).length
  const thisSeason = vs.filter((g) => g.season === history.games[0].season)
  const seasonNote = thisSeason.length > 0 ? ` (${thisSeason.length} of them this season)` : ''
  if (hits / vals.length >= 0.6) {
    edges.push(
      ev({
        tier: 2,
        text: `${propName(o)} against ${o.opponent}: ${propLine(o)} in ${hits} of ${vals.length} career games${seasonNote}, averaging ${f1(mean(vals))} — tonight's opponent`,
        category: 'h2h',
        horizon: 'career_vs_opp',
        relevance: recRelevance(hits, vals.length - hits),
        support: vs.slice(0, 5).map((g) => g.values[o.category as string]).join(', ') + ' (most recent first)',
        n: vals.length,
        seasonsAgo: 1,
        metrics: { rate: hits / vals.length, avg: mean(vals), n: vals.length },
      })
    )
  } else if (hits / vals.length <= 0.34) conflicts++
  return { edges, conflicts }
}

/** Second night of a back-to-back: the player's own numbers on the second night this season against every other night. */
export function backToBackSplit(o: BettingOutcome, history: PlayerHistory | null): { b2b: { n: number; avg: number }; other: { n: number; avg: number } } | null {
  const cur = currentGames(history)
  if (!history || cur.length < 8 || !o.category) return null
  const b2b: number[] = []
  const other: number[] = []
  for (let i = 0; i < cur.length - 1; i++) {
    const v = valueOf(o, cur[i])
    if (v === null) continue
    const days = Math.round((Date.parse(cur[i].date) - Date.parse(cur[i + 1].date)) / 86400000)
    ;(days === 1 ? b2b : other).push(v)
  }
  return b2b.length >= 3 && other.length >= 4 ? { b2b: { n: b2b.length, avg: mean(b2b) }, other: { n: other.length, avg: mean(other) } } : null
}

/**
 * Early in a season the current year says little, so last season's record at the same number is the honest anchor: shown
 * only while fewer than `until` games have been played this season, and labelled as last season.
 */
export function priorSeasonAtLine(o: BettingOutcome, history: PlayerHistory | null, until = 10): PropRead {
  const edges: Edge[] = []
  const conflicts = 0
  const gs = history?.games ?? []
  if (!history || gs.length === 0 || o.threshold === undefined || !o.category) return { edges, conflicts }
  const labels = Array.from(new Set(gs.map((g) => g.season))).sort().reverse()
  const cur = gs.filter((g) => g.season === labels[0])
  const prior = labels.length > 1 ? gs.filter((g) => g.season === labels[1]) : []
  if (cur.length >= until || prior.length < 20) return { edges, conflicts }
  const vals = prior.map((g) => valueOf(o, g)).filter((v): v is number => v !== null)
  if (vals.length < 20) return { edges, conflicts }
  const hits = vals.filter((v) => clears(o, v)).length
  if (hits / vals.length < 0.6) return { edges, conflicts }
  edges.push(
    ev({
      tier: 6,
      text: `${propName(o)} last season: ${propLine(o)} in ${hits} of ${vals.length} games (${f1(mean(vals))} per game) — only ${cur.length} ${cur.length === 1 ? 'game' : 'games'} played this year, so last season is the sturdier sample for tonight`,
      category: 'hit_rate',
      horizon: 'career',
      relevance: recRelevance(hits, vals.length - hits),
      support: 'Previous season game log',
      n: vals.length,
      seasonsAgo: 1,
    })
  )
  return { edges, conflicts }
}
