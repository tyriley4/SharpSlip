import { decimalToAmerican } from '@/lib/account/odds'
import { cached, fetchJsonSafe } from '@/lib/net/ttlCache'
import type { Sport } from '@/lib/sport/SportContext'
import { gameOddsFromBooks } from './theOddsApi'
import { abbrFromTeamName } from './teams'
import type { BookLine, GameOdds } from './types'

/**
 * OddsPapi (api.oddspapi.io) — fallback when The Odds API is out of credits. It speaks in numeric
 * market/outcome ids, so we load its market catalogue once (cached a week) and translate.
 */

const BASE = 'https://api.oddspapi.io/v4'

const SPORT_ID: Record<Sport, number> = { mlb: 13, nfl: 14, cfb: 14, nba: 11, cbb: 11, nhl: 15 }
// 0 = no verified OddsPapi tournament for this league (college); the fallback chain skips straight to ESPN.
const TOURNAMENT_ID: Record<Sport, number> = { mlb: 109, nfl: 31, cfb: 0, nba: 132, cbb: 0, nhl: 234 }
const BOOKMAKER = 'draftkings'
const BOOK_TITLE = 'DraftKings'

type Json = Record<string, any>

interface MarketMeta {
  marketId: number
  marketType: string
  period: string
  handicap: number
  outcomes: { outcomeId: number; outcomeName: string }[]
}

function url(path: string, params: Record<string, string | number>): string {
  const qs = new URLSearchParams({ apiKey: process.env.ODDSPAPI_KEY ?? '', ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) })
  return `${BASE}${path}?${qs.toString()}`
}

async function get<T>(path: string, params: Record<string, string | number>): Promise<T | null> {
  const res = await fetchJsonSafe<T>(url(path, params), { timeoutMs: 15000, cache: 'no-store' }, 'oddspapi')
  if (!res) return null
  // OddsPapi reports errors (including its per-endpoint cooldown) as a 200/4xx JSON object with an `error` key.
  if ((res.data as Json)?.error) {
    console.error(`[oddspapi] ${path}: ${JSON.stringify((res.data as Json).error).slice(0, 160)}`)
    return null
  }
  return res.data
}

async function markets(sport: Sport): Promise<Map<number, MarketMeta> | null> {
  return cached(`oddspapi:markets:${sport}`, 7 * 86400, async () => {
    const list = await get<MarketMeta[]>('/markets', { sportId: SPORT_ID[sport] })
    if (!Array.isArray(list)) return null
    return new Map(list.map((m) => [m.marketId, m]))
  })
}

function toAmerican(o: Json | undefined): number | null {
  const dec = Number(o?.price)
  if (Number.isFinite(dec) && dec > 1) return decimalToAmerican(dec)
  const am = Number(String(o?.priceAmerican ?? '').replace('−', '-'))
  return Number.isFinite(am) && am !== 0 ? am : null
}

function priceOf(market: Json | undefined, outcomeId: number): number | null {
  const outcome = market?.outcomes?.[String(outcomeId)]
  const player = outcome?.players?.['0'] ?? (outcome?.players ? Object.values(outcome.players)[0] : undefined)
  if (!player || player.active === false) return null
  return toAmerican(player as Json)
}

const decimalOf = (american: number) => (american > 0 ? american / 100 + 1 : 100 / -american + 1)

