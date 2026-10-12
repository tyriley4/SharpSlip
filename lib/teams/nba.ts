import { NBA_TEAM_COLORS } from '@/data/nba/teamColors'
import { getAllNBAPlayerSeasonStats, getAllNBATeamStats, getNBABoxScore, getNBAStandings, getNBATeamGameLog, type NBATeamGameLogRow, type NBATeamStats } from '@/lib/nba/api'
import { NBA_TEAM_DIVISIONS, NBA_TEAM_IDS, NBA_TEAM_NAMES } from '@/lib/nba/divisions'
import { cityFromName } from '@/lib/standings/common'
import { buildNbaStandings } from '@/lib/standings/nba'
import { chronological, compareStat, diffTone, finals, pctOf, pctTone, recordString, tally, totalOutcome } from './analysis'
import { assembleBetting } from './assemble'
import type { RosterGroup, RosterPlayer, StatLine, SummaryCard, TeamGame, TeamPageData } from './types'

/** The team's completed regular-season games (stats.nba.com game log). Revalidates daily. */
export async function getNBATeamSchedule(abbr: string): Promise<NBATeamGameLogRow[] | null> {
  const teamId = NBA_TEAM_IDS[abbr]
  return teamId ? getNBATeamGameLog(teamId) : null
}

/** League-wide team stat table, for ranks. Revalidates hourly. */
export async function getNBATeamFullStats(): Promise<NBATeamStats[] | null> {
  return getAllNBATeamStats()
}

function buildGames(abbr: string, log: NBATeamGameLogRow[], lgTotal: number): TeamGame[] {
  const myDivision = NBA_TEAM_DIVISIONS[abbr]
  const games: TeamGame[] = log.map((g) => ({
    id: g.gameId,
    date: g.gameDate.slice(0, 10),
    startTime: null,
    oppAbbr: g.opponentAbbr,
    home: g.isHome,
    state: 'Final',
    us: g.pts,
    them: g.oppPts,
    result: g.pts > g.oppPts ? 'W' : 'L',
    tv: null,
    venue: null,
    href: `/games/${g.gameId}`,
    spread: null,
    total: lgTotal,
    totalIsProxy: true,
    divisional: myDivision ? NBA_TEAM_DIVISIONS[g.opponentAbbr] === myDivision : null,
    day: null,
    primetime: false,
    oppHand: null,
    extra: false,
    rest: null,
    f5Total: null,
    firstInningTotal: null,
    keyStat: null,
  }))
  const ordered = chronological(games)
  ordered.forEach((g, i) => {
    if (i > 0) {
      const prev = new Date(`${ordered[i - 1].date}T12:00:00`).getTime()
      g.rest = Math.max(0, Math.round((new Date(`${g.date}T12:00:00`).getTime() - prev) / 86400000) - 1)
    }
  })
  return ordered
}

async function attachScorers(abbr: string, games: TeamGame[]) {
  const recent = chronological(finals(games)).slice(-5)
  await Promise.all(
    recent.map(async (g) => {
      const box = await getNBABoxScore(g.id).catch(() => null)
      if (!box) return
      const side = box.home.abbr === abbr ? box.home : box.away
      const top = [...side.players].sort((a, b) => b.pts - a.pts)[0]
      if (top) g.keyStat = `${top.name} · ${top.pts} pts`
    })
  )
}

