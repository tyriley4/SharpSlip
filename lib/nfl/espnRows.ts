import { getLeagueData, type PlayerGameRow } from '@/lib/football/league'
import { normalizeNflAbbr } from './divisions'

type Row = Record<string, string>

/**
 * NFL player stats from ESPN box scores, shaped like nflverse's `stats_player` rows so every NFL tab, board and
 * player page can read them unchanged. ESPN posts a game's box score as soon as it ends (nflverse lags days),
 * so these are the primary rows. Columns ESPN doesn't publish (air yards, YAC, EPA, air-yards share …) are filled
 * from the matching nflverse row when one exists and are otherwise left empty — never invented.
 */

const NFLVERSE_ONLY = [
  'passing_air_yards', 'passing_yards_after_catch', 'passing_epa', 'passing_cpoe', 'pacr', 'dakota',
  'receiving_air_yards', 'receiving_yards_after_catch', 'receiving_epa', 'racr', 'air_yards_share', 'wopr',
  'rushing_epa', 'rushing_first_downs', 'receiving_first_downs', 'passing_first_downs',
]

const ADDITIVE_EXTRAS = ['passing_air_yards', 'passing_yards_after_catch', 'passing_epa', 'receiving_air_yards', 'receiving_yards_after_catch', 'receiving_epa', 'rushing_epa', 'rushing_first_downs', 'receiving_first_downs', 'passing_first_downs']

const norm = (name: string) =>
  name
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, '')
    .replace(/[^a-z]/g, '')

const s = (n: number | undefined) => String(n ?? 0)

function ppr(r: Row): string {
  const n = (k: string) => Number(r[k] ?? 0) || 0
  const pts = n('passing_yards') * 0.04 + n('passing_tds') * 4 - n('interceptions') * 2 + n('rushing_yards') * 0.1 + n('rushing_tds') * 6 + n('receptions') + n('receiving_yards') * 0.1 + n('receiving_tds') * 6 - n('fumbles_lost') * 2
  return (Math.round(pts * 100) / 100).toString()
}

function weekRow(g: PlayerGameRow, position: string, season: number): Row {
  const r: Row = {
    player_id: g.playerId,
    player_name: g.name,
    player_display_name: g.name,
    position,
    position_group: position,
    team: g.team,
    recent_team: g.team,
    opponent_team: g.opp,
    game_result: g.result,
    season: String(season),
    week: String(g.week ?? ''),
    season_type: 'REG',
    completions: s(g.comp),
    attempts: s(g.att),
    passing_yards: s(g.pyds),
    passing_tds: s(g.ptd),
    interceptions: s(g.int),
    passing_interceptions: s(g.int),
    sacks: s(g.sk),
    sacks_suffered: s(g.sk),
    sack_yards: s(g.skYds),
    sack_yards_lost: s(g.skYds),
    carries: s(g.car),
    rushing_yards: s(g.ryds),
    rushing_tds: s(g.rtd),
    receptions: s(g.rec),
    targets: s(g.tgts),
    receiving_yards: s(g.recyds),
    receiving_tds: s(g.rectd),
    fumbles_lost: s(g.fumLost),
    def_tackles_solo: s(g.solo ?? g.tot),
    def_tackle_assists: s(Math.max(0, (g.tot ?? 0) - (g.solo ?? g.tot ?? 0))),
    def_tackles: s(g.tot),
    def_sacks: s(g.sacks),
    def_tackles_for_loss: s(g.tfl),
    def_pass_defended: s(g.pd),
    def_interceptions: s(g.dint),
    def_fumble_recovery_opp: s(g.fumRec),
    fumble_recovery_opp: s(g.fumRec),
  }
  r.fantasy_points_ppr = ppr(r)
  return r
}

const SUM_KEYS = [
  'completions', 'attempts', 'passing_yards', 'passing_tds', 'interceptions', 'passing_interceptions', 'sacks', 'sacks_suffered', 'sack_yards', 'sack_yards_lost',
  'carries', 'rushing_yards', 'rushing_tds', 'receptions', 'targets', 'receiving_yards', 'receiving_tds', 'fumbles_lost',
  'def_tackles_solo', 'def_tackle_assists', 'def_tackles', 'def_sacks', 'def_tackles_for_loss', 'def_pass_defended', 'def_interceptions', 'def_fumble_recovery_opp', 'fumble_recovery_opp',
]

export interface EspnStatRows {
  weekly: Row[]
  season: Row[]
  /** ESPN season year the rows are from. */
  year: number
}

/**
 * Weekly and season rows for the NFL season from the ESPN box-score engine, or null while nothing has been collected
 * (the first build runs in the background). `nflverseWeekly` supplies the columns ESPN doesn't publish.
 */
export function espnNflStatRows(nflverseWeekly: Row[] | null, seasonYear?: number): EspnStatRows | null {
  const data = getLeagueData('nfl', seasonYear)
  if (data.rows.length === 0) return null
  const extras = new Map<string, Row>()
  for (const r of nflverseWeekly ?? []) extras.set(`${normalizeNflAbbr(r.recent_team || r.team)}|${r.week}|${norm(r.player_display_name || r.player_name || '')}`, r)

  const weekly = data.rows
    .filter((g) => g.week !== null)
    .map((g) => {
      const row = weekRow(g, data.positions[g.playerId] ?? '', data.season)
      const x = extras.get(`${g.team}|${g.week}|${norm(g.name)}`)
      if (x) for (const k of NFLVERSE_ONLY) if (x[k] !== undefined && x[k] !== '') row[k] = x[k]
      if (!row.position && x?.position) {
        row.position = x.position
        row.position_group = x.position_group || x.position
      }
      return row
    })
  // Target share from ESPN's own numbers: a player's targets over his team's that week.
  const teamTargets = new Map<string, number>()
  for (const r of weekly) teamTargets.set(`${r.team}|${r.week}`, (teamTargets.get(`${r.team}|${r.week}`) ?? 0) + (Number(r.targets) || 0))
  for (const r of weekly) {
    const t = teamTargets.get(`${r.team}|${r.week}`) ?? 0
    r.target_share = t > 0 ? String((Number(r.targets) || 0) / t) : '0'
  }

  const byPlayer = new Map<string, Row[]>()
  for (const r of weekly) byPlayer.set(r.player_id, [...(byPlayer.get(r.player_id) ?? []), r])
  const season: Row[] = []
  byPlayer.forEach((rows) => {
    rows.sort((a, b) => Number(a.week) - Number(b.week))
    const last = rows[rows.length - 1]
    const out: Row = { ...last, games: String(rows.length) }
    for (const k of SUM_KEYS) out[k] = String(rows.reduce((t, r) => t + (Number(r[k]) || 0), 0))
    out.fantasy_points_ppr = String(Math.round(rows.reduce((t, r) => t + (Number(r.fantasy_points_ppr) || 0), 0) * 100) / 100)
    const tot = rows.reduce((t, r) => t + (Number(r.targets) || 0), 0)
    const teamTot = rows.reduce((t, r) => t + (teamTargets.get(`${r.team}|${r.week}`) ?? 0), 0)
    out.target_share = teamTot > 0 ? String(tot / teamTot) : '0'
    // nflverse-only totals are only meaningful when every game has them.
    for (const k of ADDITIVE_EXTRAS) {
      const have = rows.filter((r) => r[k] !== undefined && r[k] !== '')
      if (have.length === rows.length && have.length > 0) out[k] = String(have.reduce((t, r) => t + (Number(r[k]) || 0), 0))
      else delete out[k]
    }
    delete out.week
    season.push(out)
  })
  return { weekly, season, year: data.season }
}
