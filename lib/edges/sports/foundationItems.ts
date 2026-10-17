import type { BettingOutcome, Edge, GameContext, ModuleOutput } from '../types'
import { ev, lineText } from './format'

/**
 * Turns the game foundation into evidence for team bets and totals: the style matchup, a record that has been read against
 * the quality of the opposition, the team's history at this venue and in this climate, the weather's effect on who wins
 * the game, and the roster changes that move the game itself. Player props read the foundation in their own modules, where
 * the position and the role are known.
 */
const OFFENSE_POS = new Set(['QB', 'WR1', 'WR2', 'WR', 'TE', 'RB', 'LT'])
const FAVORABLE = /the style matchup points at/
const DEFENSE_POS = new Set(['CB', 'S', 'DE', 'DT', 'LB'])

export function foundationEdges(o: BettingOutcome, game: GameContext): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  const f = game.foundation
  if (!f) return { edges, conflicts }
  const push = (e: Edge) => edges.push(e)

  // ------------------------------------------------------------------------------------------ moneyline and spread
  if ((o.type === 'moneyline' || o.type === 'spread') && o.team) {
    const T = o.team.abbr
    const O = o.team.opponent
    const bet = o.type === 'spread' && o.threshold !== undefined ? `${lineText(o.threshold)} spread` : 'moneyline'
    const mine = f.teams[T]
    const theirs = f.teams[O]
    if (f.styleMatchup[T] && FAVORABLE.test(f.styleMatchup[T])) push(ev({ tier: 2, text: `${f.styleMatchup[T]} — the structural edge ${T} brings into tonight's ${bet}`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: 0.65, support: 'Pass rate by team and yards allowed by position, this season', n: 5 }))
    else if (f.styleMatchup[T]) conflicts++
    if (f.styleMatchup[O] && FAVORABLE.test(f.styleMatchup[O])) conflicts++

    // Records read against who was actually on the other side.
    if (mine?.form?.adjusted) {
      const a = mine.form.adjusted
      if (a.w + a.l >= 2 && a.w / (a.w + a.l) >= 0.6) push(ev({ tier: 3, text: `${mine.form.text} — the quality-adjusted record is the one that applies against ${O} tonight`, category: 'recent_form', horizon: 'last7', relevance: 0.6, support: 'Opponent starting quarterbacks by week', n: a.w + a.l, ageDays: 6 }))
      else if (a.w + a.l >= 2 && a.w / (a.w + a.l) <= 0.4) conflicts++
    }
    if (theirs?.form?.adjusted) {
      const raw = theirs.form.raw
      const a = theirs.form.adjusted
      if (a.w + a.l >= 2 && a.w / (a.w + a.l) < raw.w / Math.max(1, raw.w + raw.l)) push(ev({ tier: 3, text: `${theirs.form.text} — tonight's opponent is less proven than its raw record suggests`, category: 'recent_form', horizon: 'last7', relevance: 0.55, support: 'Opponent starting quarterbacks by week', n: a.w + a.l, ageDays: 6 }))
    }

    // Venue and climate history.
    const where = T === game.home ? "tonight is another home game" : `tonight is a return to ${game.home}`
    if (mine?.venue.historyRec && mine.venue.history) {
      const r = mine.venue.historyRec
      if (r.w / (r.w + r.l) >= 0.6) push(ev({ tier: 4, text: `${mine.venue.history} — ${where}`, category: 'hit_rate', horizon: 'season', relevance: 0.5, support: 'Results at this venue over the last three seasons', n: r.w + r.l }))
      else if (r.w / (r.w + r.l) <= 0.34) conflicts++
    }
    if (mine?.venue.climateRec && mine.venue.climate) {
      const r = mine.venue.climateRec
      if (r.w / (r.w + r.l) >= 0.6) push(ev({ tier: 2, text: `${mine.venue.climate} — tonight's conditions are the ones that record describes`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.55, support: 'nflverse schedule: roof and temperature by game', n: r.w + r.l }))
      else if (r.w / (r.w + r.l) <= 0.34) conflicts++
    }
    if (theirs?.venue.climateRec && theirs.venue.climate) {
      const r = theirs.venue.climateRec
      if (r.w / (r.w + r.l) <= 0.34) push(ev({ tier: 2, text: `${theirs.venue.climate} — tonight's conditions are the ones that record describes, which works against ${O}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.55, support: 'nflverse schedule: roof and temperature by game', n: r.w + r.l }))
    }

    // Weather: whose style it favors.
    if (f.weather?.favors === T) push(ev({ tier: 1, text: `${f.weather.text} — conditions that favor ${T} over ${O} tonight`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.6, support: 'Game-time forecast and each team\'s pass rate', n: 5, ageDays: 0 }))
    else if (f.weather?.favors === O) conflicts++

    // Roster: a key player out on their side supports this team; out on this side runs against it.
    for (const n of f.roster) {
      if (n.kind !== 'out' || !n.affects.includes('team')) continue
      if (n.team === O) push(ev({ tier: 1, text: `${n.text} — a change that works in ${T}'s favor tonight`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: n.impact === 'high' ? 0.7 : 0.55, support: 'Depth chart, injury report and season usage', n: 5, ageDays: 0 }))
      else if (n.team === T && n.impact === 'high') conflicts++
    }
    return { edges, conflicts }
  }

  // ------------------------------------------------------------------------------------------------------- totals
  if (o.type === 'total' && o.threshold !== undefined) {
    const over = o.direction !== 'under'
    const total = o.threshold
    if (f.weather) {
      const w = f.weather
      if (game.sport === 'mlb') {
        if (over && w.carry === 'out') push(ev({ tier: 1, text: `${w.text} — supporting the over ${total}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.65, support: 'Game-time weather at an open-air park', n: 5, ageDays: 0 }))
        else if (!over && w.carry === 'in') push(ev({ tier: 1, text: `${w.text} — supporting the under ${total}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.65, support: 'Game-time weather at an open-air park', n: 5, ageDays: 0 }))
        else if ((over && w.carry === 'in') || (!over && w.carry === 'out')) conflicts++
      } else if (!over) push(ev({ tier: 1, text: `${w.text} — conditions that suppress scoring, supporting the under ${total}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.65, support: 'Game-time forecast at an open-air venue', n: 5, ageDays: 0 }))
      else conflicts++
    }
    if (!over) {
      const m = Object.values(f.styleMatchup).filter((x) => !FAVORABLE.test(x))
      if (m.length > 0) push(ev({ tier: 2, text: `${m.join('; ')} — an attack running into a strength trims the scoring ceiling against tonight's ${total}`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: 0.5, support: 'Pass rate by team and yards allowed by position, this season', n: 5 }))
    }
    if (over) {
      const m = Object.values(f.styleMatchup).filter((x) => FAVORABLE.test(x))
      if (m.length > 0) push(ev({ tier: 2, text: `${m.join('; ')} — an attack aimed at a soft spot lifts the scoring ceiling against tonight's ${total}`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: 0.55, support: 'Pass rate by team and yards allowed by position, this season', n: 5 }))
    }
    // Roster changes: offense missing lowers scoring, defense missing raises it.
    const out = f.roster.filter((n) => n.kind === 'out')
    const offOut = out.filter((n) => OFFENSE_POS.has(n.position) && n.impact === 'high')
    const defOut = out.filter((n) => DEFENSE_POS.has(n.position) && n.impact === 'high')
    const bats = out.filter((n) => game.sport === 'mlb' || game.sport === 'nba' || game.sport === 'nhl' || game.sport === 'cbb')
    if (!over && (offOut.length > 0 || bats.length > 0)) push(ev({ tier: 1, text: `${[...offOut, ...bats].slice(0, 2).map((n) => n.text).join('; ')} — a missing offensive piece lowers the scoring ceiling against the ${total}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.6, support: 'Depth chart, injury report and season usage', n: 5, ageDays: 0 }))
    else if (over && (offOut.length > 0 || bats.length > 0)) conflicts++
    if (over && defOut.length > 0) push(ev({ tier: 1, text: `${defOut.slice(0, 2).map((n) => n.text).join('; ')} — a missing defender raises expected scoring against the ${total}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.55, support: 'Depth chart and injury report', n: 5, ageDays: 0 }))
  }
  return { edges, conflicts }
}
