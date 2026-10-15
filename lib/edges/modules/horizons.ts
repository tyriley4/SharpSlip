import { q } from '../evidenceFramework'
import { minimumsFor } from '../minimums'
import { daysSince } from '../historicalRates'
import type { Edge, ModuleOutput, TeamGameRecord } from '../types'
import { avg, fmtPct, outcomeNoun, playerHit, subjectTeam, teamEvidenceGames, teamHit, type ModuleInput } from './shared'

const W_SEASON_VS = 0.12
const W_MEETINGS = 0.08
const W_WINDOW = 0.12
const W_MARGIN = 0.1

const f1 = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(1))

/** Per-game margin that counts as a real shift, by sport. */
const MARGIN_SCALE: Record<string, number> = { mlb: 1.2, nhl: 0.8, nfl: 5, cfb: 6, nba: 5, cbb: 6 }

/**
 * Time horizons that the other modules do not cover: this season against tonight's opponent, the last three meetings,
 * the last 15 and 30 games with the stat averaged against the line, and a team's margin trend. Each item is only raised
 * when it says something the season-long number does not (a clear gap, or a rate that is itself strong).
 */
export function horizonsModule({ outcome: o, game, history }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  const noun = outcomeNoun(o)

  if (o.type === 'player_prop') {
    const games = history?.games ?? []
    if (games.length < 8 || !o.category || o.threshold === undefined) return { edges, conflicts }
    const cat = o.category
    const newest = games[0].season
    const valOf = (g: (typeof games)[number]) => g.values[cat]
    const hitOf = (g: (typeof games)[number]) => playerHit(o, g)
    const season = games.filter((g) => g.season === newest)
    const seasonRate = (() => {
      const r = season.map(hitOf).filter((x): x is boolean => x !== null)
      return r.length >= 8 ? r.filter(Boolean).length / r.length : null
    })()
    const age = daysSince(games[0].date)

    // This season against tonight's opponent.
    if (o.opponent) {
      const vs = season.filter((g) => g.opp === o.opponent)
      const minN = game.sport === 'nfl' || game.sport === 'cfb' ? 1 : 2
      if (vs.length >= minN) {
        const hits = vs.map(hitOf).filter((x): x is boolean => x !== null)
        const k = hits.filter(Boolean).length
        const a = avg(vs.map(valOf).filter((v): v is number => typeof v === 'number'))
        if (hits.length >= minN && k / hits.length >= 0.5) {
          edges.push({
            description: `Earlier this season against ${o.opponent}: ${vs.map(valOf).join(', ')} ${cat} in ${vs.length} game${vs.length === 1 ? '' : 's'} (average ${f1(a)}), clearing ${noun} in ${k} of ${hits.length}`,
            category: 'h2h',
            horizon: 'season_vs_opp',
            layer: 'statistical',
            relevanceScore: Math.min(1, 0.45 + (k / hits.length - 0.5) * 1.2 + (vs.length >= 3 ? 0.1 : 0)),
            supportingData: 'This season only, most recent first',
            weight: W_SEASON_VS,
            ageDays: daysSince(vs[0].date),
            quality: q(3, 3, 3, vs.length >= 3 ? 1 : 0),
            sample: vs.length,
            metrics: { rate: k / hits.length, avg: a, n: vs.length },
          })
        } else if (hits.length >= minN && k / hits.length < 0.34 && vs.length >= 2) conflicts++
      }
      // The last three meetings, in any season.
      const meetings = games.filter((g) => g.opp === o.opponent).slice(0, 3)
      // When all three are from this season they are already the "earlier this season" item.
      if (meetings.length === 3 && vs.length < 3) {
        const hits = meetings.map(hitOf).filter((x): x is boolean => x !== null)
        const k = hits.filter(Boolean).length
        if (hits.length === 3 && k === 2) {
          edges.push({
            description: `In the last 3 meetings with ${o.opponent}: ${meetings.map(valOf).join(', ')} ${cat}, clearing ${noun} in ${k} of 3 (average ${f1(avg(meetings.map(valOf)))})`,
            category: 'h2h',
            horizon: 'recent_meetings',
            layer: 'statistical',
            relevanceScore: 0.5,
            supportingData: 'Most recent first',
            weight: W_MEETINGS,
            ageDays: daysSince(meetings[0].date),
            quality: q(3, 3, 2, 0),
            sample: 3,
            metrics: { rate: k / 3, avg: avg(meetings.map(valOf)), n: 3 },
          })
        }
      }
    }

    // Last 15 and 30 games, averaged against the line.
    const windows = [15, 30]
      .filter((n) => games.length >= n)
      .map((n) => {
        const slice = games.slice(0, n)
        const res = slice.map(hitOf).filter((x): x is boolean => x !== null)
        const k = res.filter(Boolean).length
        return { n, played: res.length, k, rate: res.length ? k / res.length : 0, avg: avg(slice.map(valOf).filter((v): v is number => typeof v === 'number')) }
      })
      .filter((w) => w.played >= Math.min(w.n, 12) && (w.rate >= 0.65 || (seasonRate !== null && w.rate - seasonRate >= 0.1 && w.rate >= 0.55)))
      .sort((a, b) => b.rate - a.rate || a.n - b.n)[0]
    const mins = games.slice(0, 15).map((g) => g.values.Minutes ?? g.values.TOI).filter((v): v is number => typeof v === 'number')
    const withMins = mins.length >= 10 ? ` on ${f1(avg(mins))} minutes per game` : ''
    const avg15 = avg(games.slice(0, 15).map(valOf).filter((v): v is number => typeof v === 'number'))
    if (games.length >= 15) {
      const margin = (avg15 - o.threshold) / Math.max(o.threshold, 1)
      const wantOver = o.direction !== 'under'
      if ((wantOver && margin <= -0.12) || (!wantOver && margin >= 0.12)) conflicts++
    }
    if (windows && age <= 21) {
      const lift = seasonRate !== null ? windows.rate - seasonRate : 0
      edges.push({
        description: `Has cleared ${noun} in ${windows.k} of the last ${windows.played} games (${fmtPct(windows.rate)}), averaging ${f1(windows.avg)} ${cat}${windows.n <= 15 ? withMins : ''} against the line of ${o.threshold} — ${lift >= 0.08 ? `up from ${fmtPct(seasonRate as number)} across the season` : seasonRate !== null ? `in line with the ${fmtPct(seasonRate)} season rate` : 'a sustained level'}`,
        category: 'recent_form',
        horizon: windows.n <= 15 ? 'last15' : 'last30',
        layer: 'statistical',
        relevanceScore: Math.min(1, 0.4 + (windows.rate - 0.55) * 1.4 + (lift >= 0.08 ? 0.1 : 0)),
        supportingData: `Last ${windows.n} games at this threshold`,
        weight: W_WINDOW,
        ageDays: age,
        quality: q(3, 2, 3, windows.n >= 30 ? 2 : 1),
        sample: windows.played,
        metrics: { rate: windows.rate, avg: windows.avg, n: windows.played },
      })
    }
    return { edges, conflicts }
  }

  // Team outcomes.
  const team = subjectTeam(o)
  const opp = o.team?.opponent
  const scale = MARGIN_SCALE[game.sport] ?? 1
  const isTotal = o.type === 'total'
  const mine = isTotal ? (game.results[game.home] ?? []) : (game.results[team ?? ''] ?? [])
  const other = isTotal ? game.away : opp
  const curSeason = mine.length ? Math.max(...mine.map((g) => g.season)) : 0

  if (other && mine.length) {
    const vs = mine.filter((g) => g.season === curSeason && g.opp === other)
    if (vs.length >= 2) {
      const hits = vs.map((g) => teamHit(o, g)).filter((x): x is boolean => x !== null)
      const k = hits.filter(Boolean).length
      const playoffs = vs.filter((g) => g.playoff).length
      const whom = isTotal ? `${game.away} and ${game.home}` : `${team} and ${opp}`
      if (isTotal && o.threshold !== undefined) {
        const totals = vs.map((g) => g.us + g.them)
        const a = avg(totals)
        const over = o.direction !== 'under'
        if ((over && a > o.threshold) || (!over && a < o.threshold)) {
          edges.push({ description: `${whom} have met ${vs.length} times this season${playoffs ? ` (${playoffs} in the postseason)` : ''}, averaging ${f1(a)} combined points against a line of ${o.threshold}`, category: 'h2h', horizon: 'season_vs_opp', layer: 'statistical', relevanceScore: Math.min(1, 0.45 + Math.abs(a - o.threshold) / (game.sport === 'mlb' || game.sport === 'nhl' ? 4 : 30)), supportingData: totals.join(', ') + ' (most recent first)', weight: W_SEASON_VS, ageDays: daysSince(vs[0].date), quality: q(3, 3, 3, 0), sample: vs.length })
        }
      } else if (team && hits.length >= 2 && k / hits.length > 0.5) {
        const diff = vs.reduce((n, g) => n + g.us - g.them, 0)
        edges.push({ description: `${team} has ${o.type === 'moneyline' ? `won ${k} of ${hits.length}` : `beaten the ${outcomeNoun(o).replace(`${team} `, '')} number in ${k} of ${hits.length}`} against ${opp} this season${playoffs ? ` (including ${playoffs} in the postseason)` : ''}, outscoring them by ${diff >= 0 ? '+' : ''}${diff} in total`, category: 'h2h', horizon: 'season_vs_opp', layer: 'statistical', relevanceScore: Math.min(1, 0.45 + (k / hits.length - 0.5) * 1.2), supportingData: vs.map((g) => `${g.us}-${g.them}`).join(', ') + ' (most recent first)', weight: W_SEASON_VS, ageDays: daysSince(vs[0].date), quality: q(3, 3, 3, vs.length >= 3 ? 1 : 0), sample: vs.length })
      } else if (hits.length >= 2 && k === 0) conflicts++
    }
    const last3 = mine.filter((g) => g.opp === other).slice(0, 3)
    if (last3.length === 3 && !isTotal && team) {
      const hits = last3.map((g) => teamHit(o, g)).filter((x): x is boolean => x !== null)
      const k = hits.filter(Boolean).length
      if (hits.length === 3 && k === 2) {
        const m = avg(last3.map((g) => g.us - g.them))
        edges.push({ description: `${team} won ${k} of the last 3 meetings with ${opp}, with an average margin of ${m >= 0 ? '+' : ''}${f1(m)}`, category: 'h2h', horizon: 'recent_meetings', layer: 'statistical', relevanceScore: 0.5, supportingData: last3.map((g) => `${g.us}-${g.them}`).join(', ') + ' (most recent first)', weight: W_MEETINGS, ageDays: daysSince(last3[0].date), quality: q(3, 3, 2, 0), sample: 3 })
      }
    }
  }

  // A team's margin over the last 7 games against its season margin (record-based form is in the recent-form module).
  if (!isTotal && team && game.sport !== 'mlb') {
    const all = teamEvidenceGames(o, game).filter((g) => g.season === curSeason)
    if (all.length >= minimumsFor(game).marginTrend) {
      const last7 = all.slice(0, Math.min(7, Math.max(3, Math.floor(all.length * 0.6))))
      const m7 = avg(last7.map((g: TeamGameRecord) => g.us - g.them))
      const ms = avg(all.map((g) => g.us - g.them))
      if (m7 - ms >= scale && m7 > 0) {
        edges.push({ description: `${team} has outscored opponents by ${f1(m7)} per game over its last ${last7.length} (${ms >= 0 ? '+' : ''}${f1(ms)} for the season) — a sharp upswing`, category: 'recent_form', horizon: 'last7', layer: 'statistical', relevanceScore: Math.min(1, 0.45 + (m7 - ms) / (scale * 4)), supportingData: last7.map((g) => `${g.us}-${g.them}`).join(', ') + ' (most recent first)', weight: W_MARGIN, ageDays: daysSince(last7[0].date), quality: q(3, 2, 3, 1), sample: last7.length, smallSample: all.length < 10 ? all.length : undefined })
      } else if (ms - m7 >= scale * 1.5) conflicts++
    }
  }
  return { edges, conflicts }
}
