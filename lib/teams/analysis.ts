import type { GameResult, LineRecord, SituationRecord, StatLine, Tone, TrendCard, TeamGame } from './types'

export type Outcome = 'W' | 'L' | 'P' | null

export const finals = (games: TeamGame[]) => games.filter((g) => g.state === 'Final' && g.us !== null && g.them !== null)

/** Oldest → newest. */
export const chronological = (games: TeamGame[]) => [...games].sort((a, b) => `${a.date}${a.startTime ?? ''}`.localeCompare(`${b.date}${b.startTime ?? ''}`))

export function margin(g: TeamGame): number {
  return (g.us ?? 0) - (g.them ?? 0)
}

/** Win/loss as the sport counts it (overtime losses are losses for betting purposes). */
export function moneyline(g: TeamGame): Outcome {
  if (g.us === null || g.them === null) return null
  return g.us > g.them ? 'W' : g.us < g.them ? 'L' : 'P'
}

/** Cover result against the game's real spread, when there is one. */
export function atsOutcome(g: TeamGame): Outcome {
  if (g.spread === null || g.us === null || g.them === null) return null
  const diff = g.us - g.them + g.spread
  return diff > 0 ? 'W' : diff < 0 ? 'L' : 'P'
}

export function totalOutcome(g: TeamGame): 'O' | 'U' | 'P' | null {
  if (g.total === null || g.us === null || g.them === null) return null
  const sum = g.us + g.them
  return sum > g.total ? 'O' : sum < g.total ? 'U' : 'P'
}

/** Fixed ±1.5 line (run line / puck line): −1.5 needs a win by 2+, +1.5 needs not losing by 2+. */
export function lineOutcome(g: TeamGame, side: -1.5 | 1.5): Outcome {
  if (g.us === null || g.them === null) return null
  return margin(g) + side > 0 ? 'W' : 'L'
}

export function tally(games: TeamGame[], fn: (g: TeamGame) => Outcome) {
  let wins = 0
  let losses = 0
  let pushes = 0
  for (const g of games) {
    const o = fn(g)
    if (o === 'W') wins++
    else if (o === 'L') losses++
    else if (o === 'P') pushes++
  }
  return { wins, losses, pushes }
}

export const recordString = (t: { wins: number; losses: number; pushes: number }) => `${t.wins}-${t.losses}${t.pushes > 0 ? `-${t.pushes}` : ''}`

export const pctOf = (t: { wins: number; losses: number }) => (t.wins + t.losses > 0 ? Math.round((t.wins / (t.wins + t.losses)) * 1000) / 10 : null)

/** Percent tone used across the app: above 55 good, below 45 bad. */
export function pctTone(pct: number | null): Tone {
  if (pct === null) return 'neutral'
  return pct > 55 ? 'good' : pct < 45 ? 'bad' : 'neutral'
}

export function diffTone(n: number): Tone {
  return n > 0 ? 'good' : n < 0 ? 'bad' : 'neutral'
}

/** Longest current run of the same outcome from the newest game back; returns that outcome and its length. */
function currentRun(outcomes: Outcome[]): { outcome: Outcome; count: number } {
  const real = outcomes.filter((o) => o === 'W' || o === 'L')
  if (real.length === 0) return { outcome: null, count: 0 }
  const first = real[0]
  let count = 0
  for (const o of real) {
    if (o === first) count++
    else break
  }
  return { outcome: first, count }
}

/** Builds a betting-line record row from a per-game outcome function (most recent games count for the last-10 and streak). */
export function lineRecord(label: string, games: TeamGame[], fn: (g: TeamGame) => Outcome, opts: { winWord?: string; note?: string } = {}): LineRecord {
  const played = chronological(finals(games)).reverse() // newest first
  const all = tally(played, fn)
  const last = tally(played.filter((g) => fn(g) !== null).slice(0, 10), fn)
  const run = currentRun(played.map(fn))
  const word = opts.winWord ?? 'Covered'
  return {
    label,
    ...all,
    pct: pctOf(all),
    last10: recordString(last),
    streak: run.outcome === 'W' && run.count >= 3 ? `${word} ${run.count} straight` : run.outcome === 'L' && run.count >= 3 ? `Missed ${run.count} straight` : null,
    note: opts.note,
  }
}

