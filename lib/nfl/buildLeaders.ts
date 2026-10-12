import type { LeaderGroup, LeaderRow } from '@/data/leaders/types'
import { getNFLDefenseStats, getNFLPlayerStats, getNFLSchedule } from './api'
import { NFL_TEAM_NAMES, normalizeNflAbbr } from './divisions'
import { NFL_LEADER_CATS } from './leaderCategories'

function n(v: string | undefined): number {
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : 0
}

function passerRating(comp: number, att: number, yds: number, td: number, int: number): number {
  if (att === 0) return 0
  const a = Math.max(0, Math.min(2.375, (comp / att - 0.3) * 5))
  const b = Math.max(0, Math.min(2.375, (yds / att - 3) * 0.25))
  const c = Math.max(0, Math.min(2.375, (td / att) * 20))
  const d = Math.max(0, Math.min(2.375, 2.375 - (int / att) * 25))
  return ((a + b + c + d) / 6) * 100
}

function toRows(
  entries: { name: string; team: string; value: number; display: string }[],
  ascending: boolean,
  limit: number
): LeaderRow[] {
  const sorted = [...entries].sort((a, b) => (ascending ? a.value - b.value : b.value - a.value)).slice(0, limit)
  return sorted.map((e, i) => ({
    rank: i + 1,
    name: e.name,
    team: normalizeNflAbbr(e.team),
    value: e.display,
    record: '—',
    hitPct: 0,
  }))
}

// Minimum volume to qualify for a "leaders" list — without this, small-sample backups
// (e.g. a QB who attempted 5 passes) dominate rate stats like Comp% and Rating.
const QUALIFIERS: Record<string, (r: Record<string, string>) => boolean> = {
  QB: (r) => n(r.attempts) >= 100,
  RB: (r) => n(r.carries) >= 30,
  WR: (r) => n(r.targets) >= 20,
  TE: (r) => n(r.targets) >= 20,
}

function buildOffenseCategory(
  rows: Record<string, string>[],
  position: string,
  category: string,
  limit: number
): LeaderRow[] {
  const pool = rows.filter((r) => r.position === position && (QUALIFIERS[position]?.(r) ?? true))

  const entries = pool.map((r) => {
    const name = r.player_display_name || r.player_name
    const team = r.recent_team
    switch (category) {
      case 'Pass Yds':
        return { name, team, value: n(r.passing_yards), display: String(n(r.passing_yards)) }
      case 'TDs': {
        const td = position === 'QB' ? n(r.passing_tds) : n(r.rushing_tds) + n(r.receiving_tds)
        return { name, team, value: td, display: String(td) }
      }
      case 'Comp%': {
        const pct = n(r.attempts) > 0 ? (n(r.completions) / n(r.attempts)) * 100 : 0
        return { name, team, value: pct, display: `${pct.toFixed(1)}%` }
      }
      case 'Rating': {
        const rating = passerRating(n(r.completions), n(r.attempts), n(r.passing_yards), n(r.passing_tds), n(r.interceptions))
        return { name, team, value: rating, display: rating.toFixed(1) }
      }
      case 'Rush Yds':
        return { name, team, value: n(r.rushing_yards), display: String(n(r.rushing_yards)) }
      case 'INTs':
        return { name, team, value: n(r.interceptions), display: String(n(r.interceptions)) }
      case 'YPC': {
        const ypc = n(r.carries) > 0 ? n(r.rushing_yards) / n(r.carries) : 0
        return { name, team, value: ypc, display: ypc.toFixed(1) }
      }
      case 'Rec':
        return { name, team, value: n(r.receptions), display: String(n(r.receptions)) }
      case 'Rec Yds':
        return { name, team, value: n(r.receiving_yards), display: String(n(r.receiving_yards)) }
      case 'Fumbles': {
        const fum = n(r.rushing_fumbles) + n(r.receiving_fumbles)
        return { name, team, value: fum, display: String(fum) }
      }
      case 'Targets':
        return { name, team, value: n(r.targets), display: String(n(r.targets)) }
      case 'YPR': {
        const ypr = n(r.receptions) > 0 ? n(r.receiving_yards) / n(r.receptions) : 0
        return { name, team, value: ypr, display: ypr.toFixed(1) }
      }
      case 'Target%': {
        const pct = n(r.target_share) * 100
        return { name, team, value: pct, display: `${pct.toFixed(1)}%` }
      }
      default:
        return { name, team, value: 0, display: '0' }
    }
  })

  const ascending = category === 'INTs' || category === 'Fumbles'
  return toRows(entries, ascending, limit)
}

