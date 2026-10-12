import { propLabel, type PropRole } from './props'
import type { BetLeg, BetSport } from './types'

/** The game a leg is on — picked from the schedule, or typed in by hand for games that aren't listed. */
export interface GameSel {
  id?: string
  away: string
  home: string
  /** YYYY-MM-DD */
  date: string
  /** "NYY @ BOS — 7:05 PM" */
  label: string
  manual?: boolean
}

export type LegMarket = BetLeg['market']

/** Raw form state for one leg — strings, as typed. */
export interface LegDraft {
  team: 'away' | 'home' | ''
  spreadLine: string
  side: 'over' | 'under'
  totalLine: string
  player: string
  role: PropRole
  category: string
  propLine: string
  odds: string
}

export const EMPTY_DRAFT: LegDraft = {
  team: '',
  spreadLine: '',
  side: 'over',
  totalLine: '',
  player: '',
  role: 'player',
  category: '',
  propLine: '',
  odds: '',
}

export const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`)

export function parseAmericanOdds(raw: string): number | null {
  const n = parseInt(raw.trim().replace(/^\+/, ''), 10)
  if (Number.isNaN(n) || n === 0 || (n > -100 && n < 100)) return null
  return n
}

/** Validates a draft and turns it into a leg, or explains what's missing. */
export function buildLeg(sport: BetSport, game: GameSel | null, market: LegMarket, d: LegDraft): { leg: BetLeg } | { error: string } {
  const odds = parseAmericanOdds(d.odds)
  if (market !== 'Player Prop' && !game) return { error: 'Pick a game first.' }
  if (odds === null) return { error: 'Enter valid American odds, e.g. -110 or +145.' }

  const base = {
    sport,
    market,
    away: game?.away ?? '',
    home: game?.home ?? '',
    gameDate: game?.date ?? null,
    gameId: game?.id,
    odds,
    result: 'pending' as const,
  }

  if (market === 'Moneyline') {
    if (!d.team || !game) return { error: 'Choose which team you are backing.' }
    const team = d.team === 'away' ? game.away : game.home
    return { leg: { ...base, pick: `${team} ML`, team } }
  }

  if (market === 'Spread') {
    if (!d.team || !game) return { error: 'Choose which team you are backing.' }
    const line = parseFloat(d.spreadLine)
    if (Number.isNaN(line)) return { error: 'Enter the spread, e.g. -1.5 or +3.' }
    const team = d.team === 'away' ? game.away : game.home
    return { leg: { ...base, pick: `${team} ${signed(line)}`, team, line } }
  }

  if (market === 'Total') {
    const line = parseFloat(d.totalLine)
    if (Number.isNaN(line) || line <= 0) return { error: 'Enter the total line, e.g. 8.5.' }
    const word = d.side === 'over' ? 'Over' : 'Under'
    return { leg: { ...base, pick: `${word} ${line}${game ? ` (${game.away} @ ${game.home})` : ''}`, side: d.side, line } }
  }

  if (!d.player.trim()) return { error: 'Enter the player.' }
  if (!d.category) return { error: 'Choose a prop category.' }
  const line = parseFloat(d.propLine)
  if (Number.isNaN(line)) return { error: 'Choose or enter the line.' }
  const word = d.side === 'over' ? 'Over' : 'Under'
  const label = propLabel(sport, d.role, d.category)
  return {
    leg: { ...base, pick: `${d.player.trim()} ${word} ${line} ${label}`, player: d.player.trim(), category: d.category, role: d.role, side: d.side, line },
  }
}

/** Rebuilds the form state from a saved leg so a bet can be edited. */
export function draftFromLeg(leg: BetLeg): LegDraft {
  return {
    ...EMPTY_DRAFT,
    team: leg.team ? (leg.team === leg.away ? 'away' : 'home') : '',
    spreadLine: leg.market === 'Spread' && leg.line !== undefined ? String(leg.line) : '',
    side: leg.side ?? 'over',
    totalLine: leg.market === 'Total' && leg.line !== undefined ? String(leg.line) : '',
    player: leg.player ?? '',
    role: (leg.role as PropRole) ?? 'player',
    category: leg.category ?? '',
    propLine: leg.market === 'Player Prop' && leg.line !== undefined ? String(leg.line) : '',
    odds: String(leg.odds),
  }
}

export function gameFromLeg(leg: BetLeg): GameSel {
  return { id: leg.gameId, away: leg.away, home: leg.home, date: leg.gameDate ?? '', label: `${leg.away} @ ${leg.home}`, manual: !leg.gameId }
}