/** Over/Under as two line records off the same totals. */
export function overUnderRecords(games: TeamGame[], note?: string): [LineRecord, LineRecord] {
  return [
    lineRecord('Over', games, (g) => { const o = totalOutcome(g); return o === 'O' ? 'W' : o === 'U' ? 'L' : o === 'P' ? 'P' : null }, { winWord: 'Over in', note }),
    lineRecord('Under', games, (g) => { const o = totalOutcome(g); return o === 'U' ? 'W' : o === 'O' ? 'L' : o === 'P' ? 'P' : null }, { winWord: 'Under in', note }),
  ]
}

export function situation(label: string, games: TeamGame[], pred: (g: TeamGame) => boolean, withAts: boolean): SituationRecord | null {
  const subset = finals(games).filter(pred)
  if (subset.length === 0) return null
  const ml = tally(subset, moneyline)
  const ats = tally(subset, atsOutcome)
  return { label, record: recordString(ml), pct: pctOf(ml), ats: withAts && ats.wins + ats.losses + ats.pushes > 0 ? recordString(ats) : null }
}

/** For "after a win / loss" splits: the previous game's result decides which games are included. */
export function withPrevious(games: TeamGame[]): (TeamGame & { prev: Outcome })[] {
  const ordered = chronological(finals(games))
  return ordered.map((g, i) => ({ ...g, prev: i === 0 ? null : moneyline(ordered[i - 1]) }))
}

// ---------------------------------------------------------------------------
// Trends
// ---------------------------------------------------------------------------

interface TrendOpts {
  /** "Scored N+" threshold for the scoring-streak trend (e.g. 110 for NBA). */
  scoreAt: number
  scoreWord: string
  allowAt: number
  allowWord: string
  /** Lower-is-better allowance trend ("held opponents under N"). */
  hasSpread: boolean
  hasTotal: boolean
  totalProxy: boolean
}

function streakLength(games: TeamGame[], pred: (g: TeamGame) => boolean): number {
  let n = 0
  for (const g of games) {
    if (pred(g)) n++
    else break
  }
  return n
}

