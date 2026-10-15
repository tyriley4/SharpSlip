import { MIN_CAREER_GAMES, MIN_SEASON_GAMES, MIN_SIGNAL_RATE, MIN_SPLIT_GAMES, daysSince, weightedPlayerRate, weightedTeamRate, type Rate } from '../historicalRates'
import type { BettingOutcome, Edge, GameContext, ModuleOutput, TeamGameRecord } from '../types'
import { q } from '../evidenceFramework'
import { fmtPct, lineNoun, scaled, newestSeason, outcomeNoun, playerHit, rateRelevance, subjectTeam, teamEvidenceGames, teamHit, type ModuleInput } from './shared'

const W_SEASON = 0.28
const W_CAREER = 0.2
const W_SPLIT = 0.1
const W_TREND = 0.05

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
 * Matchup-adjusted rate for a moneyline or spread: the backed team own record at this exact number, blended (log5)
 * with how often the opponent fails in the mirrored spot. Both sides of a market therefore sum to about 100%.
 */
export function pairRate(o: BettingOutcome, game: GameContext, filter?: (g: TeamGameRecord) => boolean, oppFilter?: (g: TeamGameRecord) => boolean): PairRate | null {
  const team = subjectTeam(o)
  const opp = o.team?.opponent
  if (!team || !opp) return null
  const mine = (game.results[team] ?? []).filter(filter ?? (() => true))
  const theirs = (game.results[opp] ?? []).filter(oppFilter ?? (() => true))
  const own = weightedTeamRate(mine, (g) => teamHit(o, g))
  const them = weightedTeamRate(theirs, (g) => opponentFails(o, g))
  if (!own || !them) return null
  return { rate: log5(own.rate, them.rate), games: Math.min(own.games, them.games), own, theirs: them }
}

/** Recency-weighted rate of the exact outcome (the headline "61% historical"), or null below the minimum sample. */
export function primaryRate({ outcome, game, history }: ModuleInput): Rate | null {
  if (outcome.type === 'moneyline' || outcome.type === 'spread') {
    const p = pairRate(outcome, game)
    return p && p.games >= scaled(MIN_SEASON_GAMES, game) ? { rate: p.rate, hits: Math.round(p.rate * p.games), games: p.games } : null
  }
  const r =
    outcome.type === 'player_prop'
      ? history
        ? weightedPlayerRate(history.games, (g) => playerHit(outcome, g))
        : null
      : weightedTeamRate(teamEvidenceGames(outcome, game), (g) => teamHit(outcome, g))
  return r && r.games >= scaled(MIN_SEASON_GAMES, game) ? r : null
}

const rec = (r: { hits: number; games: number }) => `${r.hits}-${r.games - r.hits}`

