import { slugify } from '@/lib/players/slug'
import { daysSince } from './historicalRates'
import { q } from './evidenceFramework'
import type { ModuleInput } from './modules/shared'
import { expansionEvidence, stageAndTrajectory } from './roleExpansion'
import type { Edge, Grade, ModuleOutput, PlayerGameRecord } from './types'

/**
 * Role change detection. A player's history describes the role he HAD; these checks look for signs that tonight's role is
 * different: coming back from a layoff, a new team, a teammate's absence, a lineup spot, or a clear jump in usage.
 * Only facts with a direct link to the bet are raised, and the player's own absence from the team's recent games is
 * described as what it is - a gap - rather than guessed to be an injury.
 */
export interface RoleOutput extends ModuleOutput {
  gradeCap?: { grade: Grade; note: string }
}

const ALIAS: Record<string, string> = { ARI: 'AZ', WAS: 'WSH', CWS: 'CHW', ATH: 'OAK' }
const same = (a: string, b: string) => (ALIAS[a] ?? a) === (ALIAS[b] ?? b)

/** Team games a player must miss before his return counts as a layoff, by sport. */
const MISSED_THRESHOLD: Record<string, number> = { mlb: 5, nba: 3, nhl: 3, nfl: 2, cfb: 2, cbb: 2 }

const INFO = (description: string, supportingData: string, extra: Partial<Edge> = {}): Edge => ({
  description,
  category: 'role',
  layer: 'opportunity',
  relevanceScore: 0.7,
  supportingData,
  weight: 0,
  quality: q(3, 3, 3, 1),
  ...extra,
})

const dayOf = (iso: string) => iso.slice(0, 10)

function lastN(games: PlayerGameRecord[], key: string, n: number) {
  return games.slice(0, n).map((g) => g.values[key]).filter((v): v is number => typeof v === 'number')
}

