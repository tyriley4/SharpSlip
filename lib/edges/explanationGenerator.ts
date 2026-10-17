import { horizonOf } from './horizon'
import type { BettingOutcome, Edge, Horizon, SeasonContext } from './types'

/**
 * Written explanation of a bet, built from structured templates over the evidence items (no AI generation). It runs on
 * demand in the browser from data already on the card, so tapping the icon makes no request. The wording is always "the
 * case for..." / "the evidence supports..." and never an instruction to bet.
 *
 * Shape:
 *   1. the game foundation: the full game context (style matchup, form against opponent quality, venue, weather, roster) that
 *      shapes how the evidence is weighted,
 *   2-3. the strongest one or two evidence items, each already carrying its number, its comparison and its tie to tonight,
 *   4. supporting context, up to two more items that add a different angle (never a repeated fact),
 *   then the time window that is most predictive and the filter that lets the reader check it,
 *   5. the primary uncertainty tonight and the grade with its basis (with or without live odds).
 */

export interface ExplanationContext {
  season: SeasonContext
  /** A real posted price exists (otherwise the grade is capped and says so). */
  hasOdds: boolean
  priorSeasonOnly: boolean
  away: string
  home: string
  /** For naming the time-period filter that matches a window. */
  sport?: string
  /** The one most useful sentence of the game foundation for this bet (style matchup, adjusted form, weather, roster). */
  foundation?: string | null
}

export interface ExplanationMeta {
  /** How the bet is named on the card, e.g. "Over 5.5 Strikeouts". */
  description: string
  conflicts: number
  limitedSample: boolean
  gradeNote?: string
  historicalHitRate: number | null
  impliedProbability: number | null
  isSharpFind: boolean
}

const RECENT: Horizon[] = ['last7', 'last15', 'last30']

const pct = (r: number) => `${Math.round(r * 100)}%`
const clean = (s: string) => s.replace(/\s+/g, ' ').replace(/[.\s]+$/, '')
const quality = (e: Edge) => (e.quality ? e.quality.specificity + e.quality.causality + e.quality.recency + e.quality.sample : 8)
const strength = (e: Edge) => e.weight * e.relevanceScore * (quality(e) / 12)

/** The time-period filter options each sport offers, as game counts (the app's selectors use the same list). */
const FILTER_OPTIONS: Record<string, number[]> = { mlb: [5, 10, 15, 30], nfl: [1, 3, 5], nba: [5, 10, 15, 20], nhl: [5, 10, 20], cfb: [3, 5], cbb: [5, 10] }

/** The "Last N" filter closest to a window, never longer than the window itself. */
function filterLabel(sport: string | undefined, n: number): string {
  const opts = FILTER_OPTIONS[sport ?? ''] ?? [5, 10, 15]
  const k = [...opts].filter((x) => x <= n).pop() ?? opts[0]
  return `Last ${k}`
}

/** Where the reader can check a window themselves: the player page filter, or the NFL game-tab time period. */
function explore(sport: string | undefined, k: number, o: Pick<BettingOutcome, 'type' | 'player'>): string {
  if (o.type === 'player_prop' && o.player?.name) return `; explore this using the ${filterLabel(sport, k)} filter on ${o.player.name}'s player page`
  if (sport === 'nfl') return `; explore this using the ${filterLabel(sport, k)} time period on the game's Passing, Rushing, Receiving and Defense tabs`
  return ''
}

/**
 * The time window that is most predictive here, and why. A recent role expansion beats the season average; a recent
 * window far from the season says so with both numbers; a recent team form item names its window; otherwise the longer
 * record, the opponent-specific record or the season itself is named as the one to trust.
 */
