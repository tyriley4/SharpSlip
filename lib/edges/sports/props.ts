import { daysSince } from '../historicalRates'
import type { BettingOutcome, Edge, Horizon, PlayerGameRecord, PlayerHistory } from '../types'
import { ev, f1, mean, plural, recRelevance } from './format'

/**
 * Player-prop evidence shared by every sport. Each item states what happened at tonight's exact number, the figure behind
 * it, the comparison that makes it meaningful (the same player's season rate and average), why it is sustainable (the
 * usage behind it, when the sport measures usage) and how it connects to tonight's threshold.
 */
export interface PropRead {
  edges: Edge[]
  conflicts: number
}

export const propName = (o: BettingOutcome) => o.player?.name ?? 'The player'
export const propLine = (o: BettingOutcome) => `${o.direction === 'under' ? 'Under' : 'Over'} ${o.threshold} ${o.category}`
const clearWord = (o: BettingOutcome) => (o.direction === 'under' ? 'stayed under' : 'exceeded')

const valueOf = (o: BettingOutcome, g: PlayerGameRecord, key?: string): number | null => {
  const v = (key ?? o.category) ? g.values[(key ?? o.category) as string] : undefined
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

/** The games of the newest season in the log, newest first. */
export function currentGames(history: PlayerHistory | null): PlayerGameRecord[] {
  const gs = history?.games ?? []
  if (gs.length === 0) return []
  return gs.filter((g) => g.season === gs[0].season)
}

export interface UsageSpec {
  /** The history key that measures the role (Targets, Rush Attempts, Minutes, TOI). */
  key: string
  label: string
}

/** Consecutive games, newest first, that cleared the number. */
function streakOf(o: BettingOutcome, games: PlayerGameRecord[]): number {
  let n = 0
  for (const g of games) {
    const v = valueOf(o, g)
    if (v === null || !clears(o, v)) break
    n++
  }
  return n
}

/**
 * Form at tonight's number: the window (3, 5, 7, 10 or 15 games) where the record is strongest, read against the player's
 * own season rate and average at this number, with the usage behind it as the reason it should or should not last.
 */
export function recentAtLine(o: BettingOutcome, history: PlayerHistory | null, tier: 3 | 4 = 3, sizes: readonly number[] = [7, 10, 15], usage?: UsageSpec): PropRead {
  const edges: Edge[] = []
  let conflicts = 0
  const games = history?.games ?? []
  if (!history || games.length < 3 || o.threshold === undefined || !o.category) return { edges, conflicts }
  const wins = sizes.map((n) => windowOf(o, games, n)).filter((w): w is Window => w !== null)
  if (wins.length === 0) return { edges, conflicts }
  const rateOf = (w: Window) => w.hits / w.n
  const best = [...wins].sort((a, b) => rateOf(b) - rateOf(a) || a.n - b.n)[0]
  const name = propName(o)
  if (!(rateOf(best) >= 0.6 && best.hits >= Math.min(3, best.n))) {
    if (rateOf(best) <= 0.4) conflicts++
    return { edges, conflicts }
  }
  const cur = currentGames(history)
  const seasonVals = cur.map((g) => valueOf(o, g)).filter((v): v is number => v !== null)
  const seasonHits = seasonVals.filter((v) => clears(o, v)).length
  const seasonRate = seasonVals.length >= 6 ? seasonHits / seasonVals.length : null
  const seasonAvg = seasonVals.length >= 6 ? mean(seasonVals) : null
  const streak = streakOf(o, games)
  const what = streak >= 3 && streak >= best.n - 1 ? `has ${clearWord(o)} ${o.threshold} ${o.category} in ${streak} consecutive games` : `has ${clearWord(o)} ${o.threshold} ${o.category} in ${best.hits} of the last ${best.n} games (${Math.round(rateOf(best) * 100)}%)`
  const win = games.slice(0, streak >= 3 ? streak : best.n)
  const compare =
    seasonRate !== null && seasonAvg !== null
      ? ` — ${rateOf(best) > seasonRate + 0.05 ? 'above' : rateOf(best) < seasonRate - 0.05 ? 'below' : 'in line with'} his ${Math.round(seasonRate * 100)}% rate at this number on the season (${seasonHits} of ${seasonVals.length}), averaging ${f1(best.avg)} per game in that stretch vs ${f1(seasonAvg)} on the season`
      : ` — averaging ${f1(best.avg)} per game in that stretch`
  // Why it should last: the usage behind the production, in the same stretch against the season.
  let why = ''
  let usageDown = false
  if (usage) {
    const u = win.map((g) => valueOf(o, g, usage.key)).filter((v): v is number => v !== null)
    const us = cur.map((g) => valueOf(o, g, usage.key)).filter((v): v is number => v !== null)
    if (u.length >= 2 && us.length >= 5 && mean(us) > 0) {
      const a = mean(u)
      const b = mean(us)
      if (a >= b * 1.15) why = ` — ${usage.label} are up to ${f1(a)} per game in that stretch from ${f1(b)} on the season, so the production is role-driven rather than variance`
      else if (a <= b * 0.85) {
        why = ` — but ${usage.label} are down to ${f1(a)} per game from ${f1(b)}, so part of this is variance`
        usageDown = true
      } else why = ` — ${usage.label} are steady at ${f1(a)} per game (${f1(b)} on the season), so the production tracks his normal role`
    }
  }
  if (usageDown) conflicts++
  const horizon: Horizon = best.n <= 7 ? 'last7' : best.n <= 10 ? 'last15' : 'last30'
  edges.push(
    ev({
      tier,
      text: `${name} ${what}${compare}${why} — the form behind tonight's ${o.threshold} threshold`,
      category: 'recent_form',
      horizon,
      relevance: recRelevance(best.hits, best.n - best.hits) * (usageDown ? 0.8 : 1),
      support: wins.map((w) => `last ${w.n}: ${w.hits}-${w.n - w.hits}`).join(' · '),
      n: best.n,
      ageDays: daysSince(games[0].date),
      metrics: { rate: rateOf(best), avg: best.avg, n: best.n },
    })
  )
  return { edges, conflicts }
}

/** This season's record at the number: tonight's venue split against the other venue, or the season overall. */
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
    const there = vals(cur.filter((g) => g.home !== homeFlag))
    if (here.length >= 4) {
      const h = here.filter((v) => clears(o, v)).length
      if (h / here.length >= 0.6) {
        const t = there.length >= 3 ? ` vs ${there.filter((v) => clears(o, v)).length} of ${there.length} ${homeFlag ? 'on the road' : 'at home'} (${f1(mean(there))} per game)` : ''
        edges.push(ev({ tier: 4, text: `${name} ${homeFlag ? 'at home' : 'on the road'} this season: ${line} in ${h} of ${here.length} games (${f1(mean(here))} per game)${t} — tonight's game is ${homeFlag ? 'at home' : 'on the road'}`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(h, here.length - h), support: `${homeFlag ? 'Home' : 'Road'} games this season`, n: here.length }))
        return { edges, conflicts }
      }
      if (h / here.length <= 0.4) conflicts++
    }
  }
  if (hits / all.length >= 0.6) edges.push(ev({ tier: 5, text: `${name} this season: ${line} in ${hits} of ${all.length} games (${f1(mean(all))} per game vs the ${o.threshold} line) — the season-long base rate behind tonight's number`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(hits, all.length - hits), support: 'Season game log', n: all.length, metrics: { rate: hits / all.length, avg: mean(all), n: all.length } }))
  else if (hits / all.length <= 0.4) conflicts++
  return { edges, conflicts }
}

