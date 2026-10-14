import { CBB_BETTING_CATEGORIES, CBB_BETTING_THRESHOLDS, formatCbbThreshold } from '@/lib/college/cbbProps'
import { cbbGameValue, getCbbSeasonInfo, playerPool } from '@/lib/college/cbbLeaders'
import { findCollegeTeam, getCollegeDirectory } from '@/lib/college/directory'
import { getPlayerGameLog, getPlayerProfile, getTeamSchedule, searchPlayer, type GameLogRow } from '@/lib/espn/api'
import { slugify } from '@/lib/players/slug'
import type { PlayerRow, StatLine, TonightEdge } from '@/lib/players/types'
import { CBB_LEAGUE } from './box'
import { getCbbTeamSeason, seasonLabel } from './engine'

/**
 * College basketball player pages: ESPN game logs for the season (last season's, before tip-off) turned into
 * averages, recent form, a prop calculator and the best real hit rate against the next opponent.
 */

export interface CbbPlayerRef {
  playerId: string
  name: string
  team: string
  teamId: string | null
}

export interface CbbCalcGame {
  date: string
  opp: string
  home: boolean
  values: Record<string, number | null>
}

export interface CbbPlayerProfile {
  row: PlayerRow
  games: CbbCalcGame[]
  categories: string[]
  teamColor: string
  conference: string | null
  seasonLabel: string
  priorSeason: boolean
}

const titleCase = (slug: string) => slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

export async function findCbbPlayerBySlug(slug: string, team?: string): Promise<CbbPlayerRef | null> {
  const info = await getCbbSeasonInfo()
  const pool = await playerPool(info.season)
  const matches = pool.filter((p) => slugify(p.name) === slug)
  const wanted = team?.toUpperCase()
  const pick = (wanted ? matches.find((p) => p.teamAbbr.toUpperCase() === wanted) : undefined) ?? matches[0]
  if (pick) return { playerId: pick.playerId, name: pick.name, team: pick.teamAbbr, teamId: pick.teamId || null }

  // Not among the leaders pool: ask ESPN's search for the name.
  const hits = await searchPlayer('basketball', CBB_LEAGUE, titleCase(slug)).catch(() => null)
  const hit = hits?.find((h) => slugify(h.name) === slug)
  if (!hit) return null
  const profile = await getPlayerProfile('basketball', CBB_LEAGUE, hit.id).catch(() => null)
  return { playerId: hit.id, name: hit.name, team: profile?.teamAbbr ?? '', teamId: profile?.teamId ?? null }
}

const num = (x: number | undefined) => x ?? 0
const half = (v: string | undefined): [number, number] => {
  const [a, b] = String(v ?? '0-0').split('-')
  return [Number(a) || 0, Number(b) || 0]
}
const r1 = (x: number) => Math.round(x * 10) / 10
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '—')

