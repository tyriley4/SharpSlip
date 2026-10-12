import { NFL_TEAM_COLORS } from '@/data/nfl/teamColors'
import { getTeamRoster } from '@/lib/espn/api'
import { toEspnAbbr } from '@/lib/espn/teams'
import { getActiveNFLSeason, getNFLPlayerStats, getNFLRosters, getNFLSchedule, getNFLStatsSeason, getNFLWeeklyPlayerStats } from '@/lib/nfl/api'
import { NFL_TEAM_DIVISIONS, NFL_TEAM_NAMES, normalizeNflAbbr } from '@/lib/nfl/divisions'
import { fetchCsv } from '@/lib/nfl/fetchCsv'
import { cityFromName } from '@/lib/standings/common'
import { buildNflStandings } from '@/lib/standings/nfl'
import { atsOutcome, chronological, compareStat, diffTone, finals, moneyline, pctOf, pctTone, recordString, tally, totalOutcome } from './analysis'
import { assembleBetting } from './assemble'
import type { RosterGroup, RosterPlayer, StatLine, SummaryCard, TeamGame, TeamPageData } from './types'

type Row = Record<string, string>

const RELEASES = 'https://github.com/nflverse/nflverse-data/releases/download'
const n = (v: string | undefined) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

/** All of a team's regular-season rows from the nflverse schedule (past results and future games). Revalidates hourly. */
export async function getNFLTeamSchedule(abbr: string, season: number): Promise<Row[] | null> {
  const rows = await getNFLSchedule(season)
  if (!rows) return null
  return rows.filter((r) => r.game_type === 'REG' && (normalizeNflAbbr(r.home_team) === abbr || normalizeNflAbbr(r.away_team) === abbr))
}

interface TeamWeek {
  passYds: number
  rushYds: number
  giveaways: number
  sacks: number
}

/** Per-game, per-team totals from nflverse's team stats file, keyed `${game_id}|${team}`. Revalidates hourly. */
export async function getNFLTeamFullStats(season: number): Promise<Map<string, TeamWeek> | null> {
  const rows = await fetchCsv(`${RELEASES}/stats_team/stats_team_week_${season}.csv`, 3600, `nfl-stats-team-week-${season}`)
  if (!rows || rows.length === 0) return null
  const out = new Map<string, TeamWeek>()
  for (const r of rows) {
    if (r.season_type !== 'REG') continue
    out.set(`${r.game_id}|${normalizeNflAbbr(r.team)}`, {
      passYds: n(r.passing_yards),
      rushYds: n(r.rushing_yards),
      giveaways: n(r.passing_interceptions) + n(r.sack_fumbles_lost) + n(r.rushing_fumbles_lost) + n(r.receiving_fumbles_lost),
      sacks: n(r.def_sacks),
    })
  }
  return out
}

function buildGames(abbr: string, rows: Row[], week: Map<string, TeamWeek> | null): TeamGame[] {
  const out: TeamGame[] = rows.map((r) => {
    const home = normalizeNflAbbr(r.home_team) === abbr
    const opp = normalizeNflAbbr(home ? r.away_team : r.home_team)
    const played = r.home_score !== '' && r.away_score !== ''
    const us = played ? n(home ? r.home_score : r.away_score) : null
    const them = played ? n(home ? r.away_score : r.home_score) : null
    const line = r.spread_line !== '' ? n(r.spread_line) : null // positive = home favored
    const mine = week?.get(`${r.game_id}|${abbr}`)
    const gametime = r.gametime || null
    const hour = gametime ? parseInt(gametime.slice(0, 2), 10) : 0
    const rest = n(home ? r.home_rest : r.away_rest)
    return {
      id: r.game_id,
      date: r.gameday,
      startTime: gametime ? `${r.gameday}T${gametime.length === 5 ? `${gametime}:00` : gametime}` : null,
      oppAbbr: opp,
      home,
      state: played ? 'Final' : 'Upcoming',
      us,
      them,
      result: played && us !== null && them !== null ? (us > them ? 'W' : us < them ? 'L' : 'T') : null,
      tv: null,
      venue: r.stadium || null,
      href: `/games/${r.game_id}`,
      spread: line === null ? null : home ? -line : line,
      total: r.total_line !== '' ? n(r.total_line) : null,
      totalIsProxy: false,
      divisional: r.div_game === '1',
      day: null,
      primetime: r.weekday === 'Thursday' || r.weekday === 'Monday' || hour >= 19,
      oppHand: null,
      extra: r.overtime === '1',
      rest: rest || null,
      f5Total: null,
      firstInningTotal: null,
      keyStat: played && mine ? `Pass ${mine.passYds} · Rush ${mine.rushYds}` : null,
    }
  })
  return chronological(out)
}

