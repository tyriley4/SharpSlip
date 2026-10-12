import type { StandingsData, StandingsTeam } from '@/data/standings/types'
import { NFL_TEAM_DIVISIONS, normalizeNflAbbr } from './divisions'

export interface LiveNflGame {
  id: string
  away: { abbr: string; score: string }
  home: { abbr: string; score: string }
  week: string
  gameday: string
  /** Kickoff label (e.g. "Sun 1:00 PM ET") for games that haven't been played yet. */
  kickoff: string
  status: 'Final' | 'Upcoming' | 'Live'
  spread: string
  total: string
  /** TV network (ESPN's broadcast data); null when ESPN doesn't list the game. */
  network: string | null
  /** Live clock text such as "Q2 5:32" while the game is in progress. */
  liveDetail?: string
}

/** Signed spread text; a positive nflverse spread_line means the home team is favored, so callers pass the negated value for the home side. */
function formatSpread(n: number): string {
  return n > 0 ? `+${n}` : `${n}`
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function kickoffLabel(gameday: string, gametime: string): string {
  if (!gameday) return 'TBD'
  const [y, m, d] = gameday.split('-').map(Number)
  const day = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  if (!gametime) return day
  const [hh, mm] = gametime.split(':').map(Number)
  const hour12 = hh % 12 === 0 ? 12 : hh % 12
  return `${day} ${hour12}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'} ET`
}

/**
 * Maps a season's games.csv rows to the current week: the earliest regular-season week that still
 * has an unplayed game (finals and upcoming kickoffs together), or the final week once every game
 * has been played.
 */
export function mapCurrentWeekGames(rows: Record<string, string>[]): LiveNflGame[] {
  const reg = rows.filter((r) => r.game_type === 'REG')
  if (reg.length === 0) return []
  const isPlayed = (r: Record<string, string>) => r.home_score !== '' && r.away_score !== ''
  const unplayedWeeks = reg.filter((r) => !isPlayed(r)).map((r) => Number(r.week))
  const week = unplayedWeeks.length > 0 ? Math.min(...unplayedWeeks) : Math.max(...reg.map((r) => Number(r.week)))
  return reg
    .filter((r) => Number(r.week) === week)
    .sort((a, b) => `${a.gameday}${a.gametime}`.localeCompare(`${b.gameday}${b.gametime}`))
    .map((r) => ({
      id: r.game_id,
      away: { abbr: normalizeNflAbbr(r.away_team), score: r.away_score },
      home: { abbr: normalizeNflAbbr(r.home_team), score: r.home_score },
      week: r.week,
      gameday: r.gameday,
      kickoff: kickoffLabel(r.gameday, r.gametime),
      status: isPlayed(r) ? ('Final' as const) : ('Upcoming' as const),
      spread: r.spread_line ? `${normalizeNflAbbr(r.home_team)} ${formatSpread(-Number(r.spread_line))}` : '',
      total: r.total_line ?? '',
      network: null,
    }))
}

/** Aggregates a season's games.csv rows into division standings. */
export function mapNflStandings(rows: Record<string, string>[]): StandingsData {
  const played = rows.filter((r) => r.game_type === 'REG' && r.home_score !== '' && r.away_score !== '')
  const records = new Map<string, { w: number; l: number; t: number }>()

  const bump = (team: string, key: 'w' | 'l' | 't') => {
    const rec = records.get(team) ?? { w: 0, l: 0, t: 0 }
    rec[key]++
    records.set(team, rec)
  }

  for (const r of played) {
    const home = normalizeNflAbbr(r.home_team)
    const away = normalizeNflAbbr(r.away_team)
    const homeScore = Number(r.home_score)
    const awayScore = Number(r.away_score)
    if (homeScore > awayScore) {
      bump(home, 'w')
      bump(away, 'l')
    } else if (awayScore > homeScore) {
      bump(away, 'w')
      bump(home, 'l')
    } else {
      bump(home, 't')
      bump(away, 't')
    }
  }

  const byDivision: Record<string, StandingsTeam[]> = {}
  for (const [abbr, rec] of Array.from(records.entries())) {
    const division = NFL_TEAM_DIVISIONS[abbr]
    if (!division) continue
    const decisions = rec.w + rec.l + rec.t
    const pct = decisions > 0 ? (rec.w + rec.t * 0.5) / decisions : 0
    byDivision[division] ??= []
    byDivision[division].push({ abbr, w: rec.w, l: rec.l, pct: pct.toFixed(3).replace(/^0/, ''), gb: '—' })
  }

  for (const division of Object.keys(byDivision)) {
    const teams = byDivision[division].sort((a, b) => parseFloat(b.pct) - parseFloat(a.pct))
    const leader = teams[0]
    teams.forEach((t, i) => {
      t.hot = i === 0
      if (i > 0) {
        const gamesBack = (leader.w - t.w + (t.l - leader.l)) / 2
        t.gb = gamesBack <= 0 ? '—' : gamesBack.toFixed(1).replace(/\.0$/, '')
      }
    })
  }

  return byDivision
}
