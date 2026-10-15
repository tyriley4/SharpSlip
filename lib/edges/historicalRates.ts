import type { PlayerGameRecord, TeamGameRecord } from './types'

/** Minimum games before a rate counts as evidence rather than noise. */
export const MIN_SEASON_GAMES = 8
export const MIN_CAREER_GAMES = 20
export const MIN_SPLIT_GAMES = 8
/** A hit rate at or below this is not a meaningful signal. */
export const MIN_SIGNAL_RATE = 0.52

/** Player history: current season counts double, older seasons fade. */
export function playerSeasonWeight(seasonsAgo: number): number {
  return seasonsAgo <= 0 ? 2.0 : seasonsAgo === 1 ? 1.5 : seasonsAgo === 2 ? 1.0 : 0.75
}

/** Team history: a rolling three-season window; roster turnover makes anything older unusable. */
export function teamSeasonWeight(seasonsAgo: number): number {
  return seasonsAgo <= 0 ? 2.0 : seasonsAgo === 1 ? 1.25 : seasonsAgo === 2 ? 0.75 : 0
}

/** Module-1 recency multipliers by how many days ago the evidence is from. */
export function recencyMultiplier(daysAgo: number): number {
  if (daysAgo <= 7) return 1.5
  if (daysAgo <= 14) return 1.25
  if (daysAgo <= 30) return 1.0
  return 0.85
}

export const daysSince = (isoDate: string, now = Date.now()) => Math.max(0, (now - Date.parse(isoDate)) / 86400000)

export interface Rate {
  /** 0-1, recency-weighted. */
  rate: number
  /** Unweighted hits and games, for record-style display. */
  hits: number
  games: number
}

/** Position of each season label among the labels present, newest = 0. */
export function seasonIndex(labels: string[]): Map<string, number> {
  const uniq = Array.from(new Set(labels)).sort().reverse()
  return new Map(uniq.map((l, i) => [l, i]))
}

/** Recency-weighted hit rate for a player over his logged games. */
export function weightedPlayerRate(games: PlayerGameRecord[], hit: (g: PlayerGameRecord) => boolean | null, weightFor: (seasonsAgo: number) => number = playerSeasonWeight): Rate | null {
  const idx = seasonIndex(games.map((g) => g.season))
  let w = 0
  let hw = 0
  let hits = 0
  let n = 0
  for (const g of games) {
    const r = hit(g)
    if (r === null) continue
    const weight = weightFor(idx.get(g.season) ?? 0)
    w += weight
    n++
    if (r) {
      hw += weight
      hits++
    }
  }
  return n === 0 ? null : { rate: hw / w, hits, games: n }
}

/** Recency-weighted rate for a team over the last three seasons only. */
export function weightedTeamRate(games: TeamGameRecord[], hit: (g: TeamGameRecord) => boolean | null): Rate | null {
  const seasons = Array.from(new Set(games.map((g) => g.season))).sort((a, b) => b - a)
  const idx = new Map(seasons.map((s, i) => [s, i]))
  let w = 0
  let hw = 0
  let hits = 0
  let n = 0
  for (const g of games) {
    const r = hit(g)
    if (r === null) continue
    const weight = teamSeasonWeight(idx.get(g.season) ?? 0)
    if (weight === 0) continue
    w += weight
    n++
    if (r) {
      hw += weight
      hits++
    }
  }
  return n === 0 ? null : { rate: hw / w, hits, games: n }
}

export const pct = (rate: number) => Math.round(rate * 100)

// ---------------------------------------------------------------------------
// Dynamic lookback
// ---------------------------------------------------------------------------

/**
 * The window that is most predictive is not fixed. It depends on what is being measured (a skill carries over a career, a
 * scheme only a few seasons, form a few weeks, a role a handful of games), how much of this season exists, whether the
 * player's role or career stage has changed, and how far along the season is. These helpers carry that logic.
 */
export type LookbackKind = 'skill' | 'scheme' | 'form' | 'matchup' | 'role' | 'situational'

export interface LookbackPlan {
  /** Seasons of history that are valid for this kind of pattern. */
  seasons: number
  /** Recent games that define the current window, when the kind is short-window. */
  games: number | null
  /** How much the current season outweighs history (multiplier on the current-season share). */
  currentLean: number
  note: string
}

/**
 * Pick the lookback for one kind of evidence. With little of the current season (0-4 games) it leans on history; with 5-10
 * it blends; past ten the current season leads. A role change or a young player discounts the older data.
 */
