import type { GameContext, TeamGameRecord } from '../types'

/**
 * Team records computed straight from the game results (newest first), the way a bettor counts them: "5-1 covering +1.5",
 * "Over 6.5 in 94 of 165". Nothing here is a rate; every figure is a count of real games.
 */
export interface Rec {
  w: number
  l: number
  p: number
}

export const blank = (): Rec => ({ w: 0, l: 0, p: 0 })
export const games = (r: Rec) => r.w + r.l

/** The current season's games for a team, postseason included. */
export function currentSeason(game: GameContext, team: string): TeamGameRecord[] {
  const all = game.results[team] ?? []
  if (all.length === 0) return []
  const season = Math.max(...all.map((g) => g.season))
  return all.filter((g) => g.season === season)
}

/** Games from the last N completed seasons, current season included. */
export function recentSeasons(game: GameContext, team: string, n: number): TeamGameRecord[] {
  const all = game.results[team] ?? []
  if (all.length === 0) return []
  const top = Math.max(...all.map((g) => g.season))
  return all.filter((g) => g.season > top - n)
}

export const regular = (gs: TeamGameRecord[]) => gs.filter((g) => !g.playoff)
export const postseason = (gs: TeamGameRecord[]) => gs.filter((g) => g.playoff)
export const vsOpp = (gs: TeamGameRecord[], opp: string) => gs.filter((g) => g.opp === opp)
export const atVenue = (gs: TeamGameRecord[], home: boolean) => gs.filter((g) => g.home === home)

/** Opponents at or above .500 (strong) or under it, from the league standings. Games against unranked teams are left out. */
export function vsTier(gs: TeamGameRecord[], game: GameContext, strong: boolean): TeamGameRecord[] {
  return gs.filter((g) => {
    const pct = game.leagueWinPct[g.opp]
    return pct !== undefined && (strong ? pct >= 0.5 : pct < 0.5)
  })
}

/** Record covering a number: the team's margin plus the line, e.g. +1.5 covers when the team loses by one or wins. */
export function covers(gs: TeamGameRecord[], line: number): Rec {
  const r = blank()
  for (const g of gs) {
    const m = g.us - g.them + line
    if (m > 0) r.w++
    else if (m < 0) r.l++
    else r.p++
  }
  return r
}

/** Straight-up record. */
export function wins(gs: TeamGameRecord[]): Rec {
  const r = blank()
  for (const g of gs) {
    if (g.us > g.them) r.w++
    else if (g.us < g.them) r.l++
    else r.p++
  }
  return r
}

/** Games that finished over (w) or under (l) a total. */
export function overUnder(gs: TeamGameRecord[], total: number): Rec {
  const r = blank()
  for (const g of gs) {
    const t = g.us + g.them
    if (t > total) r.w++
    else if (t < total) r.l++
    else r.p++
  }
  return r
}

/** Record for the side the bet is on: over means "over" games count as wins, under means "under" games do. */
export function totalSide(gs: TeamGameRecord[], total: number, over: boolean): Rec {
  const r = overUnder(gs, total)
  return over ? r : { w: r.l, l: r.w, p: r.p }
}

export const avgFor = (gs: TeamGameRecord[]) => (gs.length ? gs.reduce((n, g) => n + g.us, 0) / gs.length : 0)
export const avgAgainst = (gs: TeamGameRecord[]) => (gs.length ? gs.reduce((n, g) => n + g.them, 0) / gs.length : 0)
export const avgMargin = (gs: TeamGameRecord[]) => (gs.length ? gs.reduce((n, g) => n + (g.us - g.them), 0) / gs.length : 0)
export const avgTotal = (gs: TeamGameRecord[]) => (gs.length ? gs.reduce((n, g) => n + g.us + g.them, 0) / gs.length : 0)

/** True when the record is in the bet's favour: a clear majority of decided games. */
export const favors = (r: Rec, min = 0.6) => games(r) > 0 && r.w / games(r) >= min
/** True when the record runs against the bet. */
export const against = (r: Rec, max = 0.4) => games(r) > 0 && r.w / games(r) <= max
