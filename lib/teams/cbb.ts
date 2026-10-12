import { CBB_LEAGUE } from '@/lib/cbb/box'
import { getCbbTeamSeason, seasonLabel, type CbbTeamSeason } from '@/lib/cbb/engine'
import { getCbbSeasonInfo } from '@/lib/college/cbbLeaders'
import { findCollegeTeam, getCollegeDirectory } from '@/lib/college/directory'
import { getCollegeStandings } from '@/lib/college/standings'
import { getAllTeamStats, getRankings, getTeamRoster, getTeamSchedule, type RosterEntry, type ScheduleGame } from '@/lib/espn/api'
import { atsOutcome, chronological, compareStat, diffTone, finals, pctOf, pctTone, recordString, tally, totalOutcome } from './analysis'
import { assembleBetting } from './assemble'
import type { RosterGroup, RosterPlayer, StatLine, SummaryCard, TeamGame, TeamPageData } from './types'

const f1 = (x: number) => x.toFixed(1)

function ordinal(x: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = x % 100
  return `${x}${s[(v - 20) % 10] || s[v] || s[0]}`
}

function easternHour(iso: string): number {
  const h = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' }).format(new Date(iso))
  return Number(h) % 24
}

function buildGames(schedule: ScheduleGame[], season: CbbTeamSeason): TeamGame[] {
  const boxById = new Map(season.boxes.map((b) => [b.eventId, b]))
  const out: TeamGame[] = []
  let prev: number | null = null
  for (const g of [...schedule].sort((a, b) => a.date.localeCompare(b.date))) {
    const box = boxById.get(g.id)
    const played = g.state === 'post' && g.us !== null && g.them !== null
    const t = Date.parse(g.date)
    const rest = prev !== null ? Math.max(0, Math.round((t - prev) / 86400000) - 1) : null
    prev = t
    const line = box?.line
    out.push({
      id: g.id,
      date: g.date.slice(0, 10),
      startTime: g.date,
      oppAbbr: g.opponent.abbr,
      home: g.home,
      state: played ? 'Final' : g.state === 'in' ? 'Live' : 'Upcoming',
      us: played ? g.us : null,
      them: played ? g.them : null,
      result: played ? (g.result === 'T' ? null : g.result) : null,
      tv: g.network,
      venue: g.venue,
      href: `/games/cbb/${g.id}`,
      spread: line && line.homeSpread !== null ? (g.home ? line.homeSpread : -line.homeSpread) : null,
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
      keyStat: played && box ? `FG ${box.team.fgm}-${box.team.fga} · 3P ${box.team.tpm}-${box.team.tpa}` : null,
    })
  }
  return chronological(out)
}

function rosterGroups(roster: RosterEntry[], s: CbbTeamSeason): RosterGroup[] {
  const info = new Map(roster.map((r) => [r.id, r]))
  const players: RosterPlayer[] = s.players.slice(0, 9).map((p) => ({
    name: p.name,
    position: info.get(p.id)?.position ?? '',
    jersey: info.get(p.id)?.jersey ?? null,
    hot: p.hot,
    stats: [
      { label: 'PPG', value: p.ppg.toFixed(1) },
      { label: 'RPG', value: p.rpg.toFixed(1) },
      { label: 'APG', value: p.apg.toFixed(1) },
    ],
  }))
  const starters = players.slice(0, 5)
  const bench = players.slice(5)
  return [
    { title: 'Top Rotation', players: starters },
    { title: 'Bench Contributors', players: bench },
  ].filter((g) => g.players.length > 0)
}

