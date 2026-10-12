import { aggregate, subFor, type CfbSub } from '@/lib/college/cfbLeaders'
import { CFB_BETTING_CATEGORIES, CFB_BETTING_THRESHOLDS, formatCfbThreshold, isCfbBettingSub } from '@/lib/college/cfbProps'
import { findCollegeTeam, getCollegeDirectory } from '@/lib/college/directory'
import { getTeamSchedule } from '@/lib/espn/api'
import { getLeagueData, type PlayerGameRow } from '@/lib/football/league'
import { slugify } from '@/lib/players/slug'
import type { PlayerRow, RecentFormGame, StatLine, TonightEdge } from '@/lib/players/types'
import { getCfbNationalRanks, ncaaRating } from './engine'

/**
 * College football player pages, built from the same league-wide box-score rows as the Leaders boards.
 * Only real figures are used: season totals, per-game logs, hit rates against standard prop thresholds,
 * and the opponent's national defensive rank.
 */

export interface CfbPlayerGame {
  gameId: string
  date: string
  opp: string
  home: boolean
  result: 'W' | 'L' | 'T'
  /** Prop-category value for this game (null = the player had no line in that category). */
  values: Record<string, number | null>
}

export function propValues(r: PlayerGameRow): Record<string, number | null> {
  const rushed = (r.car ?? 0) > 0 || (r.att ?? 0) > 0
  return {
    'Pass Yards': (r.att ?? 0) > 0 ? (r.pyds ?? 0) : null,
    'Rush Yards': rushed ? (r.ryds ?? 0) : null,
    'Receiving Yards': r.rec !== undefined ? (r.recyds ?? 0) : null,
    Receptions: r.rec !== undefined ? (r.rec ?? 0) : null,
    'Anytime TD': (r.rtd ?? 0) + (r.rectd ?? 0) + (r.ptd ?? 0) > 0 ? 1 : 0,
  }
}

export interface CfbPlayerRef {
  playerId: string
  name: string
  team: string
  teamId: string
}

/** Finds a player in this season's box scores by name slug (and team, when the link carries one). */
export function findCfbPlayerBySlug(slug: string, team?: string): CfbPlayerRef | null {
  const { rows } = getLeagueData('college-football')
  const seen = new Map<string, { ref: CfbPlayerRef; games: number }>()
  for (const r of rows) {
    if (slugify(r.name) !== slug) continue
    const hit = seen.get(r.playerId)
    if (hit) hit.games++
    else seen.set(r.playerId, { ref: { playerId: r.playerId, name: r.name, team: r.team, teamId: r.teamId }, games: 1 })
  }
  const all = Array.from(seen.values())
  if (all.length === 0) return null
  const wanted = team?.toUpperCase()
  const onTeam = wanted ? all.filter((x) => x.ref.team.toUpperCase() === wanted) : []
  const pool = onTeam.length > 0 ? onTeam : all
  return pool.sort((a, b) => b.games - a.games)[0].ref
}

