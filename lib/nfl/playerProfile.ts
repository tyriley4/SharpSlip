import { slugify } from '@/lib/players/slug'
import type { PlayerRow, RecentFormGame, StatLine, TonightEdge } from '@/lib/players/types'
import { calculateCareerHitRate } from '@/lib/props/careerHitRates'
import { getCareerPayload } from '@/lib/props/careerLogs'
import { getCurrentNFLSeason, getNFLPlayerStats, getNFLWeeklyPlayerStats } from './api'
import { formatNflBettingThreshold, isNflBettingSub, NFL_BETTING_CATEGORIES, NFL_BETTING_THRESHOLDS } from './bettingCategories'
import { NFL_TEAM_NAMES, normalizeNflAbbr } from './divisions'

type Row = Record<string, string>
const n = (v: string | undefined) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}
const r1 = (x: number) => Math.round(x * 10) / 10

export interface NflPlayerProfile {
  row: PlayerRow
  /** ESPN id, for the career prop record. */
  espnId: string
  /** QB / RB / WR / TE when the player has prop markets. */
  propSub: 'QB' | 'RB' | 'WR' | 'TE' | null
}

/** Passer rating (NFL scale). */
function rating(comp: number, att: number, yds: number, td: number, int: number): number {
  if (att === 0) return 0
  const a = Math.max(0, Math.min(2.375, (comp / att - 0.3) * 5))
  const b = Math.max(0, Math.min(2.375, (yds / att - 3) * 0.25))
  const c = Math.max(0, Math.min(2.375, (td / att) * 20))
  const d = Math.max(0, Math.min(2.375, 2.375 - (int / att) * 25))
  return ((a + b + c + d) / 6) * 100
}

/** Builds an NFL player page from this season's ESPN box-score rows. Null if the player has no stats this season. */
export async function buildNflPlayerProfile(slug: string, team?: string): Promise<NflPlayerProfile | null> {
  const season = getCurrentNFLSeason()
  const [seasonRows, weekly] = await Promise.all([getNFLPlayerStats(season), getNFLWeeklyPlayerStats(season)])
  const hits = (seasonRows ?? []).filter((r) => slugify(r.player_display_name || r.player_name) === slug)
  if (hits.length === 0) return null
  const wanted = team ? normalizeNflAbbr(team) : null
  const s: Row = (wanted ? hits.find((r) => normalizeNflAbbr(r.recent_team || r.team) === wanted) : undefined) ?? hits[0]
  const position = s.position || ''
  const abbr = normalizeNflAbbr(s.recent_team || s.team)
  if (!NFL_TEAM_NAMES[abbr]) return null

  const games = (weekly ?? []).filter((r) => r.player_id === s.player_id).sort((a, b) => n(b.week) - n(a.week))
  const sub = isNflBettingSub(position) ? position : null

  const season_stats: StatLine = {}
  let headline: string | null = null
  if (position === 'QB') {
    season_stats.passYds = n(s.passing_yards)
    season_stats.td = n(s.passing_tds)
    season_stats.int = n(s.interceptions)
    season_stats.rating = r1(rating(n(s.completions), n(s.attempts), n(s.passing_yards), n(s.passing_tds), n(s.interceptions)))
    headline = `${n(s.passing_yards).toLocaleString('en-US')} Pass Yds`
  } else if (position === 'RB') {
    season_stats.rushYds = n(s.rushing_yards)
    season_stats.td = n(s.rushing_tds)
    season_stats.recYds = n(s.receiving_yards)
    headline = `${n(s.rushing_yards).toLocaleString('en-US')} Rush Yds`
  } else if (position === 'WR' || position === 'TE') {
    season_stats.rec = n(s.receptions)
    season_stats.recYds = n(s.receiving_yards)
    season_stats.td = n(s.receiving_tds)
    headline = `${n(s.receiving_yards).toLocaleString('en-US')} Rec Yds`
  } else {
    season_stats.tackles = n(s.def_tackles)
    season_stats.sacks = n(s.def_sacks)
    headline = `${n(s.def_tackles)} Tackles`
  }

  const recent: RecentFormGame[] = games.filter((g) => g.game_result).slice(0, 10).map((g) => {
    const stats: StatLine =
      position === 'QB'
        ? { comp: `${n(g.completions)}/${n(g.attempts)}`, yds: n(g.passing_yards), td: n(g.passing_tds), int: n(g.interceptions), rating: r1(rating(n(g.completions), n(g.attempts), n(g.passing_yards), n(g.passing_tds), n(g.interceptions))) }
        : position === 'RB'
          ? { att: n(g.carries), yds: n(g.rushing_yards), ypc: n(g.carries) > 0 ? r1(n(g.rushing_yards) / n(g.carries)) : '—', td: n(g.rushing_tds) + n(g.receiving_tds) }
          : position === 'WR' || position === 'TE'
            ? { tgt: n(g.targets), rec: n(g.receptions), yds: n(g.receiving_yards), td: n(g.receiving_tds) }
            : { tkl: n(g.def_tackles), sack: n(g.def_sacks), tfl: n(g.def_tackles_for_loss), pd: n(g.def_pass_defended), int: n(g.def_interceptions) }
    return { opp: g.opponent_team, date: `Wk ${g.week}`, result: g.game_result === 'W' ? 'W' : 'L', stats }
  })

  // Tonight's Edge: the prop he has cleared most convincingly this season, from ESPN's game log.
  let edge: TonightEdge = {}
  if (sub) {
    const payload = await getCareerPayload({ sport: 'nfl', playerId: s.player_id, scope: 'season' }).catch(() => null)
    if (payload) {
      let best: { category: string; threshold: number; hits: number; n: number; score: number } | null = null
      for (const category of NFL_BETTING_CATEGORIES[sub]) {
        NFL_BETTING_THRESHOLDS[category].forEach((t, idx) => {
          const c = calculateCareerHitRate(payload.games, category, t)
          if (c.gamesPlayed < 3 || c.hitRate < 60) return
          const score = c.hitRate + idx * 6 - (category === 'Anytime TD' ? 30 : 0)
          if (!best || score > best.score) best = { category, threshold: t, hits: Number(c.record.split('-')[0]), n: c.gamesPlayed, score }
        })
      }
      const b = best as { category: string; threshold: number; hits: number; n: number; score: number } | null
      if (b) {
        const label = `${b.category} ${formatNflBettingThreshold(b.category, b.threshold)}`
        edge = {
          propLine: label,
          propRecord: `${b.hits}-${b.n - b.hits}`,
          hitRate: Math.round((b.hits / b.n) * 100),
          last10: payload.games.slice(0, 10).map((g) => g.values[b.category] >= b.threshold),
          lean: `${s.player_display_name} has reached ${label} in ${b.hits} of ${b.n} games this season. A hit-rate read from game logs, not a price.`,
          risk: b.n < 6 ? `Small sample — only ${b.n} games.` : undefined,
          prop: { category: b.category, threshold: b.threshold },
        }
      }
    }
  }

  const row: PlayerRow = {
    id: `nfl-${s.player_id}`,
    slug,
    name: s.player_display_name || s.player_name,
    team: abbr,
    sport: 'nfl',
    position,
    is_hot: false,
    headline_stat: headline,
    season_stats,
    recent_form: recent,
    prop_records: [],
    best_opponents: [],
    worst_opponents: [],
    best_venues: [],
    worst_venues: [],
    career_vs_opponents: {},
    tonight_edge: edge,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  return { row, espnId: s.player_id, propSub: sub }
}