export async function getCbbTeamPage(abbr: string): Promise<TeamPageData | null> {
  const team = await findCollegeTeam('cbb', abbr)
  if (!team) return null
  const unavailable: string[] = []
  const info = await getCbbSeasonInfo()

  const [schedule, season, standings, rankings, roster, allTeams, dir] = await Promise.all([
    getTeamSchedule('basketball', CBB_LEAGUE, team.id, info.season).catch(() => null),
    getCbbTeamSeason(team.id, team.abbr, info.season).catch(() => null),
    getCollegeStandings('cbb').catch(() => null),
    getRankings('basketball', CBB_LEAGUE).catch(() => null),
    getTeamRoster('basketball', CBB_LEAGUE, team.id).catch(() => null),
    getAllTeamStats('basketball', CBB_LEAGUE, info.season).catch(() => null),
    getCollegeDirectory('cbb').catch(() => null),
  ])
  if (!schedule) unavailable.push('schedule')
  if (!season) unavailable.push('team stats')
  if (!roster) unavailable.push('roster')

  // A team that hasn't played yet this season shows last season, clearly labelled.
  const useSeason = season ?? null
  const games = schedule && useSeason ? buildGames(schedule, useSeason) : []
  const played = chronological(finals(games))

  let confRank: string | null = null
  let confRec = '—'
  let overall = ''
  for (const c of standings?.conferences ?? []) {
    for (const grp of c.groups) {
      const row = grp.rows.find((r) => r.teamId === team.id)
      if (row) {
        confRank = `${ordinal(row.rank)} in ${c.abbr}`
        confRec = `${row.confW}-${row.confL}`
        overall = `${row.w}-${row.l}`
      }
    }
  }

  let rank: TeamPageData['rank'] = null
  const ap = rankings?.find((p) => /AP Top 25/i.test(p.name))
  const hit = ap?.ranks.find((r) => r.teamId === team.id)
  if (hit) rank = { value: hit.rank, poll: 'AP' }
  else {
    const co = rankings?.find((p) => /Coaches/i.test(p.name))?.ranks.find((r) => r.teamId === team.id)
    if (co) rank = { value: co.rank, poll: 'Coaches' }
  }

  const sourceSeason = useSeason?.season ?? info.season
  const prior = !!useSeason?.priorSeason || (info.lastSeason && sourceSeason === info.season)
  const notes: string[] = []
  if (info.lastSeason || prior) notes.push(`Showing the ${seasonLabel(info.season)} season — the new college basketball season hasn’t started. Everything updates automatically once games are played.`)
  notes.push('Recruiting class rankings aren’t available from ESPN’s public data, so they aren’t shown.')

  const t = tally(played, (g) => (g.us! > g.them! ? 'W' : g.us! < g.them! ? 'L' : 'P'))
  const record = overall || `${t.wins}-${t.losses}`
  const pf = played.reduce((s, g) => s + (g.us ?? 0), 0)
  const pa = played.reduce((s, g) => s + (g.them ?? 0), 0)
  const gp = Math.max(played.length, 1)
  const ats = tally(played, atsOutcome)
  const ou = tally(played, (g) => {
    const o = totalOutcome(g)
    return o === 'O' ? 'W' : o === 'U' ? 'L' : o === 'P' ? 'P' : null
  })
  const pd = pf - pa
  const home = useSeason ? `${useSeason.boxes.filter((b) => b.home && b.result === 'W').length}-${useSeason.boxes.filter((b) => b.home && b.result === 'L').length}` : '—'
  const away = useSeason ? `${useSeason.boxes.filter((b) => !b.home && b.result === 'W').length}-${useSeason.boxes.filter((b) => !b.home && b.result === 'L').length}` : '—'

  const summary: SummaryCard[] = [
    { label: 'W-L Record', value: record, tone: 'neutral', sub: `Home ${home} · Away ${away}` },
    { label: 'Conference', value: confRec, tone: 'neutral', sub: confRank ?? team.conferenceAbbr },
    { label: 'Point Diff', value: `${pd > 0 ? '+' : ''}${pd}`, tone: diffTone(pd), sub: `${(pd / gp > 0 ? '+' : '') + (pd / gp).toFixed(1)} per game` },
    { label: 'National Rank', value: rank ? `#${rank.value}` : 'Unranked', tone: rank ? 'good' : 'neutral', sub: rank ? `${rank.poll} poll` : undefined },
    { label: 'Points / G', value: f1(pf / gp), tone: 'neutral' },
    { label: 'Pts Allowed / G', value: f1(pa / gp), tone: 'neutral' },
    { label: 'ATS Record', value: recordString(ats), tone: pctTone(pctOf(ats)), sub: pctOf(ats) !== null ? `${pctOf(ats)}% cover` : 'No closing lines' },
    { label: 'Over / Under', value: `${ou.wins}-${ou.losses}`, tone: pctTone(pctOf(ou)), sub: pctOf(ou) !== null ? `${pctOf(ou)}% over` : undefined },
  ]

  // League comparison from ESPN's season team stats (D-I teams with at least 8 games).
  const league = (allTeams ?? []).filter((x) => (dir?.byId.has(x.teamId) ?? true) && (x.own.gamesPlayed ?? 0) >= 8)
  const pick = (fn: (o: Record<string, number>) => number | undefined) => league.flatMap((x) => (fn(x.own) === undefined ? [] : [{ abbr: x.teamId, value: fn(x.own) as number }]))
  const mine = team.id
  const L = (label: string, fn: (o: Record<string, number>) => number | undefined, higherBetter: boolean, format: (x: number) => string = f1) => compareStat(label, mine, pick(fn), { higherBetter, format })
  const pct = (x: number) => `${x.toFixed(1)}%`
  const offense = [
    L('Points / G', (o) => o.avgPoints, true),
    L('FG %', (o) => o.fieldGoalPct, true, pct),
    L('3P %', (o) => o.threePointFieldGoalPct, true, pct),
    L('FT %', (o) => o.freeThrowPct, true, pct),
    L('Assists / G', (o) => o.avgAssists, true),
    L('Turnovers / G', (o) => o.avgTurnovers, false),
  ].filter((x): x is StatLine => !!x)
  const defense = [
    L('Points Allowed / G', (o) => (o.avgPoints !== undefined && o.avgPointsDifferential !== undefined ? o.avgPoints - o.avgPointsDifferential : undefined), false),
    L('Rebounds / G', (o) => o.avgRebounds, true),
    L('Steals / G', (o) => o.avgSteals, true),
    L('Blocks / G', (o) => o.avgBlocks, true),
  ].filter((x): x is StatLine => !!x)
  const keyPick = (list: StatLine[], labels: string[]) => list.filter((s) => labels.includes(s.label))

  const newestFirst = [...played].reverse()
  const rankHistory = (useSeason?.boxes ?? []).filter((b) => b.ourRank !== null).slice(-12).map((b) => ({ label: b.date.slice(5, 10), rank: b.ourRank }))

  return {
    sport: 'cbb',
    abbr: team.abbr,
    name: team.name,
    city: team.location,
    color: team.color,
    record,
    standing: confRank ?? team.conferenceAbbr,
    conferenceDivision: team.conference,
    streak: useSeason && useSeason.winStreak > 0 ? `W${useSeason.winStreak}` : null,
    form: newestFirst.slice(0, 10).map((g) => g.result!).filter(Boolean),
    summary,
    games,
    roster: roster && useSeason ? rosterGroups(roster.players, useSeason) : [],
    betting: assembleBetting('cbb', games),
    stats: [
      { title: 'Offense', stats: offense },
      { title: 'Defense', stats: defense },
    ],
    keyStats: [...keyPick(offense, ['Points / G', 'FG %', '3P %']), ...keyPick(defense, ['Points Allowed / G'])],
    keyStatLabel: 'Shooting',
    avgFor: played.length ? pf / played.length : null,
    avgAgainst: played.length ? pa / played.length : null,
    rank,
    rankHistory,
    notes,
    unavailable,
  }
}
