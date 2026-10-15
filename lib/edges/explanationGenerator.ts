import { horizonOf } from './horizon'
import type { BettingOutcome, Edge, Horizon, SeasonContext } from './types'

/**
 * Written explanation of a bet, built from structured templates over the evidence items (no AI generation). It runs on
 * demand in the browser from data already on the card, so tapping the icon makes no request. The wording is always "the
 * statistical case..." / "the evidence supports..." and never an instruction to bet.
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

type Group = 'tonight' | 'recent' | 'season' | 'history'

const RECENT: Horizon[] = ['last7', 'last15', 'last30']
const SEASON: Horizon[] = ['season', 'season_vs_opp']

const groupOf = (h: Horizon): Group => (h === 'tonight' ? 'tonight' : RECENT.includes(h) ? 'recent' : SEASON.includes(h) ? 'season' : 'history')

const SAFE_FIRST = /^(has|have|is|are|was|were|commands|played|playing|cleared|averaging|last|over|earlier|in|at|on|against|the|both|neither|opposing|missed|early|batting|hitting|usage|clear|operating|forecast|wind|a|an|tonight's|season|rate|games|career)\b/i
const lower = (s: string) => (SAFE_FIRST.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s)
const clean = (s: string) => s.replace(/\s+/g, ' ').replace(/[.\s]+$/, '')

const LEAD: Record<Group, string> = {
  tonight: "Tonight's setup matters most here:",
  recent: 'In recent form,',
  season: 'Across this season,',
  history: 'Historically,',
}

const pct = (r: number) => `${Math.round(r * 100)}%`
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

/**
 * When a recent window differs sharply from the full season, say so with both numbers and name the filter that lets the
 * reader check the trend (the research tools on the player page, leaders and game tabs use the same windows).
 */
function contrastSentence(items: Edge[], sport: string | undefined, isPlayer: boolean): string | null {
  const season = items.find((e) => horizonOf(e) === 'season' && e.metrics?.rate !== undefined)
  const windows = items.filter((e) => RECENT.includes(horizonOf(e)) && e.metrics?.rate !== undefined && (e.metrics?.n ?? 0) >= 4)
  if (!season || windows.length === 0) return null
  const w = windows.sort((a, b) => Math.abs((b.metrics!.rate as number) - (season.metrics!.rate as number)) - Math.abs((a.metrics!.rate as number) - (season.metrics!.rate as number)))[0]
  const wr = w.metrics!.rate as number
  const sr = season.metrics!.rate as number
  if (Math.abs(wr - sr) < 0.1) return null
  const n = w.metrics!.n as number
  return `The last ${n}-game window shows ${pct(wr)} — notably ${wr > sr ? 'above' : 'below'} the full-season ${pct(sr)} — so explore this trend using the ${filterLabel(sport, n)} filter${isPlayer ? ' on the player page' : ''}.`
}

/** A recent role expansion outweighs older matchup data: say so, and say which window is the predictive one. */
function expansionSentence(items: Edge[]): string | null {
  const exp = items.find((e) => e.category === 'role' && /expan(ded|sion)/i.test(e.description) && !/cascade|across reception/i.test(e.description))
  if (!exp) return null
  const history = items.some((e) => ['career', 'career_vs_opp', 'recent_meetings'].includes(horizonOf(e)))
  const n = exp.metrics?.n ?? exp.sample ?? 4
  return `${history ? 'The career and head-to-head record is' : 'Older history is'} weighted less heavily here given the clear recent role expansion — the last ${n}-game window is the most predictive for tonight's specific situation.`
}

/** A sentence about which horizon is doing the work, grounded in the actual numbers when the evidence carries them. */
function horizonSentence(items: Edge[], opp: string | undefined): string | null {
  const rates = (hs: Horizon[]) => items.filter((e) => hs.includes(horizonOf(e)) && e.metrics?.rate !== undefined)
  const recent = rates(RECENT)
  const longer = rates(['career', 'career_vs_opp'])
  if (recent.length && longer.length) {
    const r = recent.reduce((n, e) => n + (e.metrics!.rate as number), 0) / recent.length
    const c = longer.reduce((n, e) => n + (e.metrics!.rate as number), 0) / longer.length
    if (r - c >= 0.1) return `While the longer-run rate is lower at ${pct(c)}, the recent rate of ${pct(r)} is more predictive because it reflects the current role and form.`
    if (c - r >= 0.1) return `Recent results (${pct(r)}) trail the longer-run rate of ${pct(c)}, so the longer history carries more of the weight in this case.`
  }
  const specific = items.filter((e) => ['career_vs_opp', 'season_vs_opp', 'recent_meetings'].includes(horizonOf(e)))
  if (specific.length && opp) return `The record against ${opp} counts for more than a general average because it is specific to tonight's matchup.`
  const total = items.reduce((n, e) => n + strength(e), 0)
  if (total <= 0) return null
  const share = (g: Group[]) => items.filter((e) => g.includes(groupOf(horizonOf(e)))).reduce((n, e) => n + strength(e), 0) / total
  if (share(['tonight', 'recent']) >= 0.6) return "Most of the weight sits on tonight's conditions and recent form rather than the long-run record."
  if (share(['season', 'history']) >= 0.6) return 'Most of the weight sits on the season-long and historical record, with little in the short term pushing either way.'
  return null
}

