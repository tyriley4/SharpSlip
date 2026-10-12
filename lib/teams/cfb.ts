import { aggregate, type Agg } from '@/lib/college/cfbLeaders'
import { findCollegeTeam, getCollegeDirectory, type CollegeTeam } from '@/lib/college/directory'
import { getCollegeStandings } from '@/lib/college/standings'
import { getCfbTeamSeason, type CfbTeamSeason } from '@/lib/cfb/engine'
import { getRankings, getTeamRoster, getTeamSchedule, type RosterEntry, type ScheduleGame } from '@/lib/espn/api'
import { getLeagueData } from '@/lib/football/league'
import { atsOutcome, chronological, compareStat, diffTone, finals, pctOf, pctTone, recordString, tally, totalOutcome } from './analysis'
import { assembleBetting } from './assemble'
import type { RosterGroup, RosterPlayer, StatLine, SummaryCard, TeamGame, TeamPageData } from './types'

const LEAGUE = 'college-football' as const
const f1 = (x: number) => x.toFixed(1)
const sgn = (x: number) => `${x > 0 ? '+' : ''}${Math.round(x)}`

function ordinal(x: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = x % 100
  return `${x}${s[(v - 20) % 10] || s[v] || s[0]}`
}

function easternHour(iso: string): number {
  const h = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' }).format(new Date(iso))
  return Number(h) % 24
}

function buildGames(team: CollegeTeam, schedule: ScheduleGame[], season: CfbTeamSeason): TeamGame[] {
  const boxById = new Map(season.boxes.map((b) => [b.eventId, b]))
  const out: TeamGame[] = []
  let prevDate: number | null = null
  for (const g of [...schedule].sort((a, b) => a.date.localeCompare(b.date))) {
    const box = boxById.get(g.id)
    const played = g.state === 'post' && g.us !== null && g.them !== null
    const state = played ? 'Final' : g.state === 'in' ? 'Live' : 'Upcoming'
    const t = Date.parse(g.date)
    const rest = prevDate !== null ? Math.max(0, Math.round((t - prevDate) / 86400000) - 1) : null
    prevDate = t
    const line = box?.line
    const spread = line && line.homeSpread !== null ? (g.home ? line.homeSpread : -line.homeSpread) : null
    const passYds = box ? Number(box.team.netPassingYards ?? 0) : null
    const rushYds = box ? Number(box.team.rushingYards ?? 0) : null
    out.push({
      id: g.id,
      date: g.date.slice(0, 10),
      startTime: g.date,
      oppAbbr: g.opponent.abbr,
      home: g.home,
      state,
      us: played ? g.us : null,
      them: played ? g.them : null,
      result: played ? g.result : null,
      tv: g.network,
      venue: g.venue,
      href: `/games/cfb/${g.id}`,
      spread,
      total: line?.total ?? null,
      totalIsProxy: false,
      divisional: g.conferenceGame || (box?.conferenceGame ?? false),
      day: null,
      primetime: easternHour(g.date) >= 19,
      oppHand: null,
      extra: false,
      rest,
      f5Total: null,
      firstInningTotal: null,
      keyStat: played && passYds !== null && rushYds !== null ? `Pass ${passYds} · Rush ${rushYds}` : null,
    })
  }
  return chronological(out)
}

/** League-wide per-game team figures from the same box-score store the leaders use. */
function leagueTeams() {
  const data = getLeagueData(LEAGUE)
  const t = new Map<string, { abbr: string; g: number; pf: number; pa: number; py: number; ry: number; pyA: number; ryA: number; give: number; take: number }>()
  for (const g of data.games) {
    for (const [mine, theirs] of [[g.home, g.away], [g.away, g.home]] as const) {
      const c = t.get(mine.teamId) ?? { abbr: mine.abbr, g: 0, pf: 0, pa: 0, py: 0, ry: 0, pyA: 0, ryA: 0, give: 0, take: 0 }
      c.g++
      c.pf += mine.score
      c.pa += theirs.score
      c.py += Number(mine.stats.netPassingYards ?? 0) || 0
      c.ry += Number(mine.stats.rushingYards ?? 0) || 0
      c.pyA += Number(theirs.stats.netPassingYards ?? 0) || 0
      c.ryA += Number(theirs.stats.rushingYards ?? 0) || 0
      c.give += Number(mine.stats.turnovers ?? 0) || 0
      c.take += Number(theirs.stats.turnovers ?? 0) || 0
      t.set(mine.teamId, c)
    }
  }
  return Array.from(t.entries()).filter(([, c]) => c.g >= 2)
}

