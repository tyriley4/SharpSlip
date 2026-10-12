import { NHL_TEAM_COLORS } from '@/data/nhl/teamColors'
import { getAllNHLGoalieStats, getAllNHLSkaterStats, getAllNHLTeamStats, getNHLBoxScore, getNHLStandings, type NHLTeamStats } from '@/lib/nhl/api'
import { NHL_CURRENT_SEASON, NHL_TEAM_DIVISIONS, NHL_TEAM_NAMES } from '@/lib/nhl/divisions'
import { fetchNhlApiWeb } from '@/lib/nhl/nhlFetch'
import { cityFromName } from '@/lib/standings/common'
import { buildNhlStandings } from '@/lib/standings/nhl'
import { chronological, compareStat, diffTone, finals, lineOutcome, pctOf, pctTone, recordString, tally, totalOutcome } from './analysis'
import { assembleBetting } from './assemble'
import type { RosterGroup, RosterPlayer, StatLine, SummaryCard, TeamGame, TeamPageData } from './types'

interface RawNhlGame {
  id: number
  gameType: number
  gameDate: string
  startTimeUTC: string
  venue?: { default: string }
  gameState: string
  tvBroadcasts?: { market: string; network: string }[]
  awayTeam: { abbrev: string; score?: number }
  homeTeam: { abbrev: string; score?: number }
  gameOutcome?: { lastPeriodType?: string }
}

/** The team's full regular-season schedule with results, start times and TV. Revalidates hourly. */
export async function getNHLTeamSchedule(abbr: string, season = NHL_CURRENT_SEASON): Promise<RawNhlGame[] | null> {
  const data = await fetchNhlApiWeb<{ games: RawNhlGame[] }>(`/club-schedule-season/${abbr}/${season}`, 3600)
  return data ? data.games.filter((g) => g.gameType === 2) : null
}

interface RosterResponse {
  forwards: { id: number; sweaterNumber?: number }[]
  defensemen: { id: number; sweaterNumber?: number }[]
  goalies: { id: number; sweaterNumber?: number }[]
}

/** Jersey numbers for the current roster. Revalidates daily. */
export async function getNHLTeamRoster(abbr: string): Promise<Map<number, string> | null> {
  const data = await fetchNhlApiWeb<RosterResponse>(`/roster/${abbr}/current`, 86400)
  if (!data) return null
  const map = new Map<number, string>()
  for (const p of [...data.forwards, ...data.defensemen, ...data.goalies]) if (p.sweaterNumber !== undefined) map.set(p.id, String(p.sweaterNumber))
  return map
}

/** League-wide team stat table (the team plus every other club, for ranks). Revalidates hourly. */
export async function getNHLTeamFullStats(): Promise<NHLTeamStats[] | null> {
  return getAllNHLTeamStats()
}

function buildGames(abbr: string, raw: RawNhlGame[], divisionOf: Map<string, string>, lgTotal: number): TeamGame[] {
  const myDivision = divisionOf.get(abbr) ?? NHL_TEAM_DIVISIONS[abbr]
  const games: TeamGame[] = raw.map((g) => {
    const home = g.homeTeam.abbrev === abbr
    const opp = home ? g.awayTeam.abbrev : g.homeTeam.abbrev
    const final = g.gameState === 'FINAL' || g.gameState === 'OFF'
    const live = g.gameState === 'LIVE' || g.gameState === 'CRIT'
    const us = final ? (home ? g.homeTeam.score : g.awayTeam.score) ?? 0 : null
    const them = final ? (home ? g.awayTeam.score : g.homeTeam.score) ?? 0 : null
    const lastPeriod = g.gameOutcome?.lastPeriodType
    const extra = final && !!lastPeriod && lastPeriod !== 'REG'
    const tv = g.tvBroadcasts?.find((t) => t.market === 'N')?.network ?? g.tvBroadcasts?.[0]?.network ?? null
    return {
      id: String(g.id),
      date: g.gameDate,
      startTime: g.startTimeUTC,
      oppAbbr: opp,
      home,
      state: g.gameState === 'PPD' ? 'Postponed' : final ? 'Final' : live ? 'Live' : 'Upcoming',
      us,
      them,
      result: final && us !== null && them !== null ? (us > them ? 'W' : extra ? 'OTL' : 'L') : null,
      tv,
      venue: g.venue?.default ?? null,
      href: `/games/${g.id}`,
      spread: null,
      total: final ? lgTotal : null,
      totalIsProxy: true,
      divisional: myDivision ? (divisionOf.get(opp) ?? NHL_TEAM_DIVISIONS[opp]) === myDivision : null,
      day: null,
      primetime: false,
      oppHand: null,
      extra,
      rest: null,
      f5Total: null,
      firstInningTotal: null,
      keyStat: null,
    }
  })
  const ordered = chronological(games)
  ordered.forEach((g, i) => {
    if (i > 0) {
      const prev = new Date(`${ordered[i - 1].date}T12:00:00`).getTime()
      g.rest = Math.max(0, Math.round((new Date(`${g.date}T12:00:00`).getTime() - prev) / 86400000) - 1)
    }
  })
  return ordered
}