/** 5–8 trend cards drawn from real results: streaks, covers, totals and scoring runs. */
export function buildTrends(allGames: TeamGame[], o: TrendOpts): TrendCard[] {
  const played = chronological(finals(allGames)).reverse() // newest first
  if (played.length < 5) return []
  const cards: (TrendCard & { score: number })[] = []
  const add = (score: number, card: TrendCard) => cards.push({ ...card, score })

  const wins = streakLength(played, (g) => moneyline(g) === 'W')
  const losses = streakLength(played, (g) => moneyline(g) === 'L')
  if (wins >= 3) add(wins * 2, { icon: '🔥', headline: `Won ${wins} straight`, detail: `Last ${wins} games all wins${o.hasSpread ? '' : ''}.`, tone: 'good' })
  if (losses >= 3) add(losses * 2, { icon: '🧊', headline: `Lost ${losses} straight`, detail: `Dropped the last ${losses} games.`, tone: 'bad' })

  const last10 = played.slice(0, 10)
  const l10 = tally(last10, moneyline)
  add(Math.abs(l10.wins - l10.losses), { icon: '📈', headline: `${recordString(l10)} in the last ${last10.length}`, detail: 'Straight-up record over the most recent games.', tone: l10.wins > l10.losses ? 'good' : l10.wins < l10.losses ? 'bad' : 'neutral' })

  const home = tally(played.filter((g) => g.home), moneyline)
  const away = tally(played.filter((g) => !g.home), moneyline)
  if (home.wins + home.losses >= 5 && away.wins + away.losses >= 5) {
    const hp = pctOf(home) ?? 0
    const ap = pctOf(away) ?? 0
    if (Math.abs(hp - ap) >= 15) add(Math.abs(hp - ap) / 5, { icon: hp > ap ? '🏟️' : '✈️', headline: hp > ap ? `Strong at home (${recordString(home)})` : `Better on the road (${recordString(away)})`, detail: `Home ${recordString(home)} vs away ${recordString(away)}.`, tone: 'neutral' })
  }

  if (o.hasSpread) {
    const run = streakLength(played, (g) => atsOutcome(g) === 'W')
    const miss = streakLength(played, (g) => atsOutcome(g) === 'L')
    if (run >= 3) add(run * 2, { icon: '✅', headline: `Covered ${run} straight`, detail: `The last ${run} spreads all covered.`, tone: 'good' })
    if (miss >= 3) add(miss * 2, { icon: '❌', headline: `Failed to cover ${miss} straight`, detail: `The last ${miss} spreads all missed.`, tone: 'bad' })
    const a10 = tally(last10, atsOutcome)
    if (a10.wins + a10.losses >= 5) add(Math.abs(a10.wins - a10.losses), { icon: '📏', headline: `${recordString(a10)} ATS in the last ${a10.wins + a10.losses + a10.pushes}`, detail: 'Against the spread over the most recent games.', tone: a10.wins > a10.losses ? 'good' : a10.wins < a10.losses ? 'bad' : 'neutral' })
  }

  if (o.hasTotal) {
    const t10 = last10.map(totalOutcome).filter((x) => x === 'O' || x === 'U')
    const overs = t10.filter((x) => x === 'O').length
    const unders = t10.filter((x) => x === 'U').length
    const suffix = o.totalProxy ? ' (vs league-average total)' : ''
    if (t10.length >= 7 && overs >= 6) add(overs, { icon: '⬆️', headline: `Over hit ${overs} of last ${t10.length}`, detail: `Games have cleared the total${suffix}.`, tone: 'neutral' })
    if (t10.length >= 7 && unders >= 6) add(unders, { icon: '⬇️', headline: `Under hit ${unders} of last ${t10.length}`, detail: `Games have stayed below the total${suffix}.`, tone: 'neutral' })
  }

  const scoring = streakLength(played, (g) => (g.us ?? 0) >= o.scoreAt)
  if (scoring >= 3) add(scoring * 1.5, { icon: '💥', headline: `${o.scoreWord} ${o.scoreAt}+ in ${scoring} straight`, detail: 'Consistent offense lately.', tone: 'good' })
  const stingy = streakLength(played, (g) => (g.them ?? 99) <= o.allowAt)
  if (stingy >= 3) add(stingy * 1.5, { icon: '🛡️', headline: `Allowed ${o.allowAt} or fewer in ${stingy} straight`, detail: `${o.allowWord} on defense.`, tone: 'good' })

  const close = played.filter((g) => Math.abs(margin(g)) <= (o.scoreAt >= 50 ? 5 : 1))
  const closeTally = tally(close, moneyline)
  if (close.length >= 6) add(Math.abs(closeTally.wins - closeTally.losses), { icon: '🎯', headline: `${recordString(closeTally)} in one-possession games`, detail: `${close.length} games decided by the slimmest margins.`, tone: closeTally.wins > closeTally.losses ? 'good' : 'bad' })

  return cards
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ score: _score, ...card }) => card)
}

// ---------------------------------------------------------------------------
// League comparison
// ---------------------------------------------------------------------------

/** Rank of `abbr` among `values` (1 = best) plus the league average and a 0..1 comparison-bar position. */
export function compareStat(
  label: string,
  abbr: string,
  values: { abbr: string; value: number }[],
  opts: { higherBetter: boolean; format: (n: number) => string }
): StatLine | null {
  const mine = values.find((v) => v.abbr === abbr)
  if (!mine || values.length === 0) return null
  const sorted = [...values].sort((a, b) => (opts.higherBetter ? b.value - a.value : a.value - b.value))
  const rank = sorted.findIndex((v) => v.abbr === abbr) + 1
  const avg = values.reduce((s, v) => s + v.value, 0) / values.length
  const min = Math.min(...values.map((v) => v.value))
  const max = Math.max(...values.map((v) => v.value))
  const span = max - min || 1
  // Bar position always grows with "better", so a full bar means league-best whichever direction the stat runs.
  const pos = (mine.value - min) / span
  return {
    label,
    value: opts.format(mine.value),
    rank,
    total: values.length,
    leagueAvg: opts.format(avg),
    barPct: opts.higherBetter ? pos : 1 - pos,
    better: mine.value === avg ? null : opts.higherBetter ? mine.value > avg : mine.value < avg,
  }
}

export const resultFromScore = (us: number, them: number, extra: boolean, hasOtl: boolean): GameResult => (us > them ? 'W' : us < them ? (extra && hasOtl ? 'OTL' : 'L') : 'T')