function windowSentence(items: Edge[], o: Pick<BettingOutcome, 'type' | 'player' | 'team' | 'opponent'>, sport: string | undefined, opp: string | undefined): string | null {
  const who = o.type === 'player_prop' ? o.player?.name : null
  const rate = (e: Edge) => e.metrics?.rate as number
  const exp = items.find((e) => e.category === 'role' && /expan(ded|sion)/i.test(e.description))
  if (exp && who) {
    const k = exp.metrics?.n ?? exp.sample ?? 4
    return `The last ${k}-game window is most predictive here because ${who}'s role expanded over those games and the season average understates the current opportunity${explore(sport, k, o)}.`
  }
  const season = items.find((e) => horizonOf(e) === 'season' && e.metrics?.rate !== undefined)
  const windows = items.filter((e) => RECENT.includes(horizonOf(e)) && e.metrics?.rate !== undefined && (e.metrics?.n ?? 0) >= 4)
  if (season && windows.length) {
    const w = [...windows].sort((a, b) => Math.abs(rate(b) - rate(season)) - Math.abs(rate(a) - rate(season)))[0]
    if (Math.abs(rate(w) - rate(season)) >= 0.1) {
      const n = w.metrics!.n as number
      return `The last ${n}-game window is most predictive here because it shows ${pct(rate(w))} against ${pct(rate(season))} for the full season — the recent games reflect ${who ? 'current form and role' : "the team's current form"}${explore(sport, n, o)}.`
    }
  }
  const recent = items.filter((e) => RECENT.includes(horizonOf(e)))
  const longer = items.filter((e) => ['career', 'career_vs_opp'].includes(horizonOf(e)) && e.metrics?.rate !== undefined)
  if (recent.length && longer.length && recent.every((e) => e.metrics?.rate !== undefined)) {
    const r = recent.reduce((n, e) => n + rate(e), 0) / recent.length
    const c = longer.reduce((n, e) => n + rate(e), 0) / longer.length
    const k = Math.round(recent.reduce((n, e) => n + (e.metrics?.n ?? 5), 0) / recent.length)
    if (c - r >= 0.1) return `The longer record is the more reliable window here: recent results (${pct(r)}) trail the longer-run rate of ${pct(c)}${explore(sport, 15, o)}.`
    if (r - c >= 0.1) return `The recent window is most predictive because it shows ${pct(r)} against ${pct(c)} over the longer record${explore(sport, k, o)}.`
  }
  const specific = items.find((e) => ['career_vs_opp', 'season_vs_opp'].includes(horizonOf(e)))
  if (specific && opp) return `The record against ${opp} is the most predictive window here because it is specific to tonight's matchup${who ? ` — see the vs This Opponent view on ${who}'s player page` : ''}.`
  const form = items.find((e) => e.category === 'recent_form' && (e.sample ?? 0) >= 3)
  if (form) {
    const n = form.sample ?? 5
    return `The last ${n}-game window is most predictive here because it captures ${who ? `${who}'s` : "both teams'"} form going into tonight${explore(sport, n, o)}.`
  }
  return null
}

/** Player evidence written without a subject ("has cleared Over 4.5"): put the name in front of the verb. */
function withSubject(t: string, o: Pick<BettingOutcome, 'type' | 'player'>): string {
  const name = o.type === 'player_prop' ? o.player?.name : null
  if (!name) return t
  if (/^(has|have)\b/i.test(t)) return `${name} ${t.charAt(0).toLowerCase()}${t.slice(1)}`
  return t
}

const sameFact = (a: Edge, b: Edge) => a.description.slice(0, 40) === b.description.slice(0, 40) || (a.category === b.category && horizonOf(a) === horizonOf(b) && a.sample === b.sample && a.sample !== undefined)

/** "Supporting that, the Dodgers..." reads better than "Supporting that, The Dodgers"; names and abbreviations keep their capitals. */
function lowerLead(t: string): string {
  return /^(The|A|An|Last|In|At|On|Over|Under)\b/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t
}

/**
 * generateBetExplanation: the strongest tonight-specific factor, up to two supporting facts, the most predictive window
 * and why, the primary uncertainty tonight, and the grade with its basis.
 */
