import { daysSince, recencyMultiplier } from '../historicalRates'
import type { Edge, ModuleOutput } from '../types'
import { avg, lineNoun, outcomeNoun, playerHit, subjectTeam, teamEvidenceGames, teamHit, type ModuleInput } from './shared'

const W_STREAK = 0.2
const W_TREND = 0.14

/** Evidence older than this is not described as current form. */
const CURRENT_WINDOW_DAYS = 14

/**
 * MODULE 1: is there a meaningful recent trend behind this outcome? Fires only on a run of consecutive hits, a clear
 * 20%+ swing in the stat, or a clear directional streak for a team in the last five games - never on one game.
 */
export function recentFormModule({ outcome: o, game, history }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  const noun = outcomeNoun(o)

  if (o.type === 'player_prop') {
    const games = history?.games ?? []
    if (games.length < 5 || o.threshold === undefined || !o.category) return { edges, conflicts }
    const age = daysSince(games[0].date)
    if (age > CURRENT_WINDOW_DAYS) return { edges, conflicts }
    const mult = recencyMultiplier(age)

    let streak = 0
    for (const g of games) {
      if (playerHit(o, g) === true) streak++
      else break
    }
    if (streak >= 3) {
      edges.push({
        description: `Cleared ${noun} in each of the last ${streak} games`,
        category: 'recent_form',
        relevanceScore: Math.min(1, 0.5 + 0.12 * (streak - 3)),
        supportingData: games.slice(0, streak).map((g) => g.values[o.category!]).join(', ') + ' (most recent first)',
        weight: W_STREAK,
        recencyMultiplier: mult,
        sample: streak,
      })
    }

    const season = games.filter((g) => g.season === games[0].season)
    const vals = (xs: typeof games) => xs.map((g) => g.values[o.category!]).filter((v): v is number => typeof v === 'number')
    const seasonAvg = avg(vals(season))
    const last5 = vals(games.slice(0, 5))
    const last5Avg = avg(last5)
    if (season.length >= 10 && last5.length >= 5 && seasonAvg > 0) {
      const ratio = last5Avg / seasonAvg
      const supportsOver = ratio >= 1.2 && last5Avg > o.threshold
      const supportsUnder = ratio <= 0.8 && last5Avg < o.threshold
      if ((o.direction !== 'under' && supportsOver) || (o.direction === 'under' && supportsUnder)) {
        edges.push({
          description: `Averaging ${last5Avg.toFixed(1)} ${o.category} over the last 5 games against ${seasonAvg.toFixed(1)} for the season (${ratio >= 1 ? '+' : ''}${Math.round((ratio - 1) * 100)}%)`,
          category: 'recent_form',
          relevanceScore: Math.min(1, 0.45 + Math.abs(ratio - 1)),
          supportingData: `Line is ${o.threshold}`,
          weight: W_TREND,
          recencyMultiplier: mult,
          sample: last5.length,
        })
      } else if ((o.direction !== 'under' && ratio <= 0.8) || (o.direction === 'under' && ratio >= 1.2)) conflicts++
    }
    const l5hit = games.slice(0, 5).map((g) => playerHit(o, g)).filter((x) => x !== null) as boolean[]
    if (l5hit.length === 5 && l5hit.every((x) => !x)) conflicts++
    return { edges, conflicts }
  }

  // Team outcomes.
  const all = teamEvidenceGames(o, game)
  if (o.type === 'total') {
    // Each team own latest games, interleaved by date.
    const a = (game.results[game.away] ?? []).slice(0, 5)
    const h = (game.results[game.home] ?? []).slice(0, 5)
    if (a.length < 5 || h.length < 5 || o.threshold === undefined) return { edges, conflicts }
    const newest = [a[0].date, h[0].date].sort().reverse()[0]
    const age = daysSince(newest)
    if (age > CURRENT_WINDOW_DAYS) return { edges, conflicts }
    const totals = [...a, ...h].map((g) => g.us + g.them)
    const mean = avg(totals)
    const gap = mean - o.threshold
    const supports = o.direction === 'under' ? gap <= -4 : gap >= 4
    const scale = game.sport === 'nba' || game.sport === 'cbb' ? 2.2 : game.sport === 'nfl' || game.sport === 'cfb' ? 1 : 0.35
    if (supports) {
      edges.push({
        description: `The last 5 games for each team averaged ${mean.toFixed(1)} combined points against a line of ${o.threshold}`,
        category: 'recent_form',
        relevanceScore: Math.min(1, 0.45 + Math.abs(gap) / (12 * scale + 1)),
        supportingData: `${game.away} ${avg(a.map((g) => g.us + g.them)).toFixed(1)} and ${game.home} ${avg(h.map((g) => g.us + g.them)).toFixed(1)} per game`,
        weight: W_TREND,
        recencyMultiplier: recencyMultiplier(age),
        sample: 10,
      })
    } else if (o.direction === 'under' ? gap >= 4 : gap <= -4) conflicts++
    return { edges, conflicts }
  }

  const team = subjectTeam(o)
  const last5 = all.slice(0, 5)
  if (!team || last5.length < 5) return { edges, conflicts }
  const age = daysSince(last5[0].date)
  if (age > CURRENT_WINDOW_DAYS) return { edges, conflicts }
  const hits = last5.map((g) => teamHit(o, g))
  const nHit = hits.filter((x) => x === true).length
  const label = o.type === 'moneyline' ? `${team} won` : `${team} covered ${lineNoun(o)}`
  if (nHit >= 4) {
    edges.push({
      description: `${label} in ${nHit} of the last 5 games`,
      category: 'recent_form',
      relevanceScore: nHit === 5 ? 0.85 : 0.65,
      supportingData: last5.map((g) => `${g.us}-${g.them}`).join(', ') + ' (most recent first)',
      weight: W_STREAK,
      recencyMultiplier: recencyMultiplier(age),
      sample: 5,
    })
  } else if (nHit <= 1) conflicts++
  return { edges, conflicts }
}