export function roleModule({ outcome: o, game, history }: ModuleInput): RoleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  let gradeCap: RoleOutput['gradeCap']
  if (o.type !== 'player_prop' || !o.player || !o.category) return { edges, conflicts }
  const over = o.direction !== 'under'
  const team = o.player.team
  const position = (o.player.position ?? '').toUpperCase()
  const games = history?.games ?? []

  // ---- Layoff: the team has played several games since the player's last one, in the same season.
  const teamGames = game.results[team] ?? []
  const curSeason = teamGames.length ? Math.max(...teamGames.map((g) => g.season)) : null
  // Regular-season games only: the player logs behind the history do not carry postseason games for every sport.
  const curTeamGames = curSeason === null ? [] : teamGames.filter((g) => g.season === curSeason && !g.playoff)
  if (games.length >= 8 && curTeamGames.length >= 4 && !game.priorSeasonOnly) {
    const lastDate = dayOf(games[0].date)
    const firstTeamDate = dayOf(curTeamGames[curTeamGames.length - 1].date)
    const missed = curTeamGames.filter((g) => dayOf(g.date) > lastDate).length
    if (lastDate >= firstTeamDate && missed >= (MISSED_THRESHOLD[game.sport] ?? 3)) {
      edges.push(INFO(`Missed ${team}'s last ${missed} games and appears to be returning — minutes and usage may be restricted`, `Last played ${lastDate}`))
      gradeCap = { grade: 'D', note: 'Returning after missed games — grade capped at D while the role re-establishes' }
      conflicts++
    }
  }

  // ---- New team: the most recent games were played for a different club.
  const withTeam = games.filter((g) => g.team)
  if (!gradeCap && withTeam.length >= 10 && game.sport !== 'nfl') {
    const idx = games.findIndex((g) => g.team && !same(g.team, team))
    const playedHere = idx === -1 ? games.length : idx
    const leftFor = idx === -1 ? null : games[idx].team
    if (leftFor && playedHere < 3 && daysSince(games[idx].date) < 400) {
      edges.push(INFO(`Early in tenure with ${team} (${playedHere} game${playedHere === 1 ? '' : 's'} so far; previously with ${leftFor}) — role and usage still establishing`, 'Team change in the game log'))
      gradeCap = { grade: 'D', note: 'First games with a new team — grade capped at D while the role establishes' }
      conflicts++
    }
  }

  // ---- Teammates who are out, when the absence is material and bears directly on this stat.
  const mates = (game.teammatesOut ?? []).filter((t) => t.team === team && t.player.toLowerCase() !== o.player!.name.toLowerCase())
  for (const t of mates) {
    const status = t.designation === 'doubtful' ? 'doubtful' : t.designation === 'ir' ? 'on injured reserve' : 'out'
    const tp = t.position.toUpperCase()
    let text: string | null = null
    if ((game.sport === 'nfl' || game.sport === 'cfb') && t.usage) {
      const rushing = o.category === 'Rush Yards'
      const receiving = o.category === 'Receiving Yards' || o.category === 'Receptions'
      const backs = ['RB', 'HB', 'FB']
      if (rushing && backs.includes(position) && backs.includes(tp)) {
        const lead = t.usage.value >= 12
        text = lead
          ? `Operating as clear lead back with ${t.player} (RB) ${status} — he averaged ${t.usage.value} ${t.usage.label} per game, so the role raises the opportunity ceiling beyond historical averages`
          : `${t.player} (RB) is ${status} — he averaged ${t.usage.value} ${t.usage.label} per game, which shifts to ${o.player.name}`
      } else if (receiving && ['WR', 'TE', 'RB'].includes(position) && ['WR', 'TE'].includes(tp)) {
        text = `${t.player} (${tp}) is ${status} — he averaged ${t.usage.value} ${t.usage.label} per game, so target share is projected to rise and the prop line may not reflect it`
      }
    } else if ((game.sport === 'nba' || game.sport === 'cbb' || game.sport === 'nhl') && t.usage && ['Points', 'Rebounds', 'Assists', 'Shots on Goal'].includes(o.category) && position !== 'G') {
      text = `${t.player} is ${status} (averaging ${t.usage.value} ${t.usage.label}) — creates additional ${game.sport === 'nhl' ? 'ice time and chances' : 'minutes and usage'} for ${o.player.name}`
    }
    if (text) {
      if (over) edges.push({ description: text, category: 'role', layer: 'opportunity', relevanceScore: 0.8, supportingData: 'Injury report', weight: 0.15, quality: q(3, 3, 3, 1) })
      else conflicts++
    }
    // A starting quarterback out is a negative for every pass catcher (a backup throws the ball).
    if (game.sport === 'nfl' && tp === 'QB' && o.category === 'Receiving Yards' && over) conflicts++
  }

  // ---- Role expansion (targets, carries, snaps, minutes, ice time), career stage and trajectory.
  const exp = expansionEvidence({ outcome: o, game, history })
  const traj = stageAndTrajectory({ outcome: o, game, history })
  edges.push(...exp.edges, ...traj.edges)
  conflicts += exp.conflicts + traj.conflicts

  // ---- MLB lineup spot: more plate appearances and run chances at the top of the order.
  if (game.sport === 'mlb' && game.mlb && ['Hits', 'Home Runs', 'Total Bases'].includes(o.category) && o.homeAway) {
    const order = game.mlb.lineups[o.homeAway]
    const slot = order.indexOf(slugify(o.player.name)) + 1
    if (slot > 0) {
      if (over && slot <= 3) edges.push({ description: `Batting ${slot === 1 ? 'leadoff' : slot === 2 ? 'second' : 'third'} tonight — the top of the order sees the most plate appearances and run-scoring chances`, category: 'role', layer: 'opportunity', relevanceScore: slot === 3 ? 0.55 : 0.65, supportingData: `Posted lineup, slot ${slot}`, weight: 0.1, ageDays: 0, quality: q(3, 3, 3, 1) })
      else if (over && slot >= 7) conflicts++
      else if (!over && slot >= 7) edges.push({ description: `Batting ${slot === 7 ? 'seventh' : slot === 8 ? 'eighth' : 'ninth'} tonight — fewer plate appearances and a lower run-production context`, category: 'role', layer: 'opportunity', relevanceScore: 0.55, supportingData: `Posted lineup, slot ${slot}`, weight: 0.1, ageDays: 0, quality: q(3, 3, 3, 1) })
    }
  }

  return { edges, conflicts, gradeCap }
}
