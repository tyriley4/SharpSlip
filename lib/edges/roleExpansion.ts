import { slugify } from '@/lib/players/slug'
import { q } from './evidenceFramework'
import { daysSince } from './historicalRates'
import { avg, playerHit, type ModuleInput } from './modules/shared'
import type { Edge, ModuleOutput, PlayerGameRecord } from './types'

/**
 * Role expansion, career stage and trajectory. The market anchors to a player's old usage, so a role that has grown (or
 * shrunk) is where a line and the true price come apart. These are forward-looking signals; they are raised only when the
 * change is real: sustained over several games, not one or two outliers.
 */

export type ExpansionType = 'organic' | 'opportunity' | 'noise'

interface Usage {
  key: string
  label: string
  /** Relative jump over the season average that counts as an expansion. */
  jump: number
  /** Games in the recent window. */
  window: number
  floor: number
}

/** The usage stat that describes a role for each sport and prop, with the jump that makes it an expansion. */
export function usageSpec(sport: string, position: string, category: string): Usage | null {
  const p = position.toUpperCase()
  if (sport === 'nfl') {
    if (category === 'Rush Yards') return { key: 'Rush Attempts', label: 'carries', jump: 1.25, window: 4, floor: 10 }
    if (category === 'Receiving Yards' || category === 'Receptions') return { key: 'Targets', label: 'targets', jump: 1.3, window: 4, floor: 4.5 }
    return null
  }
  if (sport === 'nba' && ['Points', 'Rebounds', 'Assists'].includes(category)) return { key: 'Minutes', label: 'minutes', jump: 1.15, window: 5, floor: 24 }
  if (sport === 'nhl' && p !== 'G' && ['Points', 'Shots on Goal', 'Assists'].includes(category)) return { key: 'TOI', label: 'minutes of ice time', jump: 1.15, window: 5, floor: 15 }
  return null
}

const vals = (games: PlayerGameRecord[], key: string) => games.map((g) => g.values[key]).filter((v): v is number => typeof v === 'number')

/**
 * Is this a real expansion? It needs most of the recent games above the season average (otherwise it is one or two
 * outliers: noise), and it is classed as opportunity-driven when a material teammate is out, organic otherwise.
 */
function classify(recent: number[], season: number, teammateOut: boolean): ExpansionType {
  const above = recent.filter((v) => v > season).length
  if (above < Math.ceil(recent.length * 0.75)) return 'noise'
  return teammateOut ? 'opportunity' : 'organic'
}

const TYPE_TEXT: Record<Exclude<ExpansionType, 'noise'>, string> = {
  organic: 'earned through performance',
  opportunity: 'driven by a teammate\'s absence, so it may be temporary',
}

