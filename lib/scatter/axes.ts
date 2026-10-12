import type { ProSport, Sport } from '@/lib/sport/SportContext'

export interface ScatterFilters {
  /** Opponent abbreviation, or 'All Teams'. */
  vsTeam: string
  /** MLB only: opposing pitcher handedness. */
  hand: 'All' | 'vs RHP' | 'vs LHP'
  homeAway: 'All' | 'Home' | 'Away'
  /** NFL only: opponent conference. */
  conference: 'All' | 'AFC' | 'NFC'
}

export const DEFAULT_SCATTER_FILTERS: ScatterFilters = { vsTeam: 'All Teams', hand: 'All', homeAway: 'All', conference: 'All' }

export function scatterFiltersActive(f: ScatterFilters): boolean {
  return f.vsTeam !== 'All Teams' || f.hand !== 'All' || f.homeAway !== 'All' || f.conference !== 'All'
}

/** Which filter controls each sport offers in the scatter builder. */
export const SCATTER_FILTER_SUPPORT: Record<ProSport, { hand: boolean; conference: boolean }> = {
  mlb: { hand: true, conference: false },
  nfl: { hand: false, conference: true },
  nba: { hand: false, conference: false },
  nhl: { hand: false, conference: false },
}

/**
 * A betting-stat hit rate (% of games clearing a threshold) offered as a scatter axis, so game stats can be
 * correlated with betting performance. `nrfi` is the pitcher's no-run-first-inning rate over his last 10 starts.
 */
export interface RateAxisDef {
  label: string
  category: string
  threshold: number
  kind?: 'nrfi'
}

export const RATE_AXES: Record<ProSport, Record<string, RateAxisDef[]>> = {
  mlb: {
    Hitters: [
      { label: '1+ Hits hit rate %', category: 'Hits', threshold: 1 },
      { label: '2+ Hits hit rate %', category: 'Hits', threshold: 2 },
      { label: 'HR hit rate %', category: 'Home Runs', threshold: 1 },
      { label: '1+ RBI hit rate %', category: 'RBIs', threshold: 1 },
    ],
    Pitchers: [
      { label: 'K prop (5.5+) hit rate %', category: 'Strikeouts', threshold: 5.5 },
      { label: 'NRFI hit rate % (last 10 starts)', category: 'NRFI', threshold: 0, kind: 'nrfi' },
    ],
  },
  nfl: {
    QB: [
      { label: 'Pass Yds 249.5+ hit rate %', category: 'Pass Yards', threshold: 249.5 },
      { label: 'Anytime TD hit rate %', category: 'Anytime TD', threshold: 1 },
    ],
    RB: [
      { label: 'Rush Yds 49.5+ hit rate %', category: 'Rush Yards', threshold: 49.5 },
      { label: 'Rec Yds 29.5+ hit rate %', category: 'Receiving Yards', threshold: 29.5 },
      { label: 'Anytime TD hit rate %', category: 'Anytime TD', threshold: 1 },
    ],
    WR: [
      { label: 'Rec Yds 39.5+ hit rate %', category: 'Receiving Yards', threshold: 39.5 },
      { label: 'Anytime TD hit rate %', category: 'Anytime TD', threshold: 1 },
    ],
    TE: [
      { label: 'Rec Yds 29.5+ hit rate %', category: 'Receiving Yards', threshold: 29.5 },
      { label: 'Anytime TD hit rate %', category: 'Anytime TD', threshold: 1 },
    ],
  },
  nba: {
    Players: [
      { label: 'Points 24.5+ hit rate %', category: 'Points', threshold: 24.5 },
      { label: 'Rebounds 7.5+ hit rate %', category: 'Rebounds', threshold: 7.5 },
      { label: 'Assists 5.5+ hit rate %', category: 'Assists', threshold: 5.5 },
      { label: '3PM 2.5+ hit rate %', category: '3-Pointers Made', threshold: 2.5 },
    ],
  },
  nhl: {
    Skaters: [
      { label: 'Points 0.5+ hit rate %', category: 'Points', threshold: 0.5 },
      { label: 'Goals 0.5+ hit rate %', category: 'Goals', threshold: 0.5 },
      { label: 'SOG 2.5+ hit rate %', category: 'Shots on Goal', threshold: 2.5 },
    ],
    Goalies: [{ label: 'Saves 24.5+ hit rate %', category: 'Saves', threshold: 24.5 }],
  },
}

export function rateAxesFor(sport: Sport, sub: string): RateAxisDef[] {
  return RATE_AXES[sport as ProSport]?.[sub] ?? []
}

export function findRateAxis(sport: Sport, sub: string, label: string): RateAxisDef | undefined {
  return rateAxesFor(sport, sub).find((a) => a.label === label)
}

/** Subs whose game-stat axes can be recomputed from per-game logs (so filters apply). */
export const FILTERABLE_SUBS: Record<ProSport, string[]> = {
  mlb: ['Hitters', 'Pitchers'],
  nfl: ['QB', 'RB', 'WR', 'TE'],
  nba: ['Players'],
  nhl: ['Skaters', 'Goalies'],
}
