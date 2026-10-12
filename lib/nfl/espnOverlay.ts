import { getScoreboard, scoreboardFor, type EspnGame } from '@/lib/espn/api'
import { normalizeNflAbbr } from './divisions'
import { mapCurrentWeekGames, type LiveNflGame } from './mappers'

/**
 * Overlays ESPN data onto nflverse's weekly game list: the TV network for every game, and — while a
 * game is in progress — its live score and clock (nflverse scores only appear after the final whistle).
 * nflverse stays the source for everything else (spreads, totals, results, season stats).
 */
export async function withEspnNflOverlay(games: LiveNflGame[]): Promise<LiveNflGame[]> {
  try {
    const board = await scoreboardFor('nfl')
    if (!board) return games
    const byTeams = new Map(board.games.map((g) => [`${g.away.abbr}@${g.home.abbr}`, g]))
    return games.map((g) => {
      const e = byTeams.get(`${g.away.abbr}@${g.home.abbr}`)
      if (!e) return g
      const next: LiveNflGame = { ...g, network: e.network }
      if (e.state === 'in') {
        next.status = 'Live'
        next.away = { ...g.away, score: String(e.away.score ?? 0) }
        next.home = { ...g.home, score: String(e.home.score ?? 0) }
        next.liveDetail = e.shortStatus
      }
      return next
    })
  } catch (err) {
    console.error('[nfl/espnOverlay] failed', err)
    return games
  }
}

const ET = 'America/New_York'

function kickoffFromIso(iso: string): { gameday: string; label: string } {
  const d = new Date(iso)
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: ET, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  const label = new Intl.DateTimeFormat('en-US', { timeZone: ET, weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(d)
  return { gameday: day, label: `${label.replace(',', '')} ET` }
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`
}

/**
 * The current week's NFL slate from ESPN's scoreboard — every game from Thursday night through Monday night, with live
 * scores, status and TV network. Spread and total come from nflverse's closing lines when it has them (ESPN's otherwise),
 * and each game keeps its nflverse id so the breakdown links keep working (the schedule file carries ESPN's event id).
 * Returns null when ESPN can't be reached so the caller can fall back to the nflverse-only slate.
 */
export async function espnNflSlate(rows: Record<string, string>[]): Promise<LiveNflGame[] | null> {
  try {
    const first = await scoreboardFor('nfl', { ttl: 60 })
    if (!first || first.games.length === 0) return null
    const week = first.week
    const board = week ? await getScoreboard('football', 'nfl', undefined, { week, seasonType: first.seasonType === 3 ? 3 : 2, ttl: 60 }) : first
    const games: EspnGame[] = (board ?? first).games
    if (games.length === 0) return null

    const reg = rows.filter((r) => r.game_type === 'REG' || r.game_type === 'POST')
    const byEspn = new Map(reg.filter((r) => r.espn).map((r) => [r.espn, r]))
    const byTeams = new Map(reg.map((r) => [`${r.season}|${r.week}|${normalizeNflAbbr(r.away_team)}@${normalizeNflAbbr(r.home_team)}`, r]))

    return games
      .map((g): LiveNflGame => {
        const row = byEspn.get(g.id) ?? byTeams.get(`${g.seasonYear}|${g.week}|${g.away.abbr}@${g.home.abbr}`)
        const { gameday, label } = kickoffFromIso(g.date)
        const spreadNum = row && row.spread_line !== '' && row.spread_line !== undefined ? -Number(row.spread_line) : g.odds?.homeSpread ?? null
        const total = row && row.total_line ? row.total_line : g.odds?.total !== null && g.odds?.total !== undefined ? String(g.odds.total) : ''
        const live = g.state === 'in'
        return {
          id: row?.game_id ?? g.id,
          away: { abbr: g.away.abbr, score: g.state === 'pre' ? '' : String(g.away.score ?? 0) },
          home: { abbr: g.home.abbr, score: g.state === 'pre' ? '' : String(g.home.score ?? 0) },
          week: String(g.week ?? week ?? ''),
          gameday,
          kickoff: label,
          status: g.state === 'post' ? 'Final' : live ? 'Live' : 'Upcoming',
          spread: spreadNum !== null && Number.isFinite(spreadNum) ? `${g.home.abbr} ${signed(spreadNum)}` : '',
          total,
          network: g.network,
          liveDetail: live ? g.shortStatus : undefined,
        }
      })
      .sort((a, b) => `${a.gameday}${a.kickoff}`.localeCompare(`${b.gameday}${b.kickoff}`))
  } catch (err) {
    console.error('[nfl/espnSlate] failed', err)
    return null
  }
}

/** ESPN-first weekly slate with the nflverse schedule as the fallback. */
export async function nflWeekSlate(rows: Record<string, string>[] | null): Promise<LiveNflGame[] | null> {
  const espn = await espnNflSlate(rows ?? [])
  if (espn && espn.length > 0) return espn
  return rows ? withEspnNflOverlay(mapCurrentWeekGames(rows)) : null
}