export async function buildCbbPlayerProfile(ref: CbbPlayerRef, slug: string): Promise<CbbPlayerProfile | null> {
  const info = await getCbbSeasonInfo()
  let season = info.season
  let log = await getPlayerGameLog('basketball', CBB_LEAGUE, ref.playerId, season).catch(() => null)
  let prior = info.lastSeason
  if (!log || log.rows.length === 0) {
    season = info.season - 1
    log = await getPlayerGameLog('basketball', CBB_LEAGUE, ref.playerId, season).catch(() => null)
    prior = true
  }
  if (!log || log.rows.length === 0) return null
  const rows: GameLogRow[] = log.rows
  const n = rows.length
  const sum = (f: (r: GameLogRow) => number) => rows.reduce((s, r) => s + f(r), 0)
  const mk = (key: string) => {
    let m = 0, a = 0
    for (const r of rows) {
      const [x, y] = half(r.raw[key])
      m += x
      a += y
    }
    return a > 0 ? r1((m / a) * 100) : 0
  }
  const ppg = r1(sum((r) => num(r.stats.points)) / n)
  const season_stats: StatLine = {
    ppg,
    rpg: r1(sum((r) => num(r.stats.totalRebounds)) / n),
    apg: r1(sum((r) => num(r.stats.assists)) / n),
    spg: r1(sum((r) => num(r.stats.steals)) / n),
    bpg: r1(sum((r) => num(r.stats.blocks)) / n),
    mpg: r1(sum((r) => num(r.stats.minutes)) / n),
    fgPct: mk('fieldGoalsMade-fieldGoalsAttempted'),
    tpPct: mk('threePointFieldGoalsMade-threePointFieldGoalsAttempted'),
    ftPct: mk('freeThrowsMade-freeThrowsAttempted'),
    tpmPg: r1(rows.reduce((s, r) => s + half(r.raw['threePointFieldGoalsMade-threePointFieldGoalsAttempted'])[0], 0) / n),
  }
  const last5 = rows.slice(0, 5).reduce((s, r) => s + num(r.stats.points), 0) / Math.min(5, n)
  const isHot = n >= 8 && ppg >= 8 && last5 >= ppg * 1.25

  const [profile, dir] = await Promise.all([getPlayerProfile('basketball', CBB_LEAGUE, ref.playerId).catch(() => null), getCollegeDirectory('cbb')])
  const teamAbbr = ref.team || profile?.teamAbbr || ''
  const team = ref.teamId ? await findCollegeTeam('cbb', ref.teamId) : teamAbbr ? await findCollegeTeam('cbb', teamAbbr) : null
  const position = profile?.position || '—'

  const games: CbbCalcGame[] = rows.map((r) => ({
    date: r.date ?? '',
    opp: r.opponent,
    home: r.home,
    values: Object.fromEntries(CBB_BETTING_CATEGORIES.map((c) => [c, cbbGameValue(c, r)])),
  }))

  const tonight = await tonightEdge(ref, games, team?.id ?? ref.teamId, season)

  const row: PlayerRow = {
    id: `cbb-${ref.playerId}`,
    slug,
    name: ref.name || profile?.name || titleCase(slug),
    team: team?.abbr ?? teamAbbr,
    sport: 'cbb',
    position,
    is_hot: isHot,
    headline_stat: `${ppg.toFixed(1)} PPG`,
    season_stats,
    recent_form: rows.slice(0, 10).map((r) => ({
      opp: r.opponent,
      date: fmtDate(r.date),
      result: r.result === 'W' ? 'W' : 'L',
      stats: { pts: num(r.stats.points), reb: num(r.stats.totalRebounds), ast: num(r.stats.assists), stl: num(r.stats.steals), blk: num(r.stats.blocks), min: num(r.stats.minutes) },
    })),
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
  return { row, games, categories: CBB_BETTING_CATEGORIES, teamColor: team?.color ?? dir?.colors[teamAbbr] ?? '#FF9F1C', conference: team?.conferenceAbbr ?? null, seasonLabel: seasonLabel(season), priorSeason: prior }
}

async function tonightEdge(ref: CbbPlayerRef, games: CbbCalcGame[], teamId: string | null, season: number): Promise<TonightEdge> {
  let best: { category: string; threshold: number; hits: number; n: number; score: number } | null = null
  for (const category of CBB_BETTING_CATEGORIES) {
    const sample = games.filter((g) => g.values[category] !== null && g.values[category] !== undefined)
    if (sample.length < 5) continue
    const ts = CBB_BETTING_THRESHOLDS[category] ?? []
    ts.forEach((t, idx) => {
      const hits = sample.filter((g) => (g.values[category] ?? 0) >= t).length
      const rate = hits / sample.length
      if (rate < 0.6) return
      const score = rate * 100 + idx * 8
      if (!best || score > best.score) best = { category, threshold: t, hits, n: sample.length, score }
    })
  }
  const pick = best as { category: string; threshold: number; hits: number; n: number; score: number } | null
  if (!pick) return {}
  const label = `${pick.category} ${formatCbbThreshold(pick.category, pick.threshold)}`
  const last10 = games.filter((g) => g.values[pick.category] !== null).slice(0, 10).map((g) => (g.values[pick.category] ?? 0) >= pick.threshold)

  let oppText: string | undefined
  try {
    const sched = teamId ? await getTeamSchedule('basketball', CBB_LEAGUE, teamId) : null
    const next = (sched ?? []).find((g) => g.state !== 'post')
    if (next && teamId) {
      const opp = await getCbbTeamSeason(next.opponent.id, next.opponent.abbr, season).catch(() => null)
      oppText = `${next.home ? 'vs' : '@'} ${next.opponent.name}${opp && opp.games > 0 ? `: allows ${opp.papg.toFixed(1)} pts/g, ${opp.oppFgPct.toFixed(1)}% shooting against${opp.priorSeason ? ` (${seasonLabel(opp.season)} season)` : ''}` : ''}.`
    } else {
      oppText = 'No upcoming game is scheduled yet — this is based on the completed season.'
    }
  } catch {
    /* edge stands without the opponent line */
  }
  return {
    oppDefenseRank: oppText,
    propLine: label,
    propRecord: `${pick.hits}-${pick.n - pick.hits}`,
    hitRate: Math.round((pick.hits / pick.n) * 100),
    last10,
    prop: { category: pick.category, threshold: pick.threshold },
    lean: `${ref.name} has reached ${label} in ${pick.hits} of ${pick.n} games. This is a hit-rate read from game logs, not a price — compare it with the line your book posts.`,
    risk: pick.n < 10 ? `Small sample — only ${pick.n} games.` : last10[0] === false ? 'Missed this mark in the most recent game.' : 'Minutes and foul trouble can swing a college player’s line quickly.',
  }
}