/** Drops a trailing "this season" when the sentence already opens with "Across this season,". */
const seasonTrim = (t: string) => t.replace(/ (?:in|across) the season$/i, '').replace(/(\d+ games?) this season/i, '$1')

/**
 * generateBetExplanation: three to five sentences connecting the evidence. It leads with tonight's conditions, then
 * recent form, the season and the history, says which horizon matters most and why, and ends with the grade and the
 * main uncertainty.
 */
export function generateBetExplanation(outcome: Pick<BettingOutcome, 'type' | 'direction' | 'player' | 'team' | 'opponent'>, evidenceItems: Edge[], convictionScore: number, grade: string, gameContext: ExplanationContext, meta: ExplanationMeta): string {
  const opp = outcome.opponent ?? outcome.team?.opponent
  const items = [...evidenceItems].sort((a, b) => strength(b) - strength(a))
  const sentences: string[] = []

  // The closing pieces are worked out first so the body can leave room for them (five sentences at most).
  const notes: string[] = []
  if (meta.impliedProbability !== null && meta.historicalHitRate !== null && meta.impliedProbability >= meta.historicalHitRate) {
    notes.push(`the price already implies ${Math.round(meta.impliedProbability)}%, at or above the ${Math.round(meta.historicalHitRate)}% the history supports, so the market has priced in the case`)
  }
  if (meta.conflicts > 0) notes.push(`${meta.conflicts === 1 ? 'one factor points' : `${meta.conflicts} factors point`} the other way, which lowers the grade`)
  if (meta.limitedSample) notes.push('the main sample is under 10 games')
  if (gameContext.season.isPlayoffs) notes.push('playoff weighting leans on recent form and matchup-specific evidence over season-long trends')
  else if (gameContext.season.isEarlySeason || gameContext.priorSeasonOnly) notes.push('it is early in the season, so current-season samples are small and history carries more weight')
  const uncertainty = notes.length ? ` Main uncertainty: ${notes.slice(0, 2).join('; ')}.` : ''
  const isProp = outcome.type === 'player_prop'
  const noOdds = !gameContext.hasOdds ? `, based on statistical evidence only because live ${isProp ? 'prop ' : ''}odds are not currently available` : ''
  const sharp = meta.isSharpFind && meta.historicalHitRate !== null && meta.impliedProbability !== null ? `The historical rate of ${Math.round(meta.historicalHitRate)}% sits ${Math.round(meta.historicalHitRate - meta.impliedProbability)} points above the ${Math.round(meta.impliedProbability)}% the price implies, which is why this is flagged as a Sharp Find.` : null
  const isPlayer = outcome.type === 'player_prop'
  const expansion = items.length ? expansionSentence(items) : null
  const horizon = items.length ? (expansion ?? horizonSentence(items, opp)) : null
  const contrast = items.length ? contrastSentence(items, gameContext.sport, isPlayer) : null

  if (items.length === 0) {
    sentences.push(`There is not enough qualifying evidence to form a view on ${meta.description}, so the statistical case is thin either way.`)
  } else {
    const strong = grade === 'A' || grade === 'B' || grade === 'C'
    const order: Group[] = ['tonight', 'recent', 'season', 'history']
    const room = 6 - 1 - (horizon ? 1 : 0) - (contrast ? 1 : 0) - (sharp ? 1 : 0) - (uncertainty ? 1 : 0)
    const picked = order
      .map((g) => ({ g, e: items.find((e) => groupOf(horizonOf(e)) === g) }))
      .filter((x): x is { g: Group; e: Edge } => !!x.e)
      .sort((a, b) => strength(b.e) - strength(a.e))
      .slice(0, Math.max(2, Math.min(3, room)))
      .sort((a, b) => order.indexOf(a.g) - order.indexOf(b.g))
    const OPEN: Record<Group, string> = { tonight: "starts with tonight's setup:", recent: 'starts with recent form:', season: "rests on this season's numbers:", history: 'rests on the historical record:' }
    const text = (g: Group, e: Edge) => lower(clean(g === 'season' ? seasonTrim(clean(e.description)) : e.description))
    picked.forEach((p, i) => {
      if (i === 0) sentences.push(`${strong ? `The statistical case for ${meta.description}` : `The evidence for ${meta.description} is limited and`} ${OPEN[p.g]} ${text(p.g, p.e)}.`)
      else sentences.push(`${LEAD[p.g]} ${text(p.g, p.e)}.`)
    })
    if (picked.length < 2 && items.length > picked.length) {
      const extra = items.find((e) => !picked.some((p) => p.e === e))
      if (extra) sentences.push(`Supporting that, ${lower(clean(extra.description))}.`)
    }
    if (horizon) sentences.push(horizon)
    if (contrast) sentences.push(contrast)
  }
  if (sharp) sentences.push(sharp)
  sentences.push(`On the SharpSlip scale this grades ${grade} (conviction ${convictionScore.toFixed(2)})${noOdds}.${uncertainty}`)
  return sentences.join(' ')
}
