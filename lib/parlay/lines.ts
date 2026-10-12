import { impliedProb, noVigProb } from './math'
import type { Edge } from '@/data/breakdown/types'
import type { GameOdds, PropOffer, Side } from '@/lib/odds/types'
import type { Sport } from '@/lib/sport/SportContext'

/**
 * Bet lines shown on the Lines tab and the Parlay page. Every price here is a real posted price from
 * a sportsbook (see lib/odds); probabilities are the market's own no-vig implied probabilities.
 */

export interface BetLine {
  id: string
  sport: Sport
  gameId: string
  matchup: string
  market: string
  /** Short leg description, e.g. "VGK ML" or "Aaron Judge O0.5 Hits". */
  label: string
  /** Text shown on the button, e.g. "VGK -1.5". */
  display: string
  odds: number
  /** No-vig implied probability, 0-100 (or the model's estimate when one is passed). */
  prob: number
  /** Sportsbook this price is from. */
  book: string
}

export interface LineRow {
  title: string
  /** Both sides when the book prices them; a single side for one-way markets such as most NHL props. */
  options: BetLine[]
}

export interface PlayerPropGroup {
  player: string
  team: string
  position?: string
  rows: LineRow[]
}

export interface GameLines {
  gameLines: LineRow[]
  props: PlayerPropGroup[]
}

const GRADE_POINTS: Record<string, number> = { 'A+': 3, A: 3, 'A-': 3, 'B+': 2, B: 2, 'B-': 1, C: 1 }

/** The team with the higher graded-insight total, or null when it's even / unavailable. */
export function favoriteFromEdges(edges: Edge[], awayAbbr: string, homeAbbr: string): string | null {
  let away = 0
  let home = 0
  for (const e of edges) {
    const pts = GRADE_POINTS[e.grade] ?? 0
    if (e.team === awayAbbr) away += pts
    else if (e.team === homeAbbr) home += pts
  }
  if (away === home) return null
  return away > home ? awayAbbr : homeAbbr
}

export function fmtLine(n: number): string {
  return n > 0 ? `+${n}` : `${n}`
}

const SPREAD_TITLE: Record<Sport, string> = { mlb: 'Run Line', nhl: 'Puck Line', nba: 'Spread', nfl: 'Spread', cfb: 'Spread', cbb: 'Spread' }

function mk(sport: Sport, gameId: string, matchup: string, market: string, key: string, label: string, display: string, odds: number, prob: number, book: string): BetLine {
  return {
    id: `${sport}:${gameId}:${market}:${key}`,
    sport,
    gameId,
    matchup,
    market,
    label,
    display,
    odds,
    prob: Math.round(prob * 10) / 10,
    book,
  }
}

function pair(a: Side, b: Side): [number, number] {
  const pa = noVigProb(a.price, b.price)
  return [pa, 100 - pa]
}

/** Moneyline, spread and total rows built from one real posted line. Missing markets are simply omitted. */
export function gameLineRows(odds: GameOdds): LineRow[] {
  const { sport, gameId, away, home } = odds
  const matchup = `${away} @ ${home}`
  const rows: LineRow[] = []

  const { away: aMl, home: hMl } = odds.moneyline
  if (aMl && hMl) {
    const [pa, ph] = pair(aMl, hMl)
    rows.push({
      title: 'Moneyline',
      options: [
        mk(sport, gameId, matchup, 'Moneyline', away, `${away} ML`, away, aMl.price, pa, aMl.book),
        mk(sport, gameId, matchup, 'Moneyline', home, `${home} ML`, home, hMl.price, ph, hMl.book),
      ],
    })
  }

  const { away: aSp, home: hSp } = odds.spread
  if (aSp && hSp && aSp.point !== null && hSp.point !== null) {
    const [pa, ph] = pair(aSp, hSp)
    rows.push({
      title: SPREAD_TITLE[sport],
      options: [
        mk(sport, gameId, matchup, 'Spread', `${away}${aSp.point}`, `${away} ${fmtLine(aSp.point)}`, `${away} ${fmtLine(aSp.point)}`, aSp.price, pa, aSp.book),
        mk(sport, gameId, matchup, 'Spread', `${home}${hSp.point}`, `${home} ${fmtLine(hSp.point)}`, `${home} ${fmtLine(hSp.point)}`, hSp.price, ph, hSp.book),
      ],
    })
  }

  const { over, under, line } = odds.total
  if (over && under && line !== null) {
    const [po, pu] = pair(over, under)
    rows.push({
      title: 'Total',
      options: [
        mk(sport, gameId, matchup, 'Total', `O${line}`, `Over ${line}`, `Over ${line}`, over.price, po, over.book),
        mk(sport, gameId, matchup, 'Total', `U${line}`, `Under ${line}`, `Under ${line}`, under.price, pu, under.book),
      ],
    })
  }
  return rows
}

/** Groups real prop offers by player. One-way offers keep their single side, with the price's own (vig-included) implied probability. */
export function propGroups(sport: Sport, gameId: string, matchup: string, offers: PropOffer[], teamOf: (player: string) => string | null): PlayerPropGroup[] {
  const groups = new Map<string, PlayerPropGroup>()
  for (const o of offers) {
    if (!o.over && !o.under) continue
    const [po, pu] = o.over && o.under ? pair(o.over, o.under) : [o.over ? impliedProb(o.over.price) : 0, o.under ? impliedProb(o.under.price) : 0]
    const key = `${o.market}:${o.player}:${o.line}`
    const options: BetLine[] = []
    if (o.over) options.push(mk(sport, gameId, matchup, 'Player Prop', `${key}:O`, `${o.player} O${o.line} ${o.marketLabel}`, `Over ${o.line}`, o.over.price, po, o.over.book))
    if (o.under) options.push(mk(sport, gameId, matchup, 'Player Prop', `${key}:U`, `${o.player} U${o.line} ${o.marketLabel}`, `Under ${o.line}`, o.under.price, pu, o.under.book))
    const row: LineRow = { title: `${o.marketLabel} ${o.line}`, options }
    let g = groups.get(o.player)
    if (!g) {
      g = { player: o.player, team: teamOf(o.player) ?? '', rows: [] }
      groups.set(o.player, g)
    }
    g.rows.push(row)
  }
  return Array.from(groups.values())
}

export function flattenLines(lines: GameLines): BetLine[] {
  return [...lines.gameLines, ...lines.props.flatMap((p) => p.rows)].flatMap((r) => r.options)
}

