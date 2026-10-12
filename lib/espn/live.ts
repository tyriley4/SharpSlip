import { cached } from '@/lib/net/ttlCache'
import { dateOffset, getUnifiedGamesForDate } from '@/lib/home/schedule'
import { SPORT_META } from '@/lib/sport/meta'
import type { Sport } from '@/lib/sport/SportContext'
import { scoreboardFor, type EspnGame } from './api'

export interface LiveScoreItem {
  id: string
  text: string
  sport: Sport
  type: 'score'
  linkTo: string
  sportColor: string
}

export interface LiveScoresPayload {
  items: LiveScoreItem[]
  liveCount: number
  at: string
}

const SPORTS: Sport[] = ['nfl', 'cfb', 'mlb', 'nba', 'cbb', 'nhl']

/** Our own game-page links keyed "sport:AWAY@HOME", so a live score taps through to the right breakdown. */
async function hrefMap(): Promise<Map<string, string>> {
  const map = await cached('live:hrefs', 600, async () => {
    const games = await getUnifiedGamesForDate(dateOffset(0))
    return new Map(games.map((g) => [`${g.sport}:${g.away.abbr}@${g.home.abbr}`, g.href]))
  })
  return map ?? new Map()
}

function label(g: EspnGame): { a: string; h: string } {
  // College abbreviations are cryptic ("WASH"), but rank prefixes read well in a strip.
  const rk = (t: EspnGame['away']) => (t.rank ? `#${t.rank} ` : '')
  return { a: `${rk(g.away)}${g.away.abbr}`, h: `${rk(g.home)}${g.home.abbr}` }
}

function scoreText(g: EspnGame): string {
  const { a, h } = label(g)
  return `${a} ${g.away.score ?? 0} @ ${h} ${g.home.score ?? 0} • ${g.shortStatus} • LIVE`
}

/** Every game in progress right now across all six sports, from ESPN (30s cache). */
export async function getLiveScores(): Promise<LiveScoresPayload> {
  const boards = await Promise.all(SPORTS.map((s) => scoreboardFor(s, { ttl: 30 }).catch(() => null)))
  const hrefs = await hrefMap()

  const items: LiveScoreItem[] = []
  SPORTS.forEach((sport, i) => {
    for (const g of boards[i]?.games ?? []) {
      if (g.state !== 'in') continue
      items.push({
        id: `live-${sport}-${g.id}`,
        text: scoreText(g),
        sport,
        type: 'score',
        linkTo: sport === 'cfb' ? `/games/cfb/${g.id}` : sport === 'cbb' ? `/games/cbb/${g.id}` : (hrefs.get(`${sport}:${g.away.abbr}@${g.home.abbr}`) ?? '/games'),
        sportColor: SPORT_META[sport].color,
      })
    }
  })
  return { items, liveCount: items.length, at: new Date().toISOString() }
}

// ---------------------------------------------------------------------------
// College football
// ---------------------------------------------------------------------------

export interface CfbCard {
  id: string
  state: 'pre' | 'in' | 'post'
  status: string
  network: string | null
  away: { name: string; abbr: string; score: number | null; record: string | null; logo: string | null }
  home: { name: string; abbr: string; score: number | null; record: string | null; logo: string | null }
  venue: string | null
}

/**
 * College football games for the home page: shown only when games are in progress or finished today,
 * or are about to start (kickoff within 3 hours). On a quiet Tuesday this returns an empty list.
 */
export async function getCfbForHome(limit = 10): Promise<CfbCard[]> {
  const board = await scoreboardFor('cfb', { ttl: 60 }).catch(() => null)
  if (!board) return []
  const now = Date.now()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const relevant = board.games.filter((g) => {
    if (g.state === 'in') return true
    const day = new Date(g.date).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    if (g.state === 'post') return day === today
    return Date.parse(g.date) - now < 3 * 3600 * 1000 && Date.parse(g.date) > now - 3600 * 1000
  })
  const order = { in: 0, pre: 1, post: 2 } as const
  relevant.sort((a, b) => order[a.state] - order[b.state] || Date.parse(a.date) - Date.parse(b.date))
  return relevant.slice(0, limit).map((g) => ({
    id: g.id,
    state: g.state,
    status: g.shortStatus,
    network: g.network,
    away: { name: g.away.name, abbr: g.away.abbr, score: g.state === 'pre' ? null : g.away.score, record: g.away.record, logo: g.away.logo },
    home: { name: g.home.name, abbr: g.home.abbr, score: g.state === 'pre' ? null : g.home.score, record: g.home.record, logo: g.home.logo },
    venue: g.venue,
  }))
}
