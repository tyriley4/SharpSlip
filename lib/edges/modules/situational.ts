import type { Edge, InjuryNote, ModuleOutput } from '../types'
import { outcomeNoun, subjectTeam, type ModuleInput } from './shared'

const W_INJURY = 0.15
const W_WEATHER = 0.12
const W_REST = 0.1

const OUT_NOW = new Set<InjuryNote['designation']>(['out', 'doubtful', 'ir'])

/** Opposing positions whose absence helps a given stat, by sport. Only stats with a direct physical link are listed. */
function affectingPositions(sport: string, category: string): string[] {
  if (sport === 'nfl' || sport === 'cfb') {
    if (category === 'Receiving Yards' || category === 'Receptions' || category === 'Pass Yards') return ['CB', 'S', 'FS', 'SS', 'DB']
    if (category === 'Rush Yards') return ['DT', 'DE', 'NT', 'DL', 'LB', 'ILB', 'OLB', 'MLB']
  }
  if ((sport === 'nba' || sport === 'cbb') && category === 'Rebounds') return ['C', 'PF', 'F-C', 'C-F']
  if (sport === 'nhl' && ['Shots on Goal', 'Points', 'Assists'].includes(category)) return ['G']
  return []
}

/**
 * MODULE 4: do specific circumstances tonight affect this outcome? Fires only when the circumstance directly bears
 * on the bet: an opposing CB out matters for a receiver prop, not for a quarterback completion rate.
 */
export function situationalModule({ outcome: o, game }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  const over = o.direction !== 'under'
  const noun = outcomeNoun(o)

  // ---- Injuries
  if (o.type === 'player_prop' && o.category) {
    const opp = o.opponent
    const positions = affectingPositions(game.sport, o.category)
    if (opp && positions.length && over) {
      const out = game.injuries.filter((i) => i.team === opp && OUT_NOW.has(i.designation) && positions.includes(i.position.toUpperCase()))
      if (out.length > 0) {
        edges.push({
          description: `${opp} ${out.length === 1 ? 'is' : 'are'} missing ${out.map((i) => `${i.player} (${i.position}, ${i.designation === 'doubtful' ? 'doubtful' : 'out'})`).join(', ')} - a position that bears directly on ${o.category}`,
          category: 'situational',
          relevanceScore: Math.min(1, 0.6 + 0.15 * out.length),
          supportingData: out.map((i) => i.injury).filter(Boolean).join(', ') || 'Injury report',
          weight: W_INJURY,
        })
      }
    }
    const self = o.player ? game.injuries.find((i) => i.team === o.player!.team && i.player.toLowerCase() === o.player!.name.toLowerCase()) : null
    if (self && ['questionable', 'doubtful', 'gtd', 'out', 'ir'].includes(self.designation)) {
      conflicts++
      edges.push({
        description: `${self.player} is listed ${self.designation === 'gtd' ? 'day-to-day' : self.designation}${self.injury ? ` (${self.injury})` : ''} - status worth checking before the game`,
        category: 'situational',
        relevanceScore: 0.6,
        supportingData: 'Injury report',
        weight: 0,
      })
    }
  }

  // ---- Weather (outdoor football only; other sports have no weather feed here)
  const w = game.weather
  if (w && !w.indoor) {
    const passing = o.type === 'player_prop' && (o.category === 'Pass Yards' || o.category === 'Receiving Yards')
    const isTotal = o.type === 'total'
    if (passing || isTotal) {
      const bits: string[] = []
      let severity = 0
      if (w.windMph !== null && w.windMph > 10) {
        bits.push(`${Math.round(w.windMph)} mph wind`)
        severity += Math.min(1, (w.windMph - 10) / 15)
      }
      if (w.tempF !== null && w.tempF < 40 && isTotal) {
        bits.push(`${Math.round(w.tempF)}F`)
        severity += 0.5
      }
      if (w.precipitation) {
        bits.push('precipitation expected')
        severity += 0.5
      }
      if (bits.length > 0) {
        if (!over) {
          edges.push({ description: `Forecast calls for ${bits.join(' and ')}, conditions that tend to suppress ${passing ? 'passing output' : 'scoring'} - supporting ${noun}`, category: 'situational', relevanceScore: Math.min(1, 0.5 + severity / 2), supportingData: 'Game-time forecast', weight: W_WEATHER })
        } else if (over) conflicts++
      }
    }
  }

  // ---- Rest
  if (o.type === 'moneyline' || o.type === 'spread') {
    const team = subjectTeam(o)
    const opp = o.team?.opponent
    if (team && opp) {
      const r1 = game.rest[team]
      const r2 = game.rest[opp]
      if (r1 !== null && r1 !== undefined && r2 !== null && r2 !== undefined) {
        const b2bSport = game.sport === 'nba' || game.sport === 'nhl' || game.sport === 'cbb'
        if (b2bSport) {
          if (r2 === 0 && r1 >= 1) edges.push({ description: `${opp} is playing on no rest while ${team} has had ${r1} day${r1 === 1 ? '' : 's'} off`, category: 'situational', relevanceScore: 0.7, supportingData: 'Back-to-back for the opponent', weight: W_REST })
          else if (r1 === 0 && r2 >= 1) conflicts++
        } else if (game.sport === 'nfl' || game.sport === 'cfb') {
          if (r1 - r2 >= 3) edges.push({ description: `${team} has ${r1} days of rest against ${r2} for ${opp}`, category: 'situational', relevanceScore: Math.min(1, 0.5 + (r1 - r2) / 10), supportingData: 'Rest advantage', weight: W_REST })
          else if (r2 - r1 >= 3) conflicts++
        }
      }
    }
  }
  return { edges, conflicts }
}