// ---------------------------------------------------------------------------
// League stats
// ---------------------------------------------------------------------------

interface TeamAgg {
  abbr: string
  gp: number
  pf: number
  pa: number
  passYds: number
  rushYds: number
  passAllowed: number
  rushAllowed: number
  giveaways: number
  takeaways: number
  sacks: number
}

function leagueAggregates(schedule: Row[], week: Map<string, TeamWeek>): TeamAgg[] {
  const map = new Map<string, TeamAgg>()
  const get = (abbr: string) => {
    let t = map.get(abbr)
    if (!t) {
      t = { abbr, gp: 0, pf: 0, pa: 0, passYds: 0, rushYds: 0, passAllowed: 0, rushAllowed: 0, giveaways: 0, takeaways: 0, sacks: 0 }
      map.set(abbr, t)
    }
    return t
  }
  for (const g of schedule) {
    if (g.game_type !== 'REG' || g.home_score === '' || g.away_score === '') continue
    const home = normalizeNflAbbr(g.home_team)
    const away = normalizeNflAbbr(g.away_team)
    for (const [me, opp, pf, pa] of [
      [home, away, n(g.home_score), n(g.away_score)],
      [away, home, n(g.away_score), n(g.home_score)],
    ] as const) {
      const t = get(me)
      const mine = week.get(`${g.game_id}|${me}`)
      const theirs = week.get(`${g.game_id}|${opp}`)
      t.gp++
      t.pf += pf
      t.pa += pa
      if (mine) {
        t.passYds += mine.passYds
        t.rushYds += mine.rushYds
        t.giveaways += mine.giveaways
        t.sacks += mine.sacks
      }
      if (theirs) {
        t.passAllowed += theirs.passYds
        t.rushAllowed += theirs.rushYds
        t.takeaways += theirs.giveaways
      }
    }
  }
  return Array.from(map.values()).filter((t) => t.gp > 0)
}

const f1 = (x: number) => x.toFixed(1)
const sgn = (x: number) => `${x > 0 ? '+' : ''}${Math.round(x)}`