function rosterGroups(teamId: string, roster: RosterEntry[], aggs: Agg[]): RosterGroup[] {
  const info = new Map(roster.map((r) => [r.id, r]))
  const mine = aggs.filter((a) => a.teamId === teamId)
  const posOf = (a: Agg) => info.get(a.id)?.position ?? ''
  const make = (a: Agg, position: string, stats: { label: string; value: string }[]): RosterPlayer => ({ name: a.name, position, jersey: info.get(a.id)?.jersey ?? null, stats, hot: false })
  const top = (pred: (a: Agg) => boolean, key: (a: Agg) => number, count: number) => mine.filter(pred).sort((x, y) => key(y) - key(x)).slice(0, count)

  const qbs = top((a) => a.att >= 10 && (posOf(a) === 'QB' || !posOf(a)), (a) => a.pyds, 2).map((a) =>
    make(a, 'QB', [
      { label: 'Pass Yds', value: String(a.pyds) },
      { label: 'TD', value: String(a.ptd) },
      { label: 'Comp%', value: a.att > 0 ? `${Math.round((a.comp / a.att) * 100)}` : '—' },
    ])
  )
  const rbs = top((a) => a.car >= 10 && posOf(a) !== 'QB', (a) => a.ryds, 2).map((a) =>
    make(a, posOf(a) || 'RB', [
      { label: 'Rush Yds', value: String(a.ryds) },
      { label: 'TD', value: String(a.rtd) },
      { label: 'YPC', value: a.car > 0 ? (a.ryds / a.car).toFixed(1) : '—' },
    ])
  )
  const recv = (pos: string[]) => (a: Agg) => a.rec >= 3 && pos.includes(posOf(a))
  const recStats = (a: Agg) => [
    { label: 'Rec', value: String(a.rec) },
    { label: 'Rec Yds', value: String(a.recyds) },
    { label: 'TD', value: String(a.rectd) },
  ]
  const wrs = top(recv(['WR']), (a) => a.recyds, 3).map((a) => make(a, 'WR', recStats(a)))
  const tes = top(recv(['TE']), (a) => a.recyds, 1).map((a) => make(a, 'TE', recStats(a)))
  const defense = top((a) => a.tot + a.sacks + a.tfl > 0 && a.car + a.rec + a.att === 0, (a) => a.tot + a.sacks * 3, 4).map((a) =>
    make(a, posOf(a) || 'DEF', [
      { label: 'Tkl', value: String(a.tot) },
      { label: 'Sack', value: String(a.sacks) },
      { label: 'TFL', value: String(a.tfl) },
    ])
  )
  return [
    { title: 'Offense', players: [...qbs, ...rbs, ...wrs, ...tes] },
    { title: 'Defense', players: defense },
  ].filter((g) => g.players.length > 0)
}

