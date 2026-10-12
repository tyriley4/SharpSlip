import { scoreboardFor, type EspnGame } from '@/lib/espn/api'
import { getCollegeDirectory, type CollegeSport, type CollegeTeam } from './directory'

export interface SlateTeam {
  id: string
  abbr: string
  name: string
  shortName: string
  logo: string | null
  color: string
  rank: number | null
  record: string | null
  score: number | null
  conference: string
  conferenceAbbr: string
}

export interface SlateGame {
  id: string
  sport: CollegeSport
  date: string
  state: 'pre' | 'in' | 'post'
  statusText: string
  shortStatus: string
  network: string | null
  venue: string | null
  venueCity: string | null
  conferenceGame: boolean
  neutral: boolean
  headline: string | null
  away: SlateTeam
  home: SlateTeam
  homeSpread: number | null
  total: number | null
  /** Local (America/New_York) calendar day, YYYY-MM-DD, for grouping by day. */
  day: string
}

export interface CollegeSlate {
  sport: CollegeSport
  /** Football week for the slate (null for basketball). */
  week: number | null
  seasonYear: number | null
  games: SlateGame[]
  /** True when no regular-season games are on the board yet (offseason / before tip-off). */
  preseason: boolean
  /** ISO date the league's season opens, when ESPN says. */
  seasonOpens: string | null
}

const etDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

function team(t: EspnGame['away'], d?: CollegeTeam): SlateTeam {
  return {
    id: t.id,
    abbr: d?.abbr ?? t.abbr,
    name: d?.name ?? t.name,
    shortName: d?.shortName ?? t.shortName,
    logo: d?.logo ?? t.logo,
    color: d?.color ?? t.color ?? '#4d9fff',
    rank: t.rank,
    record: t.record,
    score: t.score,
    conference: d?.conference ?? '',
    conferenceAbbr: d?.conferenceAbbr ?? '',
  }
}

/**
 * The college slate: football's full current week (Thursday through Saturday) or basketball's day.
 * Only Division I games with at least one team in our directory are kept, so FCS/D-II mismatches don't pad the list.
 */
export async function getCollegeSlate(sport: CollegeSport, opts: { date?: string } = {}): Promise<CollegeSlate | null> {
  const [board, dir] = await Promise.all([scoreboardFor(sport, { ttl: 300, date: opts.date }), getCollegeDirectory(sport)])
  if (!board) return null
  const games: SlateGame[] = board.games
    .filter((g) => !dir || dir.byId.has(g.home.id) || dir.byId.has(g.away.id))
    .map((g) => {
      const a = dir?.byId.get(g.away.id)
      const h = dir?.byId.get(g.home.id)
      return {
        id: g.id,
        sport,
        date: g.date,
        state: g.state,
        statusText: g.statusText,
        shortStatus: g.shortStatus,
        network: g.network,
        venue: g.venue,
        venueCity: g.venueCity,
        conferenceGame: g.conferenceGame || (!!a && !!h && a.conference === h.conference),
        neutral: g.neutralSite,
        headline: g.headline,
        away: team(g.away, a),
        home: team(g.home, h),
        homeSpread: g.odds?.homeSpread ?? null,
        total: g.odds?.total ?? null,
        day: etDay(g.date),
      }
    })
    .sort((x, y) => {
      // Live first, then upcoming by kickoff with ranked matchups ahead of unranked at the same time, then finals.
      const order = { in: 0, pre: 1, post: 2 } as const
      const rk = (g: SlateGame) => Math.min(g.away.rank ?? 99, g.home.rank ?? 99)
      return order[x.state] - order[y.state] || x.date.localeCompare(y.date) || rk(x) - rk(y)
    })

  const calendarStart = board.calendarStart
  // Basketball: when nothing is being played, ESPN's default board is the next game day — if that's still ahead, the season hasn't opened
  // and that date is when it does. Football: ESPN reports the preseason (season type 1) or nothing is scheduled.
  const nextTip = games.length > 0 ? games.reduce((m, g) => (g.date < m ? g.date : m), games[0].date) : null
  const todayEt = etDay(new Date().toISOString())
  const cbbPreseason = nextTip ? etDay(nextTip) > todayEt && games.every((g) => g.state === 'pre') : calendarStart !== null && Date.parse(calendarStart) > Date.now()
  const preseason = sport === 'cbb' ? cbbPreseason : board.seasonType === 1 || games.length === 0
  const seasonOpens = sport === 'cbb' && cbbPreseason && nextTip ? nextTip : calendarStart
  return { sport, week: board.week, seasonYear: board.seasonYear, games, preseason, seasonOpens }
}