export async function fetchOddsPapiBoard(sport: Sport): Promise<GameOdds[] | null> {
  if (!process.env.ODDSPAPI_KEY || TOURNAMENT_ID[sport] === 0) return null
  const meta = await markets(sport)
  if (!meta) return null

  const today = new Date()
  const to = new Date(today.getTime() + 8 * 86400000)
  const day = (d: Date) => d.toISOString().slice(0, 10)

  const odds = await get<Json[]>('/odds-by-tournaments', { bookmaker: BOOKMAKER, tournamentIds: TOURNAMENT_ID[sport] })
  if (!Array.isArray(odds)) return null
  // Names come from the fixtures list (odds only carry participant ids). Short window keeps it light.
  await new Promise((r) => setTimeout(r, 1200)) // OddsPapi enforces a short per-account cooldown between calls
  const fixtures = await get<Json[]>('/fixtures', { tournamentId: TOURNAMENT_ID[sport], from: day(new Date(today.getTime() - 86400000)), to: day(to) })
  const names = new Map<string, { p1: string; p2: string }>()
  for (const f of fixtures ?? []) names.set(String(f.fixtureId), { p1: String(f.participant1Name ?? ''), p2: String(f.participant2Name ?? '') })

  const fetchedAt = new Date().toISOString()
  const games: GameOdds[] = []
  for (const f of odds) {
    const n = names.get(String(f.fixtureId))
    if (!n) continue
    const a1 = abbrFromTeamName(sport, n.p1)
    const a2 = abbrFromTeamName(sport, n.p2)
    if (!a1 || !a2) continue
    // In North American feeds participant 1 is the home side; confirm nothing here depends on it by
    // keeping the labels explicit and only trusting the order for the price direction.
    const home = a1
    const away = a2
    const bm = f.bookmakerOdds?.[BOOKMAKER]
    if (!bm?.markets) continue

    let awayMl: number | null = null
    let homeMl: number | null = null
    let bestSpread: { gap: number; handicap: number; p1: number | null; p2: number | null } | null = null
    let bestTotal: { gap: number; line: number; over: number | null; under: number | null } | null = null

    for (const [id, market] of Object.entries<Json>(bm.markets)) {
      const m = meta.get(Number(id))
      if (!m || m.period !== 'result' || market.marketActive === false) continue
      const find = (name: string) => m.outcomes.find((o) => o.outcomeName === name)?.outcomeId
      if (m.marketType === 'moneyline') {
        const o1 = find('1')
        const o2 = find('2')
        if (o1 !== undefined) homeMl = priceOf(market, o1)
        if (o2 !== undefined) awayMl = priceOf(market, o2)
      } else if (m.marketType === 'spreads') {
        const o1 = find('1')
        const o2 = find('2')
        const p1 = o1 !== undefined ? priceOf(market, o1) : null
        const p2 = o2 !== undefined ? priceOf(market, o2) : null
        if (p1 === null || p2 === null) continue
        const gap = Math.abs(decimalOf(p1) - decimalOf(p2))
        if (!bestSpread || gap < bestSpread.gap) bestSpread = { gap, handicap: m.handicap, p1, p2 }
      } else if (m.marketType === 'totals') {
        const oo = find('Over')
        const uu = find('Under')
        const over = oo !== undefined ? priceOf(market, oo) : null
        const under = uu !== undefined ? priceOf(market, uu) : null
        if (over === null || under === null) continue
        const gap = Math.abs(decimalOf(over) - decimalOf(under))
        if (!bestTotal || gap < bestTotal.gap) bestTotal = { gap, line: m.handicap, over, under }
      }
    }

    const book: BookLine = {
      bookKey: BOOKMAKER,
      book: BOOK_TITLE,
      awayMl,
      homeMl,
      // handicap is quoted for participant 1 (home); the away side gets the mirror image.
      homeSpread: bestSpread && bestSpread.p1 !== null ? { point: bestSpread.handicap, price: bestSpread.p1 } : null,
      awaySpread: bestSpread && bestSpread.p2 !== null ? { point: -bestSpread.handicap, price: bestSpread.p2 } : null,
      total: bestTotal ? { point: bestTotal.line, over: bestTotal.over, under: bestTotal.under } : null,
    }
    const start = String(f.startTime ?? '')
    const g = gameOddsFromBooks(
      { sport, gameId: String(f.fixtureId), eventId: null, source: 'oddspapi', fetchedAt, commenceTime: start || null, live: !!start && Date.parse(start) <= Date.now(), away, home },
      [book]
    )
    if (g) games.push(g)
  }
  console.log(`[odds] oddspapi ${sport} → ${games.length} games`)
  return games
}