function nflStats(abbr: string, agg: TeamAgg[]) {
  const per = (fn: (t: TeamAgg) => number) => agg.map((t) => ({ abbr: t.abbr, value: fn(t) }))
  const L = (label: string, fn: (t: TeamAgg) => number, higherBetter: boolean, format: (x: number) => string) => compareStat(label, abbr, per(fn), { higherBetter, format })
  const offense = [
    L('Points / G', (t) => t.pf / t.gp, true, f1),
    L('Pass Yds / G', (t) => t.passYds / t.gp, true, f1),
    L('Rush Yds / G', (t) => t.rushYds / t.gp, true, f1),
    L('Turnover Diff', (t) => t.takeaways - t.giveaways, true, sgn),
    L('Giveaways', (t) => t.giveaways, false, (x) => String(Math.round(x))),
  ].filter((x): x is StatLine => !!x)
  const defense = [
    L('Points Allowed / G', (t) => t.pa / t.gp, false, f1),
    L('Pass Yds Allowed / G', (t) => t.passAllowed / t.gp, false, f1),
    L('Rush Yds Allowed / G', (t) => t.rushAllowed / t.gp, false, f1),
    L('Sacks', (t) => t.sacks, true, (x) => String(Math.round(x))),
    L('Takeaways', (t) => t.takeaways, true, (x) => String(Math.round(x))),
  ].filter((x): x is StatLine => !!x)
  const pick = (list: StatLine[], labels: string[]) => list.filter((s) => labels.includes(s.label))
  return { offense, defense, key: [...pick(offense, ['Points / G', 'Pass Yds / G', 'Rush Yds / G', 'Turnover Diff']), ...pick(defense, ['Points Allowed / G', 'Sacks'])] }
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

/** The team's roster rows (jersey numbers, positions, experience). Revalidates daily. */
export async function getNFLTeamRoster(abbr: string, season: number): Promise<Row[] | null> {
  const rows = await getNFLRosters(season)
  return rows ? rows.filter((r) => normalizeNflAbbr(r.team) === abbr && r.status === 'ACT') : null
}

function passerRating(comp: number, att: number, yds: number, td: number, int: number): number {
  if (att === 0) return 0
  const a = Math.max(0, Math.min(2.375, (comp / att - 0.3) * 5))
  const b = Math.max(0, Math.min(2.375, (yds / att - 3) * 0.25))
  const c = Math.max(0, Math.min(2.375, (td / att) * 20))
  const d = Math.max(0, Math.min(2.375, 2.375 - (int / att) * 25))
  return ((a + b + c + d) / 6) * 100
}

function nflRoster(abbr: string, players: Row[], roster: Row[] | null, weekly: Row[] | null, espnJersey: Map<string, string>): RosterGroup[] {
  const mine = players.filter((p) => normalizeNflAbbr(p.recent_team || p.team) === abbr)
  // ESPN's roster is primary (rows carry ESPN ids); nflverse's jersey numbers fill in for rows that came from its files.
  const jersey = new Map<string, string>([...(roster ?? []).map((r) => [r.gsis_id, r.jersey_number] as [string, string]), ...Array.from(espnJersey.entries())])

  // A player is "hot" when their last two games' fantasy output runs well above their own season pace.
  const hotIds = new Set<string>()
  if (weekly) {
    const byPlayer = new Map<string, Row[]>()
    for (const r of weekly) if (normalizeNflAbbr(r.team || r.recent_team) === abbr) byPlayer.set(r.player_id, [...(byPlayer.get(r.player_id) ?? []), r])
    byPlayer.forEach((games, id) => {
      const sorted = [...games].sort((a, b) => n(a.week) - n(b.week))
      if (sorted.length < 4) return
      const avg = sorted.reduce((s, g) => s + n(g.fantasy_points_ppr), 0) / sorted.length
      const recent = sorted.slice(-2).reduce((s, g) => s + n(g.fantasy_points_ppr), 0) / 2
      if (avg >= 6 && recent >= avg * 1.35) hotIds.add(id)
    })
  }

  const make = (r: Row, position: string, stats: { label: string; value: string }[]): RosterPlayer => ({
    name: r.player_display_name || r.player_name,
    position,
    jersey: jersey.get(r.player_id) ?? null,
    stats,
    hot: hotIds.has(r.player_id),
  })
  const top = (pos: string, key: string, count: number, min = 0) => mine.filter((p) => p.position === pos && n(p[key]) > min).sort((a, b) => n(b[key]) - n(a[key])).slice(0, count)

  const qbs = top('QB', 'attempts', 2, 10).map((r) =>
    make(r, 'QB', [
      { label: 'Pass Yds', value: String(n(r.passing_yards)) },
      { label: 'TD', value: String(n(r.passing_tds)) },
      { label: 'Rating', value: passerRating(n(r.completions), n(r.attempts), n(r.passing_yards), n(r.passing_tds), n(r.interceptions)).toFixed(1) },
    ])
  )
  const rbs = top('RB', 'carries', 2).map((r) =>
    make(r, 'RB', [
      { label: 'Rush Yds', value: String(n(r.rushing_yards)) },
      { label: 'TD', value: String(n(r.rushing_tds)) },
      { label: 'YPC', value: n(r.carries) > 0 ? (n(r.rushing_yards) / n(r.carries)).toFixed(1) : '—' },
    ])
  )
  const receiver = (pos: string) => (r: Row) =>
    make(r, pos, [
      { label: 'Rec', value: String(n(r.receptions)) },
      { label: 'Rec Yds', value: String(n(r.receiving_yards)) },
      { label: 'TD', value: String(n(r.receiving_tds)) },
    ])
  const wrs = top('WR', 'targets', 3).map(receiver('WR'))
  const tes = top('TE', 'targets', 1).map(receiver('TE'))

  // Offensive-line anchor: the most experienced active lineman (the feed has no OL production stats).
  const ol = (roster ?? [])
    .filter((r) => ['T', 'G', 'C', 'OT', 'OG'].includes(r.position))
    .sort((a, b) => n(b.years_exp) - n(a.years_exp))[0]
  const olPlayer: RosterPlayer[] = ol
    ? [{ name: ol.full_name, position: ol.position, jersey: ol.jersey_number || null, hot: false, stats: [{ label: 'Exp', value: `${n(ol.years_exp)}y` }, { label: 'Ht', value: ol.height || '—' }, { label: 'Wt', value: ol.weight || '—' }] }]
    : []

  const defenders = mine
    .filter((p) => n(p.def_tackles_solo) + n(p.def_tackle_assists) + n(p.def_sacks) > 0)
    .sort((a, b) => n(b.def_sacks) * 3 + n(b.def_tackles_solo) + n(b.def_tackle_assists) - (n(a.def_sacks) * 3 + n(a.def_tackles_solo) + n(a.def_tackle_assists)))
    .slice(0, 3)
    .map((r) =>
      make(r, r.position_group || r.position, [
        { label: 'Tkl', value: String(n(r.def_tackles_solo) + n(r.def_tackle_assists)) },
        { label: 'Sack', value: String(n(r.def_sacks)) },
        { label: 'INT', value: String(n(r.def_interceptions)) },
      ])
    )

  const kickers = mine
    .filter((p) => p.position === 'K' && n(p.fg_att) > 0)
    .slice(0, 1)
    .map((r) =>
      make(r, 'K', [
        { label: 'FG', value: `${n(r.fg_made)}/${n(r.fg_att)}` },
        { label: 'FG%', value: n(r.fg_att) > 0 ? `${Math.round((n(r.fg_made) / n(r.fg_att)) * 100)}` : '—' },
        { label: 'Long', value: String(n(r.fg_long)) },
      ])
    )

  return [
    { title: 'Offense', players: [...qbs, ...rbs, ...wrs, ...tes, ...olPlayer] },
    { title: 'Defense', players: defenders },
    { title: 'Special Teams', players: kickers },
  ].filter((g) => g.players.length > 0)
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function ordinal(x: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = x % 100
  return `${x}${s[(v - 20) % 10] || s[v] || s[0]}`
}

export async function getNflTeamPage(abbr: string): Promise<TeamPageData | null> {
  const name = NFL_TEAM_NAMES[abbr]
  if (!name) return null
  const season = await getActiveNFLSeason()
  const statsSeason = (await getNFLStatsSeason(season)) ?? season
  const unavailable: string[] = []

  const [scheduleAll, teamRows, week, players, rosterRows, weekly, espnRoster] = await Promise.all([
    getNFLSchedule(season).catch(() => null),
    getNFLTeamSchedule(abbr, season).catch(() => null),
    getNFLTeamFullStats(statsSeason).catch(() => null),
    getNFLPlayerStats(statsSeason).catch(() => null),
    getNFLTeamRoster(abbr, statsSeason).catch(() => null),
    getNFLWeeklyPlayerStats(statsSeason).catch(() => null),
    getTeamRoster('football', 'nfl', toEspnAbbr('nfl', abbr).toLowerCase()).catch(() => null),
  ])
  const espnJersey = new Map<string, string>((espnRoster?.players ?? []).flatMap((p) => (p.jersey ? [[p.id, p.jersey] as [string, string]] : [])))
  if (!teamRows) unavailable.push('schedule')
  if (!week) unavailable.push('team stats')
  if (!players) unavailable.push('roster')

  const games = teamRows ? buildGames(abbr, teamRows, week) : []
  const played = chronological(finals(games))
  const standing = scheduleAll ? buildNflStandings(scheduleAll).rows.find((r) => r.abbr === abbr) : undefined
  const agg = scheduleAll && week ? leagueAggregates(scheduleAll, week) : []
  const stats = nflStats(abbr, agg)

  const t = tally(played, (g) => (g.us! > g.them! ? 'W' : g.us! < g.them! ? 'L' : 'P'))
  const record = `${t.wins}-${t.losses}${t.pushes > 0 ? `-${t.pushes}` : ''}`
  const pf = played.reduce((s, g) => s + (g.us ?? 0), 0)
  const pa = played.reduce((s, g) => s + (g.them ?? 0), 0)
  const gp = Math.max(played.length, 1)
  const ats = tally(played, atsOutcome)
  const ou = tally(played, (g) => { const o = totalOutcome(g); return o === 'O' ? 'W' : o === 'U' ? 'L' : o === 'P' ? 'P' : null })
  const pd = pf - pa

  const summary: SummaryCard[] = [
    { label: 'W-L Record', value: record, tone: 'neutral', sub: standing ? `${standing.pct} win pct` : undefined },
    { label: 'Point Diff', value: `${pd > 0 ? '+' : ''}${pd}`, tone: diffTone(pd) },
    { label: 'Home Record', value: standing?.home ?? '—', tone: 'neutral' },
    { label: 'Away Record', value: standing?.away ?? '—', tone: 'neutral' },
    { label: 'Points / G', value: (pf / gp).toFixed(1), tone: 'neutral' },
    { label: 'Pts Allowed / G', value: (pa / gp).toFixed(1), tone: 'neutral' },
    { label: 'ATS Record', value: recordString(ats), tone: pctTone(pctOf(ats)), sub: pctOf(ats) !== null ? `${pctOf(ats)}% cover` : undefined },
    { label: 'Over / Under', value: `${ou.wins}-${ou.losses}`, tone: pctTone(pctOf(ou)), sub: pctOf(ou) !== null ? `${pctOf(ou)}% over` : undefined },
  ]

  const division = NFL_TEAM_DIVISIONS[abbr] ?? ''
  const newestFirst = [...played].reverse()

  return {
    sport: 'nfl',
    abbr,
    name,
    city: cityFromName(name),
    color: NFL_TEAM_COLORS[abbr] ?? '#3B9EFF',
    record,
    standing: standing ? `${ordinal(standing.divRank)} ${standing.division}` : division,
    conferenceDivision: `${division.startsWith('AFC') ? 'American Football Conference' : 'National Football Conference'} · ${division}`,
    streak: standing?.streak || null,
    form: newestFirst.slice(0, 10).map((g) => g.result!).filter(Boolean),
    summary,
    games,
    roster: players ? nflRoster(abbr, players, rosterRows, weekly, espnJersey) : [],
    betting: assembleBetting('nfl', games),
    stats: [
      { title: 'Offense', stats: stats.offense, note: '3rd-down % and red-zone % aren’t in the nflverse team feed, so they’re left out rather than estimated.' },
      { title: 'Defense', stats: stats.defense, note: '3rd-down stop % isn’t in the nflverse team feed.' },
    ],
    keyStats: stats.key,
    keyStatLabel: 'Yards',
    avgFor: played.length ? pf / played.length : null,
    avgAgainst: played.length ? pa / played.length : null,
    unavailable,
  }
}

export { moneyline }
