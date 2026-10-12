import type { Sport } from '@/lib/sport/SportContext'
import { atsOutcome, buildTrends, finals, lineOutcome, lineRecord, moneyline, overUnderRecords, pctOf, recordString, situation, tally, totalOutcome, withPrevious, type Outcome } from './analysis'
import type { BettingData, LineRecord, SituationRecord, TeamGame } from './types'

const PROXY_NOTE = 'Measured against the league-average total — a stand-in, since sportsbook totals aren’t connected.'

const compact = <T>(list: (T | null)[]): T[] => list.filter((x): x is T => x !== null)

function mlbLines(games: TeamGame[], f5Line: number | null): LineRecord[] {
  const [over, under] = overUnderRecords(games, PROXY_NOTE)
  const f5 = games.map((g) => ({ ...g, total: g.f5Total === null || f5Line === null ? null : f5Line }))
  const f5over = lineRecord('F5 Over', games, (g) => {
    if (g.f5Total === null || f5Line === null) return null
    return g.f5Total > f5Line ? 'W' : g.f5Total < f5Line ? 'L' : 'P'
  }, { winWord: 'F5 Over in', note: 'First-5 total vs the league-average F5 total (proxy).' })
  const f5under = lineRecord('F5 Under', games, (g) => {
    if (g.f5Total === null || f5Line === null) return null
    return g.f5Total < f5Line ? 'W' : g.f5Total > f5Line ? 'L' : 'P'
  }, { winWord: 'F5 Under in', note: 'First-5 total vs the league-average F5 total (proxy).' })
  void f5
  const nrfi = lineRecord('NRFI (no run in the 1st)', games, (g) => (g.firstInningTotal === null ? null : g.firstInningTotal === 0 ? 'W' : 'L'), { winWord: 'NRFI in' })
  return [
    lineRecord('Moneyline', games, moneyline, { winWord: 'Won' }),
    lineRecord('Run Line −1.5', games, (g) => lineOutcome(g, -1.5)),
    lineRecord('Run Line +1.5', games, (g) => lineOutcome(g, 1.5)),
    over,
    under,
    f5over,
    f5under,
    nrfi,
  ]
}

function nflLines(games: TeamGame[]): LineRecord[] {
  const fav = (g: TeamGame): Outcome => (g.spread !== null && g.spread < 0 ? atsOutcome(g) : null)
  const dog = (g: TeamGame): Outcome => (g.spread !== null && g.spread > 0 ? atsOutcome(g) : null)
  const [over, under] = overUnderRecords(games)
  return [lineRecord('Moneyline', games, moneyline, { winWord: 'Won' }), lineRecord('Spread — as favorite', games, fav), lineRecord('Spread — as underdog', games, dog), over, under]
}

function cfbLines(games: TeamGame[]): LineRecord[] {
  const fav = (g: TeamGame): Outcome => (g.spread !== null && g.spread < 0 ? atsOutcome(g) : null)
  const dog = (g: TeamGame): Outcome => (g.spread !== null && g.spread > 0 ? atsOutcome(g) : null)
  const [over, under] = overUnderRecords(games)
  return [lineRecord('Moneyline', games, moneyline, { winWord: 'Won' }), lineRecord('Spread — as favorite', games, fav), lineRecord('Spread — as underdog', games, dog), over, under]
}

function nbaLines(games: TeamGame[]): LineRecord[] {
  const [over, under] = overUnderRecords(games, PROXY_NOTE)
  return [lineRecord('Moneyline', games, moneyline, { winWord: 'Won' }), over, under]
}

function nhlLines(games: TeamGame[]): LineRecord[] {
  const [over, under] = overUnderRecords(games, PROXY_NOTE)
  return [
    lineRecord('Moneyline', games, moneyline, { winWord: 'Won' }),
    lineRecord('Puck Line −1.5', games, (g) => lineOutcome(g, -1.5)),
    lineRecord('Puck Line +1.5', games, (g) => lineOutcome(g, 1.5)),
    over,
    under,
  ]
}