/** MODULE 2: how often has this exact outcome happened? Season, career/multi-season, venue split and monthly trend. */
export function hitRateModule(input: ModuleInput): ModuleOutput {
  const { outcome: o, game, history } = input
  const edges: Edge[] = []
  let conflicts = 0
  const noun = outcomeNoun(o)
  const homeFlag = o.homeAway === 'home' ? true : o.homeAway === 'away' ? false : null

  const push = (e: Edge) => edges.push(e)

  if (o.type === 'player_prop') {
    if (!history) return { edges, conflicts }
    const games = history.games
    const season = newestSeason(games)
    if (!season) return { edges, conflicts }
    const seasonGames = games.filter((g) => g.season === season)
    const lastGameAge = seasonGames.length ? daysSince(seasonGames[0].date) : 999
    const seasonWord = lastGameAge > 60 ? 'last season' : 'this season'

    const sr = weightedPlayerRate(seasonGames, (g) => playerHit(o, g))
    if (sr && sr.games >= scaled(MIN_SEASON_GAMES, game)) {
      if (sr.rate > MIN_SIGNAL_RATE) {
        push({ description: `Cleared ${noun} in ${fmtPct(sr.rate)} of ${sr.games} games ${seasonWord}`, category: 'hit_rate', relevanceScore: rateRelevance(sr.rate), supportingData: `${rec(sr)} ${seasonWord}`, weight: W_SEASON, sample: sr.games, seasonsAgo: seasonWord === 'this season' ? 0 : 1, quality: q(2, 2, seasonWord === 'this season' ? 2 : 1, sr.games >= 30 ? 3 : sr.games >= 15 ? 2 : 1) })
      } else if (sr.rate < 0.48) conflicts++
    }

    const cr = weightedPlayerRate(games, (g) => playerHit(o, g))
    if (cr && cr.games >= scaled(MIN_CAREER_GAMES, game)) {
      const seasons = new Set(games.map((g) => g.season)).size
      if (cr.rate > MIN_SIGNAL_RATE) {
        push({ description: `Career weighted rate for ${noun}: ${fmtPct(cr.rate)} across ${cr.games} games`, category: 'hit_rate', relevanceScore: rateRelevance(cr.rate), supportingData: `${rec(cr)} over ${seasons} season${seasons === 1 ? '' : 's'}, recent seasons weighted more`, weight: W_CAREER, sample: cr.games, seasonsAgo: 1, quality: q(2, 1, 1, 3) })
      } else if (cr.rate < 0.48) conflicts++
    }

    if (homeFlag !== null) {
      const venue = games.filter((g) => g.home === homeFlag)
      const vr = weightedPlayerRate(venue, (g) => playerHit(o, g))
      if (vr && vr.games >= scaled(MIN_SPLIT_GAMES, game) && vr.rate > MIN_SIGNAL_RATE) {
        push({ description: `${homeFlag ? 'At home' : 'On the road'}, cleared ${noun} in ${fmtPct(vr.rate)} of ${vr.games} games`, category: 'hit_rate', relevanceScore: rateRelevance(vr.rate), supportingData: `${rec(vr)} ${homeFlag ? 'home' : 'away'}`, weight: W_SPLIT, sample: vr.games, quality: q(3, 2, 2, vr.games >= 30 ? 3 : vr.games >= 15 ? 2 : 1) })
      }
    }

    // Monthly trend: the last 30 days against the rest of the same season.
    if (seasonGames.length >= scaled(MIN_SEASON_GAMES, game)) {
      const latest = Date.parse(seasonGames[0].date)
      const recent = seasonGames.filter((g) => latest - Date.parse(g.date) <= 30 * 86400000)
      const rr = weightedPlayerRate(recent, (g) => playerHit(o, g))
      if (rr && rr.games >= scaled(MIN_SPLIT_GAMES, game) && sr && rr.rate > MIN_SIGNAL_RATE && rr.rate - sr.rate >= 0.08 && lastGameAge <= 30) {
        push({ description: `Rate has been improving: ${fmtPct(rr.rate)} over the last 30 days against ${fmtPct(sr.rate)} for the season`, category: 'hit_rate', relevanceScore: rateRelevance(rr.rate), supportingData: `${rec(rr)} in the last 30 days`, weight: W_TREND, sample: rr.games, ageDays: Math.min(lastGameAge, 30), quality: q(3, 2, 3, 1) })
      }
    }
    return { edges, conflicts }
  }

  // Team outcomes. Moneyline and spread blend both teams (log5); totals pool both teams games.
  const team = subjectTeam(o)
  const opp = o.team?.opponent
  if (o.type !== 'total') {
    if (!team || !opp) return { edges, conflicts }
    const what = o.type === 'moneyline' ? 'win' : `cover ${lineNoun(o)}`
    const explain = (p: PairRate) => `${team} ${o.type === 'moneyline' ? 'won' : 'covered'} ${fmtPct(p.own.hits / p.own.games)} of ${p.own.games} games; ${opp} ${o.type === 'moneyline' ? 'lost' : 'failed to cover the mirrored number'} ${fmtPct(p.theirs.hits / p.theirs.games)} of ${p.theirs.games}`
    const curOnly = (abbr: string) => {
      const g = game.results[abbr] ?? []
      const season = g.length ? Math.max(...g.map((x) => x.season)) : 0
      return (x: TeamGameRecord) => x.season === season
    }
    const season = pairRate(o, game, curOnly(team), curOnly(opp))
    if (season && season.games >= scaled(MIN_SEASON_GAMES, game)) {
      if (season.rate > MIN_SIGNAL_RATE) push({ description: `Matchup-adjusted this season: ${team} to ${what} about ${fmtPct(season.rate)} of the time`, category: 'hit_rate', relevanceScore: rateRelevance(season.rate), supportingData: explain(season), weight: W_SEASON, sample: season.games, quality: q(2, 2, 2, season.games >= 30 ? 3 : season.games >= 15 ? 2 : 1) })
      else if (season.rate < 0.48) conflicts++
    }
    const multi = pairRate(o, game)
    if (multi && multi.games >= scaled(MIN_CAREER_GAMES, game)) {
      const seasons = new Set((game.results[team] ?? []).map((g) => g.season)).size
      if (multi.rate > MIN_SIGNAL_RATE) push({ description: `Over the last ${seasons} season${seasons === 1 ? '' : 's'}, results point to ${team} to ${what} about ${fmtPct(multi.rate)} of the time against this kind of opponent`, category: 'hit_rate', relevanceScore: rateRelevance(multi.rate), supportingData: explain(multi) + '; current season weighted most', weight: W_CAREER, sample: multi.games, seasonsAgo: 1, quality: q(2, 2, 1, 3) })
      else if (multi.rate < 0.48) conflicts++
    }
    if (homeFlag !== null) {
      const venue = pairRate(o, game, (g) => g.home === homeFlag, (g) => g.home === !homeFlag)
      if (venue && venue.games >= scaled(MIN_SPLIT_GAMES, game) && venue.rate > MIN_SIGNAL_RATE) push({ description: `${homeFlag ? 'At home' : 'On the road'}, ${team} to ${what} about ${fmtPct(venue.rate)} of the time when ${opp} is ${homeFlag ? 'away' : 'at home'}`, category: 'hit_rate', relevanceScore: rateRelevance(venue.rate), supportingData: explain(venue), weight: W_SPLIT, sample: venue.games, quality: q(3, 2, 2, venue.games >= 20 ? 3 : 2) })
    }
    return { edges, conflicts }
  }

  const all = teamEvidenceGames(o, game)
  const curSeason = all.length ? Math.max(...all.map((g) => g.season)) : 0
  const cur = all.filter((g) => g.season === curSeason)
  const label = 'Games cleared ' + noun
  const sr = weightedTeamRate(cur, (g) => teamHit(o, g))
  if (sr && sr.games >= scaled(MIN_SEASON_GAMES, game)) {
    if (sr.rate > MIN_SIGNAL_RATE) push({ description: `${label} in ${fmtPct(sr.rate)} of ${sr.games} games this season for these two teams`, category: 'hit_rate', relevanceScore: rateRelevance(sr.rate), supportingData: `${rec(sr)} in ${curSeason}`, weight: W_SEASON, sample: sr.games, quality: q(2, 2, 2, sr.games >= 30 ? 3 : 2) })
    else if (sr.rate < 0.48) conflicts++
  }
  const multi = weightedTeamRate(all, (g) => teamHit(o, g))
  if (multi && multi.games >= scaled(MIN_CAREER_GAMES, game)) {
    const seasons = new Set(all.map((g) => g.season)).size
    if (multi.rate > MIN_SIGNAL_RATE) push({ description: `Over the last ${seasons} season${seasons === 1 ? '' : 's'}: ${label.toLowerCase()} in ${fmtPct(multi.rate)} of ${multi.games} games for these teams`, category: 'hit_rate', relevanceScore: rateRelevance(multi.rate), supportingData: `${rec(multi)}, current season weighted most`, weight: W_CAREER, sample: multi.games, seasonsAgo: 1, quality: q(2, 2, 1, 3) })
    else if (multi.rate < 0.48) conflicts++
  }
  return { edges, conflicts }
}