export async function getCfbTeamPage(abbr: string): Promise<TeamPageData | null> {
  const team = await findCollegeTeam('cfb', abbr)
  if (!team) return null
  const unavailable: string[] = []

  const [schedule, season, standings, rankings, roster, dir] = await Promise.all([
    getTeamSchedule('football', LEAGUE, team.id).catch(() => null),
    getCfbTeamSeason(team.id, team.abbr).catch(() => null),
    getCollegeStandings('cfb').catch(() => null),
    getRankings('football', LEAGUE).catch(() => null),
    getTeamRoster('football', LEAGUE, team.id).catch(() => null),
    getCollegeDirectory('cfb').catch(() => null),
  ])
  if (!schedule) unavailable.push('schedule')
  if (!season) unavailable.push('team stats')
  if (!roster) unavailable.push('roster')

  const games = schedule && season ? buildGames(team, schedule, season) : []
  const played = chronological(finals(games))

  // Conference standing.
  let confRank: string | null = null
  let confRec = '—'
  let confOverall = ''
  for (const c of standings?.conferences ?? []) {
    for (const grp of c.groups) {
      const row = grp.rows.find((r) => r.teamId === team.id)
      if (row) {
        confRank = `${ordinal(row.rank)} in ${c.abbr}${grp.title ? ` ${grp.title}` : ''}`
        confRec = `${row.confW}-${row.confL}`
        confOverall = `${row.w}-${row.l}`
      }
    }
  }

  // Current poll position: AP first, then Coaches / CFP.
  let rank: TeamPageData['rank'] = null
  for (const key of [/College Football Playoff|CFP/i, /AP Top 25/i, /Coaches/i]) {
    const poll = rankings?.find((p) => key.test(p.name))
    const hit = poll?.ranks.find((r) => r.teamId === team.id)
    if (hit) {
      rank = { value: hit.rank, poll: /AP/i.test(poll!.name) ? 'AP' : /Coaches/i.test(poll!.name) ? 'Coaches' : 'CFP' }
      break
    }
  }

  const t = tally(played, (g) => (g.us! > g.them! ? 'W' : g.us! < g.them! ? 'L' : 'P'))
  const record = confOverall || `${t.wins}-${t.losses}${t.pushes > 0 ? `-${t.pushes}` : ''}`
  const pf = played.reduce((s, g) => s + (g.us ?? 0), 0)
  const pa = played.reduce((s, g) => s + (g.them ?? 0), 0)
  const gp = Math.max(played.length, 1)
  const ats = tally(played, atsOutcome)
  const ou = tally(played, (g) => {
    const o = totalOutcome(g)
    return o === 'O' ? 'W' : o === 'U' ? 'L' : o === 'P' ? 'P' : null
  })
  const pd = pf - pa
  const home = season ? `${season.boxes.filter((b) => b.home && b.result === 'W').length}-${season.boxes.filter((b) => b.home && b.result === 'L').length}` : '—'
  const away = season ? `${season.boxes.filter((b) => !b.home && b.result === 'W').length}-${season.boxes.filter((b) => !b.home && b.result === 'L').length}` : '—'

  const summary: SummaryCard[] = [
    { label: 'W-L Record', value: record, tone: 'neutral', sub: `Home ${home} · Away ${away}` },
    { label: 'Conference', value: confRec, tone: 'neutral', sub: confRank ?? team.conferenceAbbr },
    { label: 'Point Diff', value: `${pd > 0 ? '+' : ''}${pd}`, tone: diffTone(pd) },
    { label: 'National Rank', value: rank ? `#${rank.value}` : 'Unranked', tone: rank ? 'good' : 'neutral', sub: rank ? `${rank.poll} poll` : undefined },
    { label: 'Points / G', value: f1(pf / gp), tone: 'neutral' },
    { label: 'Pts Allowed / G', value: f1(pa / gp), tone: 'neutral' },
    { label: 'ATS Record', value: recordString(ats), tone: pctTone(pctOf(ats)), sub: pctOf(ats) !== null ? `${pctOf(ats)}% cover` : 'No closing lines yet' },
    { label: 'Over / Under', value: `${ou.wins}-${ou.losses}`, tone: pctTone(pctOf(ou)), sub: pctOf(ou) !== null ? `${pctOf(ou)}% over` : undefined },
  ]

  // Stats vs every FBS team that has played.
  const league = leagueTeams().filter(([id]) => dir?.byId.has(id) ?? true)
  const per = (fn: (c: (typeof league)[number][1]) => number) => league.map(([, c]) => ({ abbr: c.abbr, value: fn(c) }))
  const myAbbr = league.find(([id]) => id === team.id)?.[1].abbr ?? team.abbr
  const L = (label: string, fn: (c: (typeof league)[number][1]) => number, higherBetter: boolean, format: (x: number) => string) => compareStat(label, myAbbr, per(fn), { higherBetter, format })
  const offense = [
    L('Points / G', (c) => c.pf / c.g, true, f1),
    L('Pass Yds / G', (c) => c.py / c.g, true, f1),
    L('Rush Yds / G', (c) => c.ry / c.g, true, f1),
    L('Turnover Diff', (c) => c.take - c.give, true, sgn),
    L('Giveaways', (c) => c.give, false, (x) => String(Math.round(x))),
  ].filter((x): x is StatLine => !!x)
  const defense = [
    L('Points Allowed / G', (c) => c.pa / c.g, false, f1),
    L('Pass Yds Allowed / G', (c) => c.pyA / c.g, false, f1),
    L('Rush Yds Allowed / G', (c) => c.ryA / c.g, false, f1),
    L('Takeaways', (c) => c.take, true, (x) => String(Math.round(x))),
  ].filter((x): x is StatLine => !!x)
  const pick = (list: StatLine[], labels: string[]) => list.filter((s) => labels.includes(s.label))

  const rows = getLeagueData(LEAGUE).rows
  const aggs = Array.from(aggregate(rows.filter((r) => r.teamId === team.id)).values())

  const newestFirst = [...played].reverse()
  const rankHistory = (season?.boxes ?? []).map((b) => ({ label: b.week ? `Wk ${b.week}` : b.date.slice(5, 10), rank: b.ourRank }))

  return {
    sport: 'cfb',
    abbr: team.abbr,
    name: team.name,
    city: team.location,
    color: team.color,
    record,
    standing: confRank ?? team.conferenceAbbr,
    conferenceDivision: `${team.conference}${team.division ? ` · ${team.division}` : ''}`,
    streak: season && season.winStreak > 0 ? `W${season.winStreak}` : null,
    form: newestFirst.slice(0, 10).map((g) => g.result!).filter(Boolean),
    summary,
    games,
    roster: roster ? rosterGroups(team.id, roster.players, aggs) : [],
    betting: assembleBetting('cfb', games),
    stats: [
      { title: 'Offense', stats: offense, note: '3rd-down % and red-zone % aren’t in ESPN’s college box scores, so they’re left out rather than estimated.' },
      { title: 'Defense', stats: defense },
    ],
    keyStats: [...pick(offense, ['Points / G', 'Pass Yds / G', 'Rush Yds / G', 'Turnover Diff']), ...pick(defense, ['Points Allowed / G'])],
    keyStatLabel: 'Yards',
    avgFor: played.length ? pf / played.length : null,
    avgAgainst: played.length ? pa / played.length : null,
    rank,
    rankHistory: rankHistory.some((r) => r.rank !== null) ? rankHistory : [],
    notes: ['Recruiting class rankings aren’t available from ESPN’s public data, so they aren’t shown.'],
    unavailable,
  }
}