export function cfbPlayerGames(playerId: string): { games: CfbPlayerGame[]; rows: PlayerGameRow[] } {
  const rows = getLeagueData('college-football')
    .rows.filter((r) => r.playerId === playerId)
    .sort((a, b) => b.date.localeCompare(a.date))
  return {
    rows,
    games: rows.map((r) => ({ gameId: r.gameId, date: r.date, opp: r.opp, home: r.home, result: r.result, values: propValues(r) })),
  }
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

export interface CfbPlayerProfile {
  row: PlayerRow
  games: CfbPlayerGame[]
  /** Prop categories this position is offered (empty for defenders). */
  categories: string[]
  teamColor: string
  conference: string | null
}

function formRow(sub: CfbSub | null, r: PlayerGameRow): RecentFormGame['stats'] {
  const ypc = (r.car ?? 0) > 0 ? ((r.ryds ?? 0) / (r.car ?? 1)).toFixed(1) : '—'
  if (sub === 'QB') {
    return { comp: `${r.comp ?? 0}/${r.att ?? 0}`, yds: r.pyds ?? 0, td: r.ptd ?? 0, int: r.int ?? 0, rating: ncaaRating(r.comp ?? 0, r.att ?? 0, r.pyds ?? 0, r.ptd ?? 0, r.int ?? 0).toFixed(1) }
  }
  if (sub === 'RB') return { att: r.car ?? 0, yds: r.ryds ?? 0, ypc, td: (r.rtd ?? 0) + (r.rectd ?? 0) }
  if (sub === 'WR' || sub === 'TE') return { tgt: r.tgts ?? '—', rec: r.rec ?? 0, yds: r.recyds ?? 0, td: r.rectd ?? 0 }
  return { tkl: r.tot ?? 0, sack: r.sacks ?? 0, tfl: r.tfl ?? 0, pd: r.pd ?? 0, int: r.dint ?? 0 }
}

export async function buildCfbPlayerProfile(ref: CfbPlayerRef, slug: string): Promise<CfbPlayerProfile | null> {
  const { rows, games } = cfbPlayerGames(ref.playerId)
  if (rows.length === 0) return null
  const data = getLeagueData('college-football')
  const [dir, team] = await Promise.all([getCollegeDirectory('cfb'), findCollegeTeam('cfb', ref.teamId)])
  const agg = aggregate(rows).get(ref.playerId)
  if (!agg) return null
  const rosterPos = data.positions[ref.playerId]
  const sub = subFor(agg, rosterPos)
  const position = rosterPos || sub || '—'

  const season: StatLine = {}
  let headline: string | null = null
  if (sub === 'QB') {
    season.passYds = agg.pyds; season.passTd = agg.ptd; season.int = agg.int; season.compPct = agg.att ? Math.round((agg.comp / agg.att) * 1000) / 10 : 0
    season.rating = Math.round(ncaaRating(agg.comp, agg.att, agg.pyds, agg.ptd, agg.int) * 10) / 10; season.rushYds = agg.ryds
    headline = `${agg.pyds.toLocaleString('en-US')} Pass Yds`
  } else if (sub === 'RB') {
    season.rushYds = agg.ryds; season.rushTd = agg.rtd; season.ypc = agg.car ? Math.round((agg.ryds / agg.car) * 10) / 10 : 0; season.recYds = agg.recyds
    headline = `${agg.ryds.toLocaleString('en-US')} Rush Yds`
  } else if (sub === 'WR' || sub === 'TE') {
    season.rec = agg.rec; season.recYds = agg.recyds; season.recTd = agg.rectd; season.ypr = agg.rec ? Math.round((agg.recyds / agg.rec) * 10) / 10 : 0
    headline = `${agg.recyds.toLocaleString('en-US')} Rec Yds`
  } else {
    season.tackles = agg.tot; season.sacks = agg.sacks; season.tfl = agg.tfl; season.pd = agg.pd; season.int = agg.dint
    headline = `${agg.tot} Tackles`
  }

  // "Hot": the last two games' main stat runs well ahead of the season pace.
  const key = (r: PlayerGameRow) => (sub === 'QB' ? (r.pyds ?? 0) : sub === 'RB' ? (r.ryds ?? 0) : sub === 'WR' || sub === 'TE' ? (r.recyds ?? 0) : (r.tot ?? 0))
  const avg = rows.reduce((s, r) => s + key(r), 0) / rows.length
  const recent = rows.slice(0, 2).reduce((s, r) => s + key(r), 0) / Math.min(2, rows.length)
  const isHot = rows.length >= 4 && avg > 0 && recent >= avg * 1.35

  const categories = sub && isCfbBettingSub(sub) ? CFB_BETTING_CATEGORIES[sub] : []
  const tonight = await tonightEdge(ref, games, categories)

  const row: PlayerRow = {
    id: `cfb-${ref.playerId}`,
    slug,
    name: ref.name,
    team: ref.team,
    sport: 'cfb',
    position,
    is_hot: isHot,
    headline_stat: headline,
    season_stats: season,
    recent_form: rows.slice(0, 10).map((r) => ({ opp: r.opp, date: fmtDate(r.date), result: r.result === 'W' ? 'W' : 'L', stats: formRow(sub, r) })),
    prop_records: [],
    best_opponents: [],
    worst_opponents: [],
    best_venues: [],
    worst_venues: [],
    career_vs_opponents: {},
    tonight_edge: tonight,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  return { row, games, categories, teamColor: team?.color ?? dir?.colors[ref.team] ?? '#8B0000', conference: team?.conferenceAbbr ?? null }
}

/** The player's most compelling real prop hit rate against his next opponent. */
async function tonightEdge(ref: CfbPlayerRef, games: CfbPlayerGame[], categories: string[]): Promise<TonightEdge> {
  if (categories.length === 0) return {}
  let best: { category: string; threshold: number; hits: number; n: number; idx: number; score: number } | null = null
  for (const category of categories) {
    const sample = games.filter((g) => g.values[category] !== null && g.values[category] !== undefined)
    if (sample.length < 3) continue
    const ts = CFB_BETTING_THRESHOLDS[category] ?? []
    ts.forEach((t, idx) => {
      const hits = sample.filter((g) => (g.values[category] ?? 0) >= t).length
      const rate = hits / sample.length
      if (rate < 0.6) return
      const score = rate * 100 + idx * 8 + (category === 'Anytime TD' ? -40 : 0)
      if (!best || score > best.score) best = { category, threshold: t, hits, n: sample.length, idx, score }
    })
  }
  const pick = best as { category: string; threshold: number; hits: number; n: number; idx: number; score: number } | null
  if (!pick) return {}

  const sample = games.filter((g) => g.values[pick.category] !== null)
  const last10 = sample.slice(0, 10).map((g) => (g.values[pick.category] ?? 0) >= pick.threshold)

  let oppText: string | undefined
  let risk: string | undefined
  try {
    const sched = await getTeamSchedule('football', 'college-football', ref.teamId)
    const next = (sched ?? []).find((g) => g.state !== 'post')
    if (next) {
      const ranks = await getCfbNationalRanks(next.opponent.id)
      const metric =
        pick.category === 'Pass Yards' || pick.category === 'Receiving Yards' || pick.category === 'Receptions'
          ? { label: 'pass yards allowed per game', stat: ranks?.passAllowedYpg }
          : pick.category === 'Rush Yards'
            ? { label: 'rush yards allowed per game', stat: ranks?.rushAllowedYpg }
            : { label: 'points allowed per game', stat: ranks?.pointsAllowedPerGame }
      if (metric.stat && ranks) {
        const label = `${next.home ? 'vs' : '@'} ${next.opponent.name}`
        // Rank 1 = best defense (fewest allowed).
        oppText = `${label}: ranks ${ordinal(metric.stat.rank)} of ${ranks.of} FBS teams in ${metric.label} (${metric.stat.value.toFixed(1)}).`
        if (metric.stat.rank <= 25) risk = `${next.opponent.name} has a top-25 defense in this area (${ordinal(metric.stat.rank)}), which works against the Over.`
      } else {
        oppText = `Next game: ${next.home ? 'vs' : '@'} ${next.opponent.name}.`
      }
    }
  } catch {
    /* the edge still stands without the opponent context */
  }
  if (!risk) risk = pick.n < 6 ? `Small sample — only ${pick.n} games this season.` : last10[0] === false ? 'Missed this mark in the most recent game.' : 'Game script (a blowout either way) can cap a starter’s volume.'

  const label = `${pick.category} ${formatCfbThreshold(pick.category, pick.threshold)}`
  return {
    oppDefenseRank: oppText,
    propLine: label,
    propRecord: `${pick.hits}-${pick.n - pick.hits}`,
    hitRate: Math.round((pick.hits / pick.n) * 100),
    last10,
    lean: `${ref.name} has ${pick.category === 'Anytime TD' ? 'scored a touchdown' : `reached ${label}`} in ${pick.hits} of ${pick.n} games this season. This is a hit-rate read from game logs, not a price — compare it with the line your book posts.`,
    risk,
  }
}

function ordinal(x: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = x % 100
  return `${x}${s[(v - 20) % 10] || s[v] || s[0]}`
}
