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
  organic: 'earned through performance, the most sustainable kind of expansion',
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
          description: `${spec.key === 'Targets' ? 'Commanding' : 'Averaging'} ${r.toFixed(1)} ${spec.label} per game over the last ${recent.length} games — expanded from a ${s.toFixed(1)} season average (${k} expansion: ${TYPE_TEXT[k]})`,
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
        // The same expansion supports every correlated receiving market at once.
        if (game.sport === 'nfl' && spec.key === 'Targets') {
          edges.push({
            description: 'Expanded role creates potential value across reception, receiving-yard and touchdown markets, since all three ride on the same target volume',
            category: 'role',
            horizon: 'last7',
            layer: 'opportunity',
            relevanceScore: 0.6,
            supportingData: 'Correlated props: receptions, receiving yards, anytime touchdown',
            weight: 0,
            quality: q(3, 3, 3, 1),
          })
        }
      } else if (over && r >= spec.floor && (ratio < spec.jump || kind === 'noise')) {
        // A jump driven by one or two big games (noise) is not surfaced as an expansion; the steady usage still is.
        edges.push({
          description: `Clear role: ${r.toFixed(1)} ${spec.label} per game over the last ${recent.length} games`,
          category: 'role',
          horizon: 'last7',
          layer: 'opportunity',
          relevanceScore: Math.min(1, 0.55 + Math.max(0, r / Math.max(spec.floor, 1) - 1) * 0.5),
          supportingData: `Season average ${s.toFixed(1)} ${spec.label}`,
          weight: 0.12,
          ageDays: age,
          quality: q(3, 3, 3, recent.length >= 4 ? 1 : 0),
          sample: recent.length,
        })
      } else if (over && ratio <= 0.85) conflicts++
      else if (!over && ratio <= 0.85) {
        edges.push({ description: `Usage is down: ${r.toFixed(1)} ${spec.label} per game over the last ${recent.length} games against ${s.toFixed(1)} for the season`, category: 'role', horizon: 'last7', layer: 'opportunity', relevanceScore: 0.6, supportingData: 'Fewer opportunities lowers the ceiling', weight: 0.12, ageDays: age, quality: q(3, 3, 3, 1), sample: recent.length })
      }
      // Sustained usage: five-plus targets in three or more straight games.
      if (over && game.sport === 'nfl' && spec.key === 'Targets') {
        let streak = 0
        for (const g of games) {
          if ((g.values.Targets ?? 0) >= 5) streak++
          else break
        }
        if (streak >= 3) edges.push({ description: `5+ targets in ${streak} consecutive games — sustained usage elevation`, category: 'role', horizon: 'last7', layer: 'opportunity', relevanceScore: Math.min(1, 0.5 + (streak - 3) * 0.1), supportingData: games.slice(0, streak).map((g) => g.values.Targets).join(', ') + ' targets (most recent first)', weight: 0.1, ageDays: age, quality: q(3, 3, 3, 0), sample: streak })
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
        if (kind !== 'noise') edges.push({ description: `Snap share has expanded to ${Math.round(rec * 100)}% over the last 3 games from ${Math.round(seasonAvg * 100)}% for the season (${kind} expansion: ${TYPE_TEXT[kind]})`, category: 'role', horizon: 'last7', layer: 'opportunity', relevanceScore: 0.7, supportingData: `Snap share by game: ${(p?.games ?? []).slice(0, 3).map((g) => (g.snapPct === null ? '—' : `${Math.round(g.snapPct * 100)}%`)).join(', ')}`, weight: kind === 'organic' ? 0.18 : 0.14, ageDays: 7, quality: q(3, 3, 3, 1), sample: 3 })
      }
      if (last3.length === 3 && last3.every((v) => v > 0.65)) edges.push({ description: `Lead back: above 65% of offensive snaps in each of the last 3 games`, category: 'role', horizon: 'last7', layer: 'opportunity', relevanceScore: 0.7, supportingData: 'Snap counts, nflverse', weight: 0.12, ageDays: 7, quality: q(3, 3, 3, 1), sample: 3 })
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
  const stage = history.stage
  const cat = o.category

  // Trajectory over the last 15 games.
  const seasonGames = games.filter((g) => g.season === games[0]?.season)
  if (seasonGames.length >= 10) {
    const last15 = games.slice(0, 15).filter((g) => typeof g.values[cat] === 'number')
    const l = avg(vals(last15, cat))
    const s = avg(vals(seasonGames, cat))
    if (last15.length >= 10 && s > 0) {
      const ratio = l / s
      const up = ratio >= 1.15
      const down = ratio <= 0.85
      if ((up && over) || (down && !over)) {
        edges.push({
          description: `Averaging ${l.toFixed(1)} ${cat} over the last ${last15.length} games against ${s.toFixed(1)} for the season — ${up ? 'ascending trajectory — above season average' : 'declining trajectory — below season average'}${stage && ((up && stage.stage === 'ascending') || (down && stage.stage === 'declining')) ? `, consistent with a ${stage.stage === 'ascending' ? 'young, rising' : 'veteran'} player` : ''}`,
          category: 'recent_form',
          horizon: 'last15',
          layer: 'statistical',
          relevanceScore: Math.min(1, 0.45 + Math.abs(ratio - 1) * 1.6),
          supportingData: `${up ? '+' : ''}${Math.round((ratio - 1) * 100)}% against the season average`,
          weight: 0.12,
          ageDays: daysSince(games[0].date),
          quality: q(3, 2, 3, 2),
          sample: last15.length,
          metrics: { avg: l, n: last15.length },
        })
      } else if ((up && !over) || (down && over)) conflicts++
    }
  }

  // How the history is being read for this player.
  if (stage && stage.stage !== 'prime') {
    const hit = (gs: PlayerGameRecord[]) => {
      const r = gs.map((g) => playerHit(o, g)).filter((x): x is boolean => x !== null)
      return r.length >= 15 ? { rate: r.filter(Boolean).length / r.length, n: r.length } : null
    }
    const seasonsRecent = Array.from(new Set(games.map((g) => g.season))).sort().reverse().slice(0, 2)
    const career = hit(games)
    const recent = hit(games.filter((g) => seasonsRecent.includes(g.season)))
    const detail = stage.age ? ` (age ${stage.age}${stage.years ? `, year ${stage.years}` : ''})` : ''
    if (stage.stage === 'declining' && career && recent && career.rate - recent.rate >= 0.1) {
      edges.push({ description: `Career average reflects peak years — the recent two-season baseline is more predictive: ${Math.round(recent.rate * 100)}% over the last two seasons against ${Math.round(career.rate * 100)}% for the career${detail}`, category: 'role', horizon: 'career', layer: 'statistical', relevanceScore: 0.6, supportingData: stage.label, weight: 0, quality: q(3, 3, 2, 2) })
      if (over) conflicts++
    } else {
      edges.push({ description: `${stage.stage === 'ascending' ? 'Ascending player' : 'Veteran'}${detail} — ${stage.stage === 'ascending' ? 'recent trajectory weighted heavily' : 'the last two seasons are the baseline'}`, category: 'role', horizon: 'tonight', layer: 'opportunity', relevanceScore: 0.55, supportingData: stage.label, weight: 0, quality: q(3, 3, 3, 1) })
    }
  }
  return { edges, conflicts }
}