export function selectLookback(kind: LookbackKind, ctx: { currentGames: number; roleChanged?: boolean; stage?: 'ascending' | 'prime' | 'declining' | null }): LookbackPlan {
  const g = ctx.currentGames
  const currentLean = g <= 4 ? 0.7 : g <= 10 ? 1.0 : 1.25
  const youngOrChanged = ctx.roleChanged || ctx.stage === 'ascending' || ctx.stage === 'declining'
  const base: Record<LookbackKind, { seasons: number; games: number | null }> = {
    skill: { seasons: ctx.stage === 'declining' ? 2 : 5, games: null },
    scheme: { seasons: 3, games: null },
    form: { seasons: 1, games: 15 },
    matchup: { seasons: 5, games: null },
    role: { seasons: 1, games: 5 },
    situational: { seasons: 5, games: null },
  }
  const b = base[kind]
  return {
    seasons: ctx.roleChanged && kind !== 'situational' ? 1 : b.seasons,
    games: b.games,
    currentLean: youngOrChanged ? currentLean * 1.15 : currentLean,
    note: ctx.roleChanged ? 'role changed - older data discounted' : g <= 4 ? 'little of this season exists - history leads' : g <= 10 ? 'blending this season with history' : 'this season leads',
  }
}

/** Extra recent windows (beyond the 5/7/10 the recent-form module covers) worth testing for a sport. */
export function formWindows(sport: string, currentGames: number): number[] {
  const w = sport === 'mlb' ? [15, 30] : sport === 'nfl' || sport === 'cfb' ? [3, 15] : [15, 20]
  return w.filter((n) => n <= Math.max(3, currentGames + 10))
}

export interface SeasonPhaseWeights {
  /** The share of the case that rests on the current season, on history, and on tonight's conditions. */
  current: number
  historical: number
  tonight: number
  label: string
}

/** Season-phase weights by sport (the share each horizon group should carry at this point in the season). */
export function seasonPhase(sport: string, gamesPlayed: number, playoffs: boolean): SeasonPhaseWeights {
  const mk = (current: number, historical: number, tonight: number, label: string): SeasonPhaseWeights => ({ current, historical, tonight, label })
  if (sport === 'nfl') {
    if (playoffs) return mk(0.55, 0.2, 0.25, 'playoffs')
    return gamesPlayed <= 4 ? mk(0.3, 0.4, 0.3, 'weeks 1-4') : gamesPlayed <= 10 ? mk(0.45, 0.3, 0.25, 'weeks 5-10') : mk(0.55, 0.2, 0.25, 'weeks 11-17')
  }
  if (sport === 'mlb') {
    if (playoffs) return mk(0.5, 0.15, 0.35, 'playoffs')
    return gamesPlayed <= 30 ? mk(0.25, 0.45, 0.3, 'games 1-30') : gamesPlayed <= 81 ? mk(0.4, 0.35, 0.25, 'games 31-81') : mk(0.55, 0.25, 0.2, 'games 82-162')
  }
  if (sport === 'cfb') {
    if (playoffs) return mk(0.5, 0.2, 0.3, 'bowls and playoff')
    return gamesPlayed <= 4 ? mk(0.25, 0.45, 0.3, 'games 1-4') : gamesPlayed <= 8 ? mk(0.4, 0.35, 0.25, 'games 5-8') : mk(0.55, 0.25, 0.2, 'games 9+')
  }
  // NBA and NHL (college basketball follows the same shape on its shorter schedule).
  const scale = sport === 'cbb' ? 0.4 : 1
  if (playoffs) return mk(0.55, 0.15, 0.3, 'playoffs')
  return gamesPlayed <= 20 * scale ? mk(0.3, 0.4, 0.3, 'early season') : gamesPlayed <= 50 * scale ? mk(0.45, 0.3, 0.25, 'mid season') : mk(0.55, 0.2, 0.25, 'late season')
}

/**
 * Multiplier for an evidence group given the phase: each group's share relative to an even third, kept gentle so the phase
 * tilts the case without overturning it.
 */
export function phaseMultiplier(group: 'tonight' | 'current' | 'historical', phase: SeasonPhaseWeights | undefined): number {
  if (!phase) return 1
  const share = group === 'tonight' ? phase.tonight : group === 'current' ? phase.current : phase.historical
  return Math.max(0.8, Math.min(1.3, share / 0.333))
}

// ---------------------------------------------------------------------------
// Career stage
// ---------------------------------------------------------------------------

export type CareerStageName = 'ascending' | 'prime' | 'declining'

/** How much each window counts for a player at this stage, relative to a prime-years player. */
export function stageSeasonWeight(stage: CareerStageName | undefined, seasonsAgo: number): number {
  if (stage === 'ascending') return seasonsAgo <= 0 ? 2.0 : seasonsAgo === 1 ? 1.5 : 0.75
  if (stage === 'declining') return seasonsAgo <= 0 ? 2.0 : seasonsAgo === 1 ? 1.75 : seasonsAgo === 2 ? 1.25 : 0.6
  return seasonsAgo <= 0 ? 1.5 : seasonsAgo === 1 ? 1.25 : 1.0
}

/** Multipliers the engine applies to a player's evidence by horizon: current-season items and career items. */
export function stageEvidenceMultipliers(stage: CareerStageName | undefined): { current: number; career: number } {
  if (stage === 'ascending') return { current: 2.0 / 1.5, career: 0.75 }
  if (stage === 'declining') return { current: 2.0 / 1.5, career: 0.6 }
  return { current: 1, career: 1 }
}
