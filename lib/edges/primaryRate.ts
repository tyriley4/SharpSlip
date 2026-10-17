import { MIN_SEASON_GAMES, weightedPlayerRate, weightedTeamRate, type Rate } from './historicalRates'
import { playerHit, scaled, seasonWeightFn, subjectTeam, teamEvidenceGames, teamHit, type ModuleInput } from './modules/shared'
import type { BettingOutcome, GameContext, TeamGameRecord } from './types'

/** Chance both sides line up: a (the side's own rate) combined with b (how often the other side fails to stop it). */
export function log5(a: number, b: number): number {
  const num = a * b
  const den = num + (1 - a) * (1 - b)
  return den === 0 ? 0.5 : num / den
}

/** Did the opponent FAIL where the backed side needed it to (lose the game / not cover the mirrored number)? */
export function opponentFails(o: BettingOutcome, g: TeamGameRecord): boolean | null {
  if (o.type === 'moneyline') return g.us === g.them ? null : g.us < g.them
  if (o.type === 'spread' && o.threshold !== undefined) {
    const m = g.us - g.them - o.threshold
    return m === 0 ? null : m < 0
  }
  return null
}

export interface PairRate {
  rate: number
  games: number
  own: Rate
  theirs: Rate
}

/**
 * Matchup-adjusted rate for a moneyline or spread: the backed team's own record at this exact number, blended (log5) with
 * how often the opponent fails in the mirrored spot. Both sides of a market therefore sum to about 100%.
 */
export function pairRate(o: BettingOutcome, game: GameContext): PairRate | null {
  const team = subjectTeam(o)
  const opp = o.team?.opponent
  if (!team || !opp) return null
  const own = weightedTeamRate(game.results[team] ?? [], (g) => teamHit(o, g))
  const them = weightedTeamRate(game.results[opp] ?? [], (g) => opponentFails(o, g))
  if (!own || !them) return null
  return { rate: log5(own.rate, them.rate), games: Math.min(own.games, them.games), own, theirs: them }
}

/**
 * The recency-weighted rate of the exact outcome (the headline "61% historical"), or null below the minimum sample. It is
 * the number the grade's market layer compares to the price; the evidence the user reads is the W-L records built in the
 * sport modules.
 */
export function primaryRate({ outcome, game, history }: ModuleInput): Rate | null {
  if (outcome.type === 'moneyline' || outcome.type === 'spread') {
    const p = pairRate(outcome, game)
    return p && p.games >= scaled(MIN_SEASON_GAMES, game) ? { rate: p.rate, hits: Math.round(p.rate * p.games), games: p.games } : null
  }
  const r =
    outcome.type === 'player_prop'
      ? history
        ? weightedPlayerRate(history.games, (g) => playerHit(outcome, g), seasonWeightFn(history))
        : null
      : weightedTeamRate(teamEvidenceGames(outcome, game), (g) => teamHit(outcome, g))
  return r && r.games >= scaled(MIN_SEASON_GAMES, game) ? r : null
}