function situations(sport: Sport, games: TeamGame[]): SituationRecord[] {
  const real = sport === 'nfl' || sport === 'cfb' || sport === 'cbb'
  const s = (label: string, pred: (g: TeamGame) => boolean) => situation(label, games, pred, real)
  const prev = withPrevious(games)
  const afterOf = (label: string, want: Outcome): SituationRecord | null => {
    const subset = prev.filter((g) => g.prev === want)
    if (subset.length === 0) return null
    const ml = tally(subset, moneyline)
    const ats = tally(subset, atsOutcome)
    return { label, record: recordString(ml), pct: pctOf(ml), ats: real && ats.wins + ats.losses > 0 ? recordString(ats) : null }
  }

  if (sport === 'mlb') {
    return compact([
      s('Vs left-handed starters', (g) => g.oppHand === 'L'),
      s('Vs right-handed starters', (g) => g.oppHand === 'R'),
      s('Day games', (g) => g.day === true),
      s('Night games', (g) => g.day === false),
      s('Divisional games', (g) => g.divisional === true),
      s('At home', (g) => g.home),
      s('On the road', (g) => !g.home),
      afterOf('After a win', 'W'),
      afterOf('After a loss', 'L'),
    ])
  }
  if (sport === 'nfl') {
    return compact([
      s('As home favorite', (g) => g.home && (g.spread ?? 0) < 0),
      s('As road underdog', (g) => !g.home && (g.spread ?? 0) > 0),
      s('Divisional games', (g) => g.divisional === true),
      s('Primetime games', (g) => g.primetime),
      afterOf('After a win', 'W'),
      afterOf('After a loss', 'L'),
      s('As double-digit favorite', (g) => (g.spread ?? 0) <= -10),
      s('As double-digit underdog', (g) => (g.spread ?? 0) >= 10),
    ])
  }
  if (sport === 'cbb') {
    return compact([
      s('As home favorite', (g) => g.home && (g.spread ?? 0) < 0),
      s('As road underdog', (g) => !g.home && (g.spread ?? 0) > 0),
      s('Conference games', (g) => g.divisional === true),
      s('Non-conference games', (g) => g.divisional === false),
      s('At home', (g) => g.home),
      s('On the road', (g) => !g.home),
      s('On short rest (0-1 days)', (g) => g.rest !== null && g.rest <= 1),
      afterOf('After a win', 'W'),
      afterOf('After a loss', 'L'),
      s('As double-digit favorite', (g) => (g.spread ?? 0) <= -10),
      s('As double-digit underdog', (g) => (g.spread ?? 0) >= 10),
    ])
  }
  if (sport === 'cfb') {
    return compact([
      s('As home favorite', (g) => g.home && (g.spread ?? 0) < 0),
      s('As road underdog', (g) => !g.home && (g.spread ?? 0) > 0),
      s('Conference games', (g) => g.divisional === true),
      s('Non-conference games', (g) => g.divisional === false),
      s('At home', (g) => g.home),
      s('On the road', (g) => !g.home),
      s('Primetime games', (g) => g.primetime),
      afterOf('After a win', 'W'),
      afterOf('After a loss', 'L'),
      s('As double-digit favorite', (g) => (g.spread ?? 0) <= -10),
      s('As double-digit underdog', (g) => (g.spread ?? 0) >= 10),
    ])
  }
  return compact([
    s('At home', (g) => g.home),
    s('On the road', (g) => !g.home),
    s('Divisional games', (g) => g.divisional === true),
    s('On a back-to-back', (g) => g.rest === 0),
    s('With 2+ days rest', (g) => (g.rest ?? 0) >= 2),
    afterOf('After a win', 'W'),
    afterOf('After a loss', 'L'),
  ])
}

const TREND_OPTS: Record<Sport, Parameters<typeof buildTrends>[1]> = {
  mlb: { scoreAt: 5, scoreWord: 'Scored', allowAt: 3, allowWord: 'Strong pitching', hasSpread: false, hasTotal: true, totalProxy: true },
  nfl: { scoreAt: 24, scoreWord: 'Scored', allowAt: 17, allowWord: 'Strong defense', hasSpread: true, hasTotal: true, totalProxy: false },
  cfb: { scoreAt: 35, scoreWord: 'Scored', allowAt: 20, allowWord: 'Strong defense', hasSpread: true, hasTotal: true, totalProxy: false },
  nba: { scoreAt: 115, scoreWord: 'Scored', allowAt: 105, allowWord: 'Strong defense', hasSpread: false, hasTotal: true, totalProxy: true },
  cbb: { scoreAt: 80, scoreWord: 'Scored', allowAt: 65, allowWord: 'Strong defense', hasSpread: true, hasTotal: true, totalProxy: false },
  nhl: { scoreAt: 4, scoreWord: 'Scored', allowAt: 2, allowWord: 'Strong goaltending', hasSpread: false, hasTotal: true, totalProxy: true },
}

/** All the Betting-tab data for a team from its schedule results. */
export function assembleBetting(sport: Sport, games: TeamGame[], opts: { f5Line?: number | null } = {}): BettingData {
  const notes: string[] = []
  let lines: LineRecord[]
  if (sport === 'mlb') {
    lines = mlbLines(games, opts.f5Line ?? null)
    notes.push('Run lines are the standard ±1.5. Over/Under and F5 use the league-average total as the line because a sportsbook totals feed isn’t connected. Favorite/underdog splits need real odds and are left out rather than guessed.')
  } else if (sport === 'nfl') {
    lines = nflLines(games)
    notes.push('Spreads and totals are the real closing lines in the nflverse schedule. First-half lines aren’t in that feed, so they’re left out.')
  } else if (sport === 'cbb') {
    lines = cfbLines(games)
    notes.push('Spreads and totals are DraftKings closing lines recorded by ESPN (only games where ESPN kept a line count). First-half lines aren’t available, so they’re left out.')
  } else if (sport === 'cfb') {
    lines = cfbLines(games)
    notes.push('Spreads and totals are DraftKings closing lines from ESPN game data (only games where ESPN kept a line count). First-half lines aren’t available, so they’re left out.')
  } else if (sport === 'nba') {
    lines = nbaLines(games)
    notes.push('Against-the-spread and first-half records need a sportsbook feed that isn’t connected, so they’re left out. Over/Under uses the league-average total as the line.')
  } else {
    lines = nhlLines(games)
    notes.push('Puck lines are the standard ±1.5. Over/Under uses the league-average total as the line, and first-period lines aren’t available, so they’re left out. Favorite/underdog splits need real odds.')
  }

  const hasSpread = sport === 'nfl' || sport === 'cfb' || sport === 'cbb'
  const trends = buildTrends(games, { ...TREND_OPTS[sport], hasSpread })
  return { lines, situational: situations(sport, games), trends, notes }
}

export { finals, totalOutcome }
