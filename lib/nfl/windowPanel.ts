import { getNFLSchedule, getNFLWeeklyPlayerStats } from './api'
import { normalizeNflAbbr } from './divisions'
import { getNFLGameMatchup, getNFLQBStatsByName, getNFLTeamSkillPlayers } from './gameBreakdown'

export type NflWindowTab = 'passing' | 'rushing' | 'receiving' | 'defense'

export interface NflWindowMetric {
  label: string
  /** Per-game average over the window. */
  window: number
  /** Per-game average over the full season. */
  season: number
}

export interface NflWindowSubject {
  name: string
  /** Games in the window (can be fewer than asked when the player missed some). */
  games: number
  seasonGames: number
  metrics: NflWindowMetric[]
}

export interface NflWindowPanel {
  team: string
  windowGames: number
  subjects: NflWindowSubject[]
}

function n(v: string | undefined): number {
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : 0
}

type Row = Record<string, string>

const avg = (rows: Row[], key: string): number => (rows.length === 0 ? 0 : Math.round((rows.reduce((s, r) => s + n(r[key]), 0) / rows.length) * 10) / 10)

function subject(name: string, all: Row[], windowGames: number, metrics: [string, string][]): NflWindowSubject | null {
  const games = [...all].sort((a, b) => n(b.week) - n(a.week))
  if (games.length === 0) return null
  const recent = games.slice(0, windowGames)
  return {
    name,
    games: recent.length,
    seasonGames: games.length,
    metrics: metrics.map(([label, key]) => ({ label, window: avg(recent, key), season: avg(games, key) })),
  }
}

/**
 * A team's slice of one NFL breakdown tab recomputed over its players' last N games (default the tab shows the full
 * season). Built from the same weekly player rows the tabs use, so the numbers agree with them.
 */
export async function getNFLWindowPanel(gameId: string, side: 'away' | 'home', tab: NflWindowTab, windowGames: number): Promise<NflWindowPanel | null> {
  const matchup = await getNFLGameMatchup(gameId)
  if (!matchup) return null
  const team = side === 'away' ? matchup.away : matchup.home
  const weekly = (await getNFLWeeklyPlayerStats(matchup.season)) ?? []
  const subjects: NflWindowSubject[] = []

  if (tab === 'passing') {
    // The schedule's QB id is a GSIS id; the current season's weekly rows come from ESPN, so resolve the id by name like the Passing tab does.
    const qb = team.qbName ? await getNFLQBStatsByName(team.qbName, team.abbr, matchup.season) : null
    const qbId = qb?.playerId ?? team.qbId
    if (qbId) {
      const rows = weekly.filter((r) => r.player_id === qbId && n(r.attempts) > 0)
      const s = subject(team.qbName ?? 'Starting QB', rows, windowGames, [
        ['Pass yds', 'passing_yards'],
        ['Pass TD', 'passing_tds'],
        ['INT', 'interceptions'],
        ['Completions', 'completions'],
        ['Attempts', 'attempts'],
      ])
      if (s) subjects.push(s)
    }
  } else if (tab === 'rushing') {
    const rbs = await getNFLTeamSkillPlayers(team.abbr, matchup.season, 'RB')
    for (const p of rbs.slice(0, 2)) {
      const s = subject(
        p.name,
        weekly.filter((r) => r.player_id === p.playerId && (n(r.carries) > 0 || n(r.receptions) > 0)),
        windowGames,
        [
          ['Carries', 'carries'],
          ['Rush yds', 'rushing_yards'],
          ['Rush TD', 'rushing_tds'],
          ['Receptions', 'receptions'],
        ]
      )
      if (s) subjects.push(s)
    }
  } else if (tab === 'receiving') {
    const [wrs, tes] = await Promise.all([getNFLTeamSkillPlayers(team.abbr, matchup.season, 'WR'), getNFLTeamSkillPlayers(team.abbr, matchup.season, 'TE')])
    for (const p of [...wrs.slice(0, 3), ...tes.slice(0, 1)]) {
      const s = subject(
        p.name,
        weekly.filter((r) => r.player_id === p.playerId && (n(r.targets) > 0 || n(r.receptions) > 0)),
        windowGames,
        [
          ['Targets', 'targets'],
          ['Receptions', 'receptions'],
          ['Rec yds', 'receiving_yards'],
          ['Rec TD', 'receiving_tds'],
        ]
      )
      if (s) subjects.push(s)
    }
  } else {
    // Defense: what opponents' players produced against this team, week by week.
    const schedule = (await getNFLSchedule(matchup.season)) ?? []
    const faced = weekly.filter((r) => normalizeNflAbbr(r.opponent_team) === team.abbr)
    const byWeek = new Map<number, { passYds: number; rushYds: number; passTd: number; rushTd: number; ints: number }>()
    for (const r of faced) {
      const w = n(r.week)
      const cur = byWeek.get(w) ?? { passYds: 0, rushYds: 0, passTd: 0, rushTd: 0, ints: 0 }
      cur.passYds += n(r.passing_yards)
      cur.rushYds += n(r.rushing_yards)
      cur.passTd += n(r.passing_tds)
      cur.rushTd += n(r.rushing_tds)
      cur.ints += n(r.interceptions)
      byWeek.set(w, cur)
    }
    const weeks: Row[] = Array.from(byWeek.entries()).map(([week, v]) => {
      const g = schedule.find((s) => s.game_type === 'REG' && n(s.week) === week && (normalizeNflAbbr(s.home_team) === team.abbr || normalizeNflAbbr(s.away_team) === team.abbr))
      const home = g ? normalizeNflAbbr(g.home_team) === team.abbr : true
      const allowed = g ? n(home ? g.away_score : g.home_score) : 0
      return {
        week: String(week),
        passYds: String(v.passYds),
        rushYds: String(v.rushYds),
        totalYds: String(v.passYds + v.rushYds),
        passTd: String(v.passTd),
        rushTd: String(v.rushTd),
        ints: String(v.ints),
        pts: String(allowed),
      }
    })
    const s = subject(`${team.abbr} defense (allowed per game)`, weeks, windowGames, [
      ['Points', 'pts'],
      ['Total yds', 'totalYds'],
      ['Pass yds', 'passYds'],
      ['Rush yds', 'rushYds'],
      ['Pass TD', 'passTd'],
      ['Rush TD', 'rushTd'],
      ['INT forced', 'ints'],
    ])
    if (s) subjects.push(s)
  }

  return { team: team.abbr, windowGames, subjects }
}