function buildDefenseCategory(rows: Record<string, string>[], category: string, limit: number): LeaderRow[] {
  const pool = rows.filter((r) => ['DL', 'LB', 'DB'].includes(r.position_group))

  const fieldFor: Record<string, string> = {
    Sacks: 'def_sacks',
    INT: 'def_interceptions',
    Tackles: 'def_tackles',
    PD: 'def_pass_defended',
    FF: 'def_fumbles_forced',
    TFL: 'def_tackles_for_loss',
  }
  const field = fieldFor[category]

  const entries = pool.map((r) => {
    const value = n(r[field])
    return { name: r.player_display_name || r.player_name, team: r.team, value, display: String(value) }
  })

  return toRows(entries, false, limit)
}

function buildTeamCategories(
  schedule: Record<string, string>[],
  offenseRows: Record<string, string>[],
  limit: number
): Record<string, LeaderRow[]> {
  const played = schedule.filter((r) => r.game_type === 'REG' && r.home_score !== '' && r.away_score !== '')
  const games = new Map<string, number>()
  const pointsFor = new Map<string, number>()
  const pointsAgainst = new Map<string, number>()

  const bump = (map: Map<string, number>, team: string, amount: number) => {
    map.set(team, (map.get(team) ?? 0) + amount)
  }

  for (const g of played) {
    const home = normalizeNflAbbr(g.home_team)
    const away = normalizeNflAbbr(g.away_team)
    bump(games, home, 1)
    bump(games, away, 1)
    bump(pointsFor, home, n(g.home_score))
    bump(pointsFor, away, n(g.away_score))
    bump(pointsAgainst, home, n(g.away_score))
    bump(pointsAgainst, away, n(g.home_score))
  }

  const passYds = new Map<string, number>()
  const rushYds = new Map<string, number>()
  for (const r of offenseRows) {
    const team = normalizeNflAbbr(r.recent_team)
    bump(passYds, team, n(r.passing_yards))
    bump(rushYds, team, n(r.rushing_yards))
  }

  const teams = Array.from(games.keys())
  const build = (metric: Map<string, number>, ascending: boolean) => {
    const entries = teams.map((t) => {
      const gp = games.get(t) ?? 1
      const perGame = (metric.get(t) ?? 0) / gp
      return { name: NFL_TEAM_NAMES[t] ?? t, team: t, value: perGame, display: perGame.toFixed(1) }
    })
    return toRows(entries, ascending, limit)
  }

  return {
    'Points/G': build(pointsFor, false),
    'Pass Yds/G': build(passYds, false),
    'Rush Yds/G': build(rushYds, false),
    'Pts Allowed/G': build(pointsAgainst, true),
  }
}

export async function buildNflLeaders(season: number, limit = 15): Promise<LeaderGroup | null> {
  const [offenseRows, defenseRows, schedule] = await Promise.all([
    getNFLPlayerStats(season),
    getNFLDefenseStats(season),
    getNFLSchedule(season),
  ])

  if (!offenseRows || !schedule) return null

  const rows: Record<string, Record<string, LeaderRow[]>> = {
    Teams: buildTeamCategories(schedule, offenseRows, limit),
    QB: {},
    RB: {},
    WR: {},
    TE: {},
    DEF: {},
  }

  for (const cat of NFL_LEADER_CATS.QB) rows.QB[cat] = buildOffenseCategory(offenseRows, 'QB', cat, limit)
  for (const cat of NFL_LEADER_CATS.RB) rows.RB[cat] = buildOffenseCategory(offenseRows, 'RB', cat, limit)
  for (const cat of NFL_LEADER_CATS.WR) rows.WR[cat] = buildOffenseCategory(offenseRows, 'WR', cat, limit)
  for (const cat of NFL_LEADER_CATS.TE) rows.TE[cat] = buildOffenseCategory(offenseRows, 'TE', cat, limit)
  if (defenseRows) {
    for (const cat of NFL_LEADER_CATS.DEF) rows.DEF[cat] = buildDefenseCategory(defenseRows, cat, limit)
  }

  return {
    subs: ['Teams', 'QB', 'RB', 'WR', 'TE', 'DEF'],
    cats: NFL_LEADER_CATS,
    rows,
  }
}