async function attachGoalies(abbr: string, games: TeamGame[]) {
  const recent = chronological(finals(games)).slice(-5)
  await Promise.all(
    recent.map(async (g) => {
      const box = await getNHLBoxScore(g.id).catch(() => null)
      const side = box ? (box.home.abbr === abbr ? box.home : box.away) : null
      // The goalie who faced the most shots is the one who carried the game (the starter flag isn't reliable).
      const goalie = [...(side?.goalies ?? [])].sort((a, b) => (b.shotsAgainst ?? 0) - (a.shotsAgainst ?? 0))[0]
      if (goalie) g.keyStat = `${goalie.name} · ${goalie.savePctg !== undefined ? goalie.savePctg.toFixed(3).replace(/^0/, '') : '—'} SV%`
    })
  )
}

const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`
const dec2 = (x: number) => x.toFixed(2)
const dec1 = (x: number) => x.toFixed(1)

function nhlStats(abbr: string, teams: NHLTeamStats[]) {
  const per = (fn: (t: NHLTeamStats) => number) => teams.filter((t) => t.gamesPlayed > 0).map((t) => ({ abbr: t.abbr, value: fn(t) }))
  const L = (label: string, fn: (t: NHLTeamStats) => number, higherBetter: boolean, format: (x: number) => string) => compareStat(label, abbr, per(fn), { higherBetter, format })
  const offense = [
    L('Goals / G', (t) => t.goalsForPerGame, true, dec2),
    L('Shooting %', (t) => (t.shotsForPerGame > 0 ? t.goalsForPerGame / t.shotsForPerGame : 0), true, pct1),
    L('Power Play %', (t) => t.powerPlayPct, true, pct1),
    L('Shots / G', (t) => t.shotsForPerGame, true, dec1),
  ].filter((x): x is StatLine => !!x)
  const defense = [
    L('Goals Against / G', (t) => t.goalsAgainstPerGame, false, dec2),
    L('Save %', (t) => (t.shotsAgainstPerGame > 0 ? 1 - t.goalsAgainstPerGame / t.shotsAgainstPerGame : 0), true, (x) => x.toFixed(3).replace(/^0/, '')),
    L('Penalty Kill %', (t) => t.penaltyKillPct, true, pct1),
    L('Shots Against / G', (t) => t.shotsAgainstPerGame, false, dec1),
  ].filter((x): x is StatLine => !!x)
  const lgTotalRaw = teams.filter((t) => t.gamesPlayed > 0).reduce((s, t) => s + t.goalsForPerGame + t.goalsAgainstPerGame, 0) / Math.max(teams.filter((t) => t.gamesPlayed > 0).length, 1)
  const pick = (list: StatLine[], labels: string[]) => list.filter((s) => labels.includes(s.label))
  return { offense, defense, lgTotal: Math.round((lgTotalRaw || 6.1) * 2) / 2, key: [...pick(offense, ['Goals / G', 'Power Play %', 'Shots / G']), ...pick(defense, ['Goals Against / G', 'Save %', 'Penalty Kill %'])] }
}

function ordinal(x: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = x % 100
  return `${x}${s[(v - 20) % 10] || s[v] || s[0]}`
}

export async function getNhlTeamPage(abbr: string): Promise<TeamPageData | null> {
  const name = NHL_TEAM_NAMES[abbr]
  if (!name) return null
  const unavailable: string[] = []

  const [standingsRaw, teamStats, rawGames, jerseys, skaters, goalies] = await Promise.all([
    getNHLStandings().catch(() => null),
    getNHLTeamFullStats().catch(() => null),
    getNHLTeamSchedule(abbr).catch(() => null),
    getNHLTeamRoster(abbr).catch(() => null),
    getAllNHLSkaterStats().catch(() => null),
    getAllNHLGoalieStats().catch(() => null),
  ])
  if (!standingsRaw) unavailable.push('standings')
  if (!teamStats) unavailable.push('team stats')
  if (!rawGames) unavailable.push('schedule')
  if (!skaters || !goalies) unavailable.push('roster')

  const standings = standingsRaw ? buildNhlStandings(standingsRaw).rows : []
  const standing = standings.find((r) => r.abbr === abbr)
  const divisionOf = new Map(standings.map((r) => [r.abbr, r.division]))
  const stats = teamStats ? nhlStats(abbr, teamStats) : { offense: [], defense: [], key: [], lgTotal: 6 }

  const games = rawGames ? buildGames(abbr, rawGames, divisionOf, stats.lgTotal) : []
  await attachGoalies(abbr, games).catch(() => undefined)
  const played = chronological(finals(games))
  const newestFirst = [...played].reverse()

  const wins = played.filter((g) => g.result === 'W').length
  const otl = played.filter((g) => g.result === 'OTL').length
  const losses = played.filter((g) => g.result === 'L').length
  const record = standing ? `${standing.w}-${standing.l}-${standing.t}` : `${wins}-${losses}-${otl}`
  const gf = played.reduce((s, g) => s + (g.us ?? 0), 0)
  const ga = played.reduce((s, g) => s + (g.them ?? 0), 0)
  const gp = Math.max(played.length, 1)
  const pl = tally(played, (g) => lineOutcome(g, -1.5))
  const ou = tally(played, (g) => { const o = totalOutcome(g); return o === 'O' ? 'W' : o === 'U' ? 'L' : o === 'P' ? 'P' : null })

  const summary: SummaryCard[] = [
    { label: 'W-L-OTL', value: record, tone: 'neutral', sub: standing ? `${standing.pts ?? 0} pts` : undefined },
    { label: 'Goal Diff', value: `${gf - ga > 0 ? '+' : ''}${gf - ga}`, tone: diffTone(gf - ga) },
    { label: 'Home Record', value: standing?.home ?? '—', tone: 'neutral' },
    { label: 'Away Record', value: standing?.away ?? '—', tone: 'neutral' },
    { label: 'Goals / G', value: (gf / gp).toFixed(2), tone: 'neutral' },
    { label: 'GA / G', value: (ga / gp).toFixed(2), tone: 'neutral' },
    { label: 'Puck Line −1.5', value: recordString(pl), tone: pctTone(pctOf(pl)), sub: pctOf(pl) !== null ? `${pctOf(pl)}% cover` : undefined },
    { label: 'Over / Under', value: `${ou.wins}-${ou.losses}`, tone: 'neutral', sub: `vs lg avg ${stats.lgTotal}` },
  ]

  // Roster: top six forwards... two lines (8 forwards), top two D pairs (4) and the starting goalie.
  const mine = (skaters ?? []).filter((p) => p.teamAbbr === abbr)
  const skater = (p: (typeof mine)[number]): RosterPlayer => ({
    name: p.name,
    position: p.position,
    jersey: jerseys?.get(p.playerId) ?? null,
    stats: [
      { label: 'G', value: String(p.goals) },
      { label: 'A', value: String(p.assists) },
      { label: 'PTS', value: String(p.points) },
    ],
    hot: false,
  })
  const forwards = mine.filter((p) => ['C', 'L', 'R', 'LW', 'RW'].includes(p.position)).sort((a, b) => b.avgToiSeconds - a.avgToiSeconds || b.points - a.points).slice(0, 8)
  const defense = mine.filter((p) => p.position === 'D').sort((a, b) => b.avgToiSeconds - a.avgToiSeconds || b.points - a.points).slice(0, 4)
  const goalie = (goalies ?? []).filter((g) => g.teamAbbr === abbr).sort((a, b) => b.gamesStarted - a.gamesStarted)[0]
  const roster: RosterGroup[] = [
    { title: 'Forwards', players: forwards.map(skater) },
    { title: 'Defense', players: defense.map(skater) },
    {
      title: 'Goalie',
      players: goalie
        ? [
            {
              name: goalie.name,
              position: 'G',
              jersey: jerseys?.get(goalie.playerId) ?? null,
              hot: false,
              stats: [
                { label: 'SV%', value: goalie.savePct.toFixed(3).replace(/^0/, '') },
                { label: 'GAA', value: goalie.goalsAgainstAvg.toFixed(2) },
                { label: 'W', value: String(goalie.wins) },
              ],
            },
          ]
        : [],
    },
  ].filter((g) => g.players.length > 0)

  return {
    sport: 'nhl',
    abbr,
    name,
    city: cityFromName(name),
    color: NHL_TEAM_COLORS[abbr] ?? '#3B9EFF',
    record,
    standing: standing ? `${ordinal(standing.divRank)} ${standing.division}` : (NHL_TEAM_DIVISIONS[abbr] ?? '—'),
    conferenceDivision: `${standing?.conference === 'East' || ['Atlantic', 'Metropolitan'].includes(NHL_TEAM_DIVISIONS[abbr]) ? 'Eastern' : 'Western'} Conference · ${NHL_TEAM_DIVISIONS[abbr] ?? ''}`,
    streak: standing?.streak || null,
    form: newestFirst.slice(0, 10).map((g) => g.result!).filter(Boolean),
    summary,
    games,
    roster,
    betting: assembleBetting('nhl', games),
    stats: [
      { title: 'Offense', stats: stats.offense },
      { title: 'Defense', stats: stats.defense },
    ],
    keyStats: stats.key,
    keyStatLabel: 'Goalie',
    avgFor: played.length ? gf / played.length : null,
    avgAgainst: played.length ? ga / played.length : null,
    unavailable,
  }
}
