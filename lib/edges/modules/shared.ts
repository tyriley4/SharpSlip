import type { BettingOutcome, Edge, GameContext, PlayerGameRecord, PlayerHistory, TeamGameRecord } from '../types'

export interface ModuleInput {
  outcome: BettingOutcome
  game: GameContext
  history: PlayerHistory | null
}

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

/** How directly a hit rate bears on the outcome: 0.35 at the 52% floor, 1.0 near 85%. */
export const rateRelevance = (rate: number) => clamp01(0.35 + (rate - 0.52) * 2)

/** The team whose results are the evidence for a team outcome (the side being bet). */
export function subjectTeam(o: BettingOutcome): string | null {
  return o.team?.abbr ?? null
}

/** Did this player game clear the outcome? null when the stat is missing for the game. */
export function playerHit(o: BettingOutcome, g: PlayerGameRecord): boolean | null {
  if (!o.category || o.threshold === undefined) return null
  const v = g.values[o.category]
  if (typeof v !== 'number') return null
  return o.direction === 'under' ? v < o.threshold : v > o.threshold
}

/** Did this team game clear the outcome (win / cover / total)? */
export function teamHit(o: BettingOutcome, g: TeamGameRecord): boolean | null {
  if (o.type === 'moneyline') return g.us === g.them ? null : g.us > g.them
  if (o.type === 'spread') {
    if (o.threshold === undefined) return null
    const m = g.us - g.them + o.threshold
    return m === 0 ? null : m > 0
  }
  if (o.type === 'total') {
    if (o.threshold === undefined) return null
    const t = g.us + g.them
    if (t === o.threshold) return null
    return o.direction === 'under' ? t < o.threshold : t > o.threshold
  }
  return null
}

/** Games used as evidence for a team outcome: the subject team games, or both teams for a total. */
export function teamEvidenceGames(o: BettingOutcome, game: GameContext): TeamGameRecord[] {
  if (o.type === 'total') return [...(game.results[game.away] ?? []), ...(game.results[game.home] ?? [])]
  const t = subjectTeam(o)
  return t ? (game.results[t] ?? []) : []
}

export function newestSeason(games: PlayerGameRecord[]): string | null {
  return games.length ? Array.from(new Set(games.map((g) => g.season))).sort().reverse()[0] : null
}

export const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)

export const fmtPct = (r: number) => `${Math.round(r * 100)}%`

/** Words for the stat/bet being evaluated, e.g. "Over 2.5 Hits" or "Over 218.5 total points". */
export function outcomeNoun(o: BettingOutcome): string {
  const dir = o.direction === 'under' ? 'Under' : 'Over'
  if (o.type === 'player_prop') return `${dir} ${o.threshold} ${o.category}`
  if (o.type === 'total') return `${dir} ${o.threshold}`
  if (o.type === 'spread') return `${o.team?.abbr} ${o.threshold !== undefined && o.threshold > 0 ? '+' : ''}${o.threshold}`
  return `${o.team?.abbr} moneyline`
}

/** The line alone ("+1.5") for sentences that already name the team. */
export function lineNoun(o: BettingOutcome): string {
  return o.type === 'spread' ? `${o.threshold !== undefined && o.threshold > 0 ? '+' : ''}${o.threshold}` : outcomeNoun(o)
}

export function edge(partial: Omit<Edge, 'sample'> & { sample?: number }): Edge {
  return partial
}
