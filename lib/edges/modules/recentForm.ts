import { daysSince } from '../historicalRates'
import { q } from '../evidenceFramework'
import { minimumsFor } from '../minimums'
import type { Edge, ModuleOutput, TeamGameRecord } from '../types'
import { avg, fmtPct, lineNoun, outcomeNoun, playerHit, subjectTeam, teamEvidenceGames, teamHit, type ModuleInput } from './shared'

const W_STREAK = 0.2
const W_TREND = 0.14
const W_WINDOW = 0.16

/** Evidence older than this is not described as current form. */
const CURRENT_WINDOW_DAYS = 14

/** "won 7 of its last 10 - 5 on the road, 4 against teams over .500" style context for a run of team results. */
function teamContext(games: TeamGameRecord[], hits: (boolean | null)[], opponentPct: Record<string, number>, tonightOpp: string | undefined, tonightHome: boolean | undefined): string {
  const idx = hits.map((h, i) => (h === true ? i : -1)).filter((i) => i >= 0)
  const clauses: string[] = []
  const road = idx.filter((i) => !games[i].home).length
  const home = idx.length - road
  if (tonightHome === false && road >= 3) clauses.push(`${road} of the ${idx.length} on the road`)
  else if (tonightHome === true && home >= 3) clauses.push(`${home} of the ${idx.length} at home`)
  const known = idx.filter((i) => opponentPct[games[i].opp] !== undefined)
  if (known.length >= 4) {
    const strong = known.filter((i) => opponentPct[games[i].opp] >= 0.5).length
    clauses.push(`${strong} against teams at .500 or better`)
  }
  if (tonightOpp && opponentPct[tonightOpp] !== undefined) clauses.push(`tonight's opponent ${tonightOpp} is at ${fmtPct(opponentPct[tonightOpp])}`)
  return clauses.length ? ` (${clauses.join('; ')})` : ''
}