/** The player's career record against tonight's opponent, read against his own season average. */
export function vsOpponentCareer(o: BettingOutcome, history: PlayerHistory | null, minGames: number): PropRead {
  const edges: Edge[] = []
  let conflicts = 0
  if (!history || !o.opponent || o.threshold === undefined || !o.category) return { edges, conflicts }
  const vs = history.games.filter((g) => g.opp === o.opponent)
  const vals = vs.map((g) => valueOf(o, g)).filter((v): v is number => v !== null)
  if (vals.length < minGames) return { edges, conflicts }
  const hits = vals.filter((v) => clears(o, v)).length
  const cur = currentGames(history)
  const seasonAvg = cur.length >= 4 ? mean(cur.map((g) => valueOf(o, g)).filter((v): v is number => v !== null)) : null
  const thisSeason = vs.filter((g) => g.season === history.games[0].season).length
  if (hits / vals.length >= 0.6) {
    edges.push(
      ev({
        tier: 2,
        text: `${propName(o)} against ${o.opponent}: ${propLine(o)} in ${hits} of ${vals.length} career games${thisSeason ? ` (${plural(thisSeason, 'game')} this season)` : ''}, averaging ${f1(mean(vals))} vs ${seasonAvg !== null ? `${f1(seasonAvg)} on the season` : `the ${o.threshold} line`} — tonight's opponent`,
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
      text: `${propName(o)} last season: ${propLine(o)} in ${hits} of ${vals.length} games (${f1(mean(vals))} per game vs the ${o.threshold} line) — only ${plural(cur.length, 'game')} played this year, so last season is the sturdier sample for tonight`,
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