const dec1 = (x: number) => x.toFixed(1)
const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`

function nbaStats(abbr: string, teams: NBATeamStats[]) {
  const per = (fn: (t: NBATeamStats) => number | null) => teams.flatMap((t) => { const v = fn(t); return v === null ? [] : [{ abbr: t.abbr, value: v }] })
  const L = (label: string, fn: (t: NBATeamStats) => number | null, higherBetter: boolean, format: (x: number) => string) => compareStat(label, abbr, per(fn), { higherBetter, format })
  const offense = [
    L('Points / G', (t) => t.pts, true, dec1),
    L('FG%', (t) => t.fgPct, true, pct1),
    L('3P%', (t) => t.fg3Pct, true, pct1),
    L('FT%', (t) => t.ftPct, true, pct1),
    L('Assists / G', (t) => t.ast, true, dec1),
    L('Turnovers / G', (t) => t.tov, false, dec1),
  ].filter((x): x is StatLine => !!x)
  const defense = [
    L('Opp Points / G', (t) => t.oppPts, false, dec1),
    L('Defensive Rating', (t) => t.defRtg, false, dec1),
    L('Rebounds / G', (t) => t.reb, true, dec1),
    L('Opp Turnovers / G', (t) => t.oppTov, true, dec1),
  ].filter((x): x is StatLine => !!x)
  const lgTotal = teams.reduce((s, t) => s + t.pts + t.oppPts, 0) / Math.max(teams.length, 1)
  const pick = (list: StatLine[], labels: string[]) => list.filter((s) => labels.includes(s.label))
  return { offense, defense, lgTotal: Math.round((lgTotal || 225) * 2) / 2, key: [...pick(offense, ['Points / G', 'FG%', '3P%']), ...pick(defense, ['Opp Points / G', 'Defensive Rating'])] }
}

function ordinal(x: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = x % 100
  return `${x}${s[(v - 20) % 10] || s[v] || s[0]}`
}

export async function getNbaTeamPage(abbr: string): Promise<TeamPageData | null> {
  const name = NBA_TEAM_NAMES[abbr]
  if (!name) return null
  const unavailable: string[] = []

  const [standingsRaw, teamStats, log, players] = await Promise.all([
    getNBAStandings().catch(() => null),
    getNBATeamFullStats().catch(() => null),
    getNBATeamSchedule(abbr).catch(() => null),
    getAllNBAPlayerSeasonStats().catch(() => null),
  ])
  if (!standingsRaw) unavailable.push('standings')
  if (!teamStats) unavailable.push('team stats')
  if (!log) unavailable.push('schedule')
  if (!players) unavailable.push('roster')
  // Every NBA feed we use is down: report that instead of an empty page.
  if (!standingsRaw && !teamStats && !log && !players) return null

  const standing = standingsRaw ? buildNbaStandings(standingsRaw).rows.find((r) => r.abbr === abbr) : undefined
  const stats = teamStats ? nbaStats(abbr, teamStats) : { offense: [], defense: [], key: [], lgTotal: 225 }
  const games = log ? buildGames(abbr, log, stats.lgTotal) : []
  await attachScorers(abbr, games).catch(() => undefined)
  const played = chronological(finals(games))
  const newestFirst = [...played].reverse()

  const t = tally(played, (g) => (g.us! > g.them! ? 'W' : 'L'))
  const record = standing ? `${standing.w}-${standing.l}` : `${t.wins}-${t.losses}`
  const pf = played.reduce((s, g) => s + (g.us ?? 0), 0)
  const pa = played.reduce((s, g) => s + (g.them ?? 0), 0)
  const gp = Math.max(played.length, 1)
  const ou = tally(played, (g) => { const o = totalOutcome(g); return o === 'O' ? 'W' : o === 'U' ? 'L' : o === 'P' ? 'P' : null })

  const summary: SummaryCard[] = [
    { label: 'W-L Record', value: record, tone: 'neutral', sub: standing ? `${standing.pct} win pct` : undefined },
    { label: 'Point Diff / G', value: `${(pf - pa) / gp > 0 ? '+' : ''}${((pf - pa) / gp).toFixed(1)}`, tone: diffTone(pf - pa) },
    { label: 'Home Record', value: standing?.home ?? '—', tone: 'neutral' },
    { label: 'Away Record', value: standing?.away ?? '—', tone: 'neutral' },
    { label: 'Points / G', value: (pf / gp).toFixed(1), tone: 'neutral' },
    { label: 'Opp Points / G', value: (pa / gp).toFixed(1), tone: 'neutral' },
    { label: 'ATS Record', value: 'N/A', tone: 'neutral', sub: 'needs a spread feed' },
    { label: 'Over / Under', value: `${ou.wins}-${ou.losses}`, tone: pctTone(pctOf(ou)), sub: `vs lg avg ${stats.lgTotal}` },
  ]

  const mine = (players ?? []).filter((p) => p.teamAbbr === abbr).sort((a, b) => b.min * b.gamesPlayed - a.min * a.gamesPlayed)
  const toPlayer = (p: (typeof mine)[number]): RosterPlayer => ({
    name: p.name,
    position: p.position,
    jersey: null,
    stats: [
      { label: 'PTS', value: p.pts.toFixed(1) },
      { label: 'REB', value: p.reb.toFixed(1) },
      { label: 'AST', value: p.ast.toFixed(1) },
    ],
    hot: false,
  })
  const roster: RosterGroup[] = [
    { title: 'Starters', players: mine.slice(0, 5).map(toPlayer) },
    { title: 'Bench', players: mine.slice(5, 8).map(toPlayer) },
  ].filter((g) => g.players.length > 0)

  const division = NBA_TEAM_DIVISIONS[abbr] ?? ''
  const east = ['Atlantic', 'Central', 'Southeast'].includes(division)

  return {
    sport: 'nba',
    abbr,
    name,
    city: cityFromName(name),
    color: NBA_TEAM_COLORS[abbr] ?? '#3B9EFF',
    record,
    standing: standing ? `${ordinal(standing.divRank)} ${standing.division}` : division,
    conferenceDivision: `${east ? 'Eastern' : 'Western'} Conference · ${division}`,
    streak: standing?.streak || null,
    form: newestFirst.slice(0, 10).map((g) => g.result!).filter(Boolean),
    summary,
    games,
    roster,
    betting: assembleBetting('nba', games),
    stats: [
      { title: 'Offense', stats: stats.offense },
      { title: 'Defense', stats: stats.defense, note: 'Opponent FG%, defensive rebound % and team steals/blocks aren’t in the team stat feed we use, so they’re left out.' },
    ],
    keyStats: stats.key,
    keyStatLabel: 'Top Scorer',
    avgFor: played.length ? pf / played.length : null,
    avgAgainst: played.length ? pa / played.length : null,
    unavailable,
  }
}

export { recordString }
