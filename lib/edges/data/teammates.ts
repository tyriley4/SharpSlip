import { mapWithConcurrency } from '@/lib/utils/concurrency'
import type { Sport } from '@/lib/sport/SportContext'
import { daysSince } from '../historicalRates'
import type { InjuryNote, TeammateOut } from '../types'
import { getPlayerHistory } from './playerHistory'

const OUT = new Set<InjuryNote['designation']>(['out', 'doubtful', 'ir'])
const MAX_LOOKUPS = 8

/** Which stat measures a player's role for the injured teammate, and what counts as a real contributor. */
function usageSpec(sport: Sport, position: string): { key: string; label: string; min: number } | null {
  const p = position.toUpperCase()
  if (sport === 'nfl') {
    if (p === 'RB' || p === 'HB' || p === 'FB') return { key: 'Rush Attempts', label: 'carries', min: 8 }
    if (p === 'WR' || p === 'TE') return { key: 'Targets', label: 'targets', min: 4 }
    return null
  }
  if (sport === 'cfb') {
    if (p === 'RB' || p === 'HB') return { key: 'Rush Yards', label: 'rushing yards', min: 35 }
    if (p === 'WR' || p === 'TE') return { key: 'Receiving Yards', label: 'receiving yards', min: 30 }
    return null
  }
  if (sport === 'nba') return { key: 'Minutes', label: 'minutes', min: 22 }
  if (sport === 'cbb') return { key: 'Points', label: 'points', min: 10 }
  if (sport === 'nhl') return p === 'G' ? null : { key: 'TOI', label: 'minutes of ice time', min: 16 }
  return null
}

/**
 * Injured teammates who actually matter: for each player ruled out or doubtful, how much he normally plays or touches
 * the ball (current-season average), so a role-change item only fires when the absence is material.
 */
export async function loadTeammatesOut(sport: Sport, injuries: InjuryNote[]): Promise<TeammateOut[]> {
  if (sport === 'mlb') return []
  const candidates = injuries.filter((i) => OUT.has(i.designation) && (sport !== 'nfl' || ['RB', 'HB', 'FB', 'WR', 'TE', 'QB'].includes(i.position.toUpperCase()))).slice(0, MAX_LOOKUPS * 2)
  const rows = await mapWithConcurrency(candidates, 4, async (i): Promise<TeammateOut | null> => {
    const spec = usageSpec(sport, i.position)
    const isQb = sport === 'nfl' && i.position.toUpperCase() === 'QB'
    if (!spec && !isQb) return null
    if (!spec) return { team: i.team, player: i.player, position: i.position, designation: i.designation, usage: null }
    try {
      const hist = await getPlayerHistory(sport, i.player, i.team, 'x')
      const games = hist?.games ?? []
      if (games.length === 0 || daysSince(games[0].date) > 120) return null
      const cur = games.filter((g) => g.season === games[0].season && typeof g.values[spec.key] === 'number')
      if (cur.length < 3) return null
      const avg = cur.reduce((s, g) => s + g.values[spec.key], 0) / cur.length
      if (avg < spec.min) return null
      return { team: i.team, player: i.player, position: i.position, designation: i.designation, usage: { label: spec.label, value: Math.round(avg * 10) / 10 } }
    } catch {
      return null
    }
  })
  return rows.filter((r): r is TeammateOut => r !== null).slice(0, MAX_LOOKUPS)
}