/**
 * Recent form, as a statistical-support item that always carries its threshold or opponent context: a run of consecutive
 * hits, a hit rate over the last 5-10 games, a clear 20%+ swing in the stat, an average over a recent stretch, or a team
 * run split by venue and opposition quality. Never fires on one game.
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
    const cat = o.category

    let streak = 0
    for (const g of games) {
      if (playerHit(o, g) === true) streak++
      else break
    }
    if (streak >= 3) {
      edges.push({
        description: `Has cleared ${noun} in each of the last ${streak} games`,
        category: 'recent_form',
        relevanceScore: Math.min(1, 0.5 + 0.12 * (streak - 3)),
        supportingData: games.slice(0, streak).map((g) => g.values[cat]).join(', ') + ' (most recent first)',
        weight: W_STREAK,
        ageDays: age,
        quality: q(3, 2, 3, streak >= 5 ? 1 : 0),
        sample: streak,
      })
    }

    // Hit rate over the last 5, 7 or 10 games at this exact threshold.
    // Pitcher strikeout windows come from the starter evidence (with innings) when the MLB facts loaded.
    const skipWindows = game.sport === 'mlb' && cat === 'Strikeouts' && !!game.facts.mlb
    const windowed = skipWindows ? undefined : [10, 7, 5, 4]
      .filter((n) => games.length >= n)
      .map((n) => {
        const res = games.slice(0, n).map((g) => playerHit(o, g))
        const k = res.filter((x) => x === true).length
        const played = res.filter((x) => x !== null).length
        return { n: played, k }
      })
      .filter((w) => ((w.n >= 5 && w.k / w.n >= 0.6) || (w.n === 4 && w.k / w.n >= 0.75)) && w.k < w.n && !(streak >= 3 && w.k - streak <= 1 && w.k === streak))
      .sort((a, b) => b.k / b.n - a.k / a.n || b.n - a.n)[0]
    if (windowed) {
      edges.push({
        description: `Has cleared ${noun} in ${windowed.k} of the last ${windowed.n} games`,
        category: 'recent_form',
        relevanceScore: Math.min(1, 0.4 + (windowed.k / windowed.n - 0.6) * 1.6),
        supportingData: games.slice(0, windowed.n).map((g) => g.values[cat]).join(', ') + ' (most recent first)',
        weight: W_WINDOW,
        ageDays: age,
        quality: q(3, 2, 3, windowed.n >= 7 ? 1 : 0),
        sample: windowed.n,
        metrics: { rate: windowed.k / windowed.n, n: windowed.n },
      })
    }

    const season = games.filter((g) => g.season === games[0].season)
    const vals = (xs: typeof games) => xs.map((g) => g.values[cat]).filter((v): v is number => typeof v === 'number')
    const seasonAvg = avg(vals(season))
    const last5 = vals(games.slice(0, 5))
    const last5Avg = avg(last5)
    if (season.length >= 10 && last5.length >= 5 && seasonAvg > 0) {
      const ratio = last5Avg / seasonAvg
      const supportsOver = ratio >= 1.2 && last5Avg > o.threshold
      const supportsUnder = ratio <= 0.8 && last5Avg < o.threshold
      if ((o.direction !== 'under' && supportsOver) || (o.direction === 'under' && supportsUnder)) {
        edges.push({
          description: `Averaging ${last5Avg.toFixed(1)} ${cat} over the last 5 games against ${seasonAvg.toFixed(1)} for the season (${ratio >= 1 ? '+' : ''}${Math.round((ratio - 1) * 100)}%), with the line at ${o.threshold}`,
          category: 'recent_form',
          relevanceScore: Math.min(1, 0.45 + Math.abs(ratio - 1)),
          supportingData: `Line is ${o.threshold}`,
          weight: W_TREND,
          ageDays: age,
          quality: q(3, 2, 3, 0),
          sample: last5.length,
        })
      } else if ((o.direction !== 'under' && ratio <= 0.8) || (o.direction === 'under' && ratio >= 1.2)) conflicts++
    }

    // The longer 15/30-game averages against the line are built in the horizons module.
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
        ageDays: age,
        quality: q(3, 2, 3, 1),
        sample: 10,
      })
    } else if (o.direction === 'under' ? gap >= 4 : gap <= -4) conflicts++
    return { edges, conflicts }
  }

  const team = subjectTeam(o)
  const cur = all.length ? all.filter((g) => g.season === all[0].season) : []
  if (!team) return { edges, conflicts }
  const mins = minimumsFor(game)
  const windowSize = cur.length >= 10 ? 10 : Math.min(5, cur.length)
  const lastN = cur.slice(0, windowSize)
  if (lastN.length < Math.min(5, mins.recentForm)) return { edges, conflicts }
  const age = daysSince(lastN[0].date)
  if (age > CURRENT_WINDOW_DAYS) return { edges, conflicts }
  const hits = lastN.map((g) => teamHit(o, g))
  const nHit = hits.filter((x) => x === true).length
  const need = windowSize === 10 ? 7 : windowSize >= 5 ? 4 : windowSize === 4 ? 3 : windowSize
  if (nHit >= need) {
    edges.push({
      description: `${team} ${o.type === 'moneyline' ? 'has won' : 'would have beaten the ' + lineNoun(o) + ' number in'} ${nHit} of its last ${lastN.length} games${teamContext(lastN, hits, game.leagueWinPct, o.team?.opponent, o.team?.home)}`,
      category: 'recent_form',
      relevanceScore: nHit / lastN.length >= 0.9 ? 0.85 : 0.65,
      supportingData: lastN.map((g) => `${g.us}-${g.them}`).join(', ') + ' (most recent first)',
      weight: W_STREAK,
      ageDays: age,
      quality: q(2, 2, 3, windowSize === 10 ? 1 : 0),
      sample: lastN.length,
      smallSample: lastN.length < 5 ? lastN.length : undefined,
    })
  } else if (nHit <= (windowSize === 10 ? 3 : windowSize >= 5 ? 1 : 0)) conflicts++
  return { edges, conflicts }
}