export function generateBetExplanation(outcome: Pick<BettingOutcome, 'type' | 'direction' | 'player' | 'team' | 'opponent'>, evidenceItems: Edge[], convictionScore: number, grade: string, gameContext: ExplanationContext, meta: ExplanationMeta): string {
  const opp = outcome.opponent ?? outcome.team?.opponent
  // Priority order: tonight-specific (tier 1) and opponent-specific (tier 2) first, each by how strongly it bears on the bet.
  const found = gameContext.foundation ? clean(gameContext.foundation) : null
  const head = found ? found.slice(0, 40) : null
  const items = [...evidenceItems].filter((e) => !head || !e.description.startsWith(head)).sort((a, b) => (a.tier ?? 9) - (b.tier ?? 9) || strength(b) - strength(a))
  const sentences: string[] = []

  // ---- The primary uncertainty tonight.
  const notes: string[] = []
  if (meta.impliedProbability !== null && meta.historicalHitRate !== null && meta.impliedProbability >= meta.historicalHitRate) {
    notes.push(`the price already implies ${Math.round(meta.impliedProbability)}%, at or above the ${Math.round(meta.historicalHitRate)}% the history supports, so the market has priced in the case`)
  }
  if (meta.conflicts > 0) notes.push(`${meta.conflicts === 1 ? 'one factor points' : `${meta.conflicts} factors point`} the other way, which lowers the grade`)
  if (meta.limitedSample) notes.push('the main sample is under 10 games')
  if (gameContext.season.isPlayoffs) notes.push('playoff weighting leans on recent form and matchup-specific evidence over season-long trends')
  else if (gameContext.season.isEarlySeason || gameContext.priorSeasonOnly) notes.push('it is early in the season, so current-season samples are small and history carries more weight')
  if (notes.length === 0) notes.push("the evidence is a record of past results, and late lineup or injury news can still change tonight's setup")
  const uncertainty = `The primary uncertainty tonight is that ${notes.slice(0, 2).join('; and ')}.`

  // ---- The grade and its basis.
  const isProp = outcome.type === 'player_prop'
  const basis = gameContext.hasOdds ? 'based on the live price and the statistical evidence' : `without live ${isProp ? 'prop ' : ''}odds — statistical evidence only`
  const sharp = meta.isSharpFind && meta.historicalHitRate !== null && meta.impliedProbability !== null ? `, and the historical rate of ${Math.round(meta.historicalHitRate)}% sits ${Math.round(meta.historicalHitRate - meta.impliedProbability)} points above the ${Math.round(meta.impliedProbability)}% the price implies, which is why it is flagged as a Sharp Find` : ''
  const closing = `Grade ${grade} (conviction ${convictionScore.toFixed(2)}) — ${basis}${sharp}.`

  if (items.length === 0) {
    sentences.push(`There is not enough qualifying evidence to form a view on ${meta.description}, so the statistical case is thin either way.`)
    sentences.push(uncertainty, closing)
    return sentences.join(' ')
  }

  if (found) sentences.push(`This analysis is grounded in the full game context — ${found} — which shapes how the following evidence is weighted.`)
  const strong = grade === 'A' || grade === 'B' || grade === 'C'
  const lead = items[0]
  const leadText = withSubject(clean(lead.description), outcome)
  const tier = lead.tier ?? 9
  sentences.push(`${strong ? `The case for ${meta.description}` : `The evidence for ${meta.description} is limited and`} starts with ${tier <= 1 ? "tonight's setup" : tier === 2 ? "tonight's matchup" : 'the recent numbers'}: ${leadText}.`)

  // Two supporting facts from different parts of the case, never the same fact twice.
  const used = [lead]
  const supports: Edge[] = []
  for (const e of items.slice(1)) {
    if (supports.length >= 3) break
    if (used.some((u) => sameFact(u, e))) continue
    // Prefer a different kind of evidence than the lead.
    if (supports.length === 0 && e.category === lead.category && items.some((x) => !used.includes(x) && x.category !== lead.category && (x.tier ?? 9) <= 4)) continue
    used.push(e)
    supports.push(e)
  }
  if (supports.length > 0) sentences.push(`Reinforcing that, ${lowerLead(withSubject(clean(supports[0].description), outcome))}.`)
  if (supports.length > 1) sentences.push(`Supporting context: ${supports.slice(1).map((e) => lowerLead(withSubject(clean(e.description), outcome))).join('; and ')}.`)

  const windowNote = windowSentence(items, outcome, gameContext.sport, opp)
  if (windowNote) sentences.push(windowNote)
  sentences.push(uncertainty, closing)
  return sentences.join(' ')
}