export function expansionEvidence({ outcome: o, game, history }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  if (o.type !== 'player_prop' || !o.player || !o.category) return { edges, conflicts }
  const over = o.direction !== 'under'
  const position = (o.player.position ?? '').toUpperCase()
  const games = history?.games ?? []
  const spec = usageSpec(game.sport, position, o.category)
  const mates = (game.teammatesOut ?? []).some((t) => t.team === o.player!.team && t.usage)
  const name = o.player.name
  const lineText = `${over ? 'Over' : 'Under'} ${o.threshold} ${o.category}`

  if (spec && games.length >= 8) {
    const recentGames = games.slice(0, spec.window)
    const recent = vals(recentGames, spec.key)
    const season = vals(
      games.filter((g) => g.season === games[0].season),
      spec.key
    )
    const age = daysSince(games[0].date)
    if (recent.length >= Math.min(spec.window, 3) && season.length >= 4 && age <= 21) {
      const r = avg(recent)
      const s = avg(season)
      const ratio = s > 0 ? r / s : 1
      const kind = classify(recent, s, mates)
      if (over && ratio >= spec.jump && r >= spec.floor * 0.8 && kind !== 'noise') {
        const k = kind as Exclude<ExpansionType, 'noise'>
        edges.push({
          description: `${name} is averaging ${r.toFixed(1)} ${spec.label} per game over the last ${recent.length} games vs a ${s.toFixed(1)} season average — a role expansion (${TYPE_TEXT[k]}) that carries into tonight's ${lineText}`,
          category: 'role',
          horizon: 'last7',
          layer: 'opportunity',
          relevanceScore: Math.min(1, 0.55 + (ratio - spec.jump) * 0.8 + (k === 'organic' ? 0.1 : 0)),
          supportingData: `${spec.label} by game: ${recent.join(', ')} (most recent first)`,
          weight: k === 'organic' ? 0.2 : 0.15,
          ageDays: age,
          quality: q(3, 3, 3, recent.length >= 4 ? 1 : 0),
          sample: recent.length,
          metrics: { avg: r, n: recent.length },
        })
      } else if (over && ratio <= 0.85) conflicts++
      else if (!over && ratio <= 0.85) {
        edges.push({ description: `${name}'s usage is down: ${r.toFixed(1)} ${spec.label} per game over the last ${recent.length} games against ${s.toFixed(1)} for the season — fewer opportunities tonight lower the ceiling`, category: 'role', horizon: 'last7', layer: 'opportunity', relevanceScore: 0.6, supportingData: 'Fewer opportunities lowers the ceiling', weight: 0.12, ageDays: age, quality: q(3, 3, 3, 1), sample: recent.length })
      }
      // Sustained usage: five-plus targets in three or more straight games.
      if (over && game.sport === 'nfl' && spec.key === 'Targets') {
        let streak = 0
        for (const g of games) {
          if ((g.values.Targets ?? 0) >= 5) streak++
          else break
        }
        if (streak >= 3) edges.push({ description: `${name} has had 5+ targets in ${streak} straight games — that volume carries into tonight`, category: 'role', horizon: 'last7', layer: 'opportunity', relevanceScore: Math.min(1, 0.5 + (streak - 3) * 0.1), supportingData: games.slice(0, streak).map((g) => g.values.Targets).join(', ') + ' targets (most recent first)', weight: 0.1, ageDays: age, quality: q(3, 3, 3, 0), sample: streak })
      }
    }
  }

  // NFL backs: snap-share expansion and lead-back emergence, from nflverse snap counts.
  const nfl = game.facts.nfl
  if (over && nfl && o.category === 'Rush Yards') {
    const p = nfl.players[`${slugify(o.player.name)}|${o.player.team}`]
    const snaps = (p?.games ?? []).map((g) => g.snapPct).filter((v): v is number => v !== null)
    if (snaps.length >= 4) {
      const last3 = snaps.slice(0, 3)
      const rec = avg(last3)
      const seasonAvg = avg(snaps)
      if (seasonAvg > 0 && rec >= seasonAvg * 1.25 && rec >= 0.45) {
        const kind = classify(last3, seasonAvg, mates)
        if (kind !== 'noise') edges.push({ description: `${name}'s snap share has expanded to ${Math.round(rec * 100)}% over the last 3 games from ${Math.round(seasonAvg * 100)}% for the season (${TYPE_TEXT[kind]}) — the workload behind tonight's ${lineText}`, category: 'role', horizon: 'last7', layer: 'opportunity', relevanceScore: 0.7, supportingData: `Snap share by game: ${(p?.games ?? []).slice(0, 3).map((g) => (g.snapPct === null ? '—' : `${Math.round(g.snapPct * 100)}%`)).join(', ')}`, weight: kind === 'organic' ? 0.18 : 0.14, ageDays: 7, quality: q(3, 3, 3, 1), sample: 3 })
      }
      if (last3.length === 3 && last3.every((v) => v > 0.65)) edges.push({ description: `${name} has played above 65% of offensive snaps in each of the last 3 games — a lead-back workload going into tonight`, category: 'role', horizon: 'last7', layer: 'opportunity', relevanceScore: 0.7, supportingData: 'Snap counts, nflverse', weight: 0.12, ageDays: 7, quality: q(3, 3, 3, 1), sample: 3 })
    }
  }
  return { edges, conflicts }
}

/**
 * Career stage and trajectory. The stage note says how the player's history is being read; the trajectory item compares
 * the last 15 games with the season (15% either way is a real move, anything inside that is normal variation).
 */
export function stageAndTrajectory({ outcome: o, history }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  if (o.type !== 'player_prop' || !o.category || o.threshold === undefined || !history) return { edges, conflicts }
  const over = o.direction !== 'under'
  const games = history.games
  const cat = o.category
  // A last-15 trajectory that runs against the bet, or a declining veteran whose career rate flatters him, lowers the grade;
  // neither is shown as evidence (the recent-form item carries the trend when it supports the bet).
  const seasonGames = games.filter((g) => g.season === games[0]?.season)
  if (seasonGames.length >= 10) {
    const last15 = games.slice(0, 15).filter((g) => typeof g.values[cat] === 'number')
    const l = avg(vals(last15, cat))
    const sAvg = avg(vals(seasonGames, cat))
    if (last15.length >= 10 && sAvg > 0) {
      const ratio = l / sAvg
      if ((ratio >= 1.15 && !over) || (ratio <= 0.85 && over)) conflicts++
    }
  }
  if (history.stage?.stage === 'declining' && over) {
    const hit = (gs: PlayerGameRecord[]) => {
      const r = gs.map((g) => playerHit(o, g)).filter((x): x is boolean => x !== null)
      return r.length >= 15 ? r.filter(Boolean).length / r.length : null
    }
    const recentSeasons = Array.from(new Set(games.map((g) => g.season))).sort().reverse().slice(0, 2)
    const career = hit(games)
    const recent = hit(games.filter((g) => recentSeasons.includes(g.season)))
    if (career !== null && recent !== null && career - recent >= 0.1) conflicts++
  }
  return { edges, conflicts }
}
