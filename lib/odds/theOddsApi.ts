import type { Sport } from '@/lib/sport/SportContext'
import { redact } from '@/lib/net/ttlCache'
import { getCredits, saveCredits } from './store'
import { abbrFromTeamName } from './teams'
import type { BookLine, GameOdds, PropOffer, Side } from './types'

const BASE = 'https://api.the-odds-api.com/v4'

export const SPORT_KEYS: Record<Sport, string> = {
  mlb: 'baseball_mlb',
  nfl: 'americanfootball_nfl',
  cfb: 'americanfootball_ncaaf',
  nba: 'basketball_nba',
  cbb: 'basketball_ncaab',
  nhl: 'icehockey_nhl',
}

/** NBA preseason games are filed under their own key until the regular season starts. */
export const NBA_PRESEASON_KEY = 'basketball_nba_preseason'

/** Headline book preference: the first of these that posted the game's markets wins. */
const BOOK_PREFERENCE = ['draftkings', 'fanduel', 'betmgm', 'williamhill_us', 'espnbet', 'betrivers', 'fanatics', 'bovada', 'betonlineag', 'mybookieag', 'lowvig', 'betus', 'pointsbetus', 'unibet_us']

interface OddsApiOutcome {
  name: string
  description?: string
  price: number
  point?: number
}
interface OddsApiMarket {
  key: string
  outcomes: OddsApiOutcome[]
}
interface OddsApiBook {
  key: string
  title: string
  last_update: string
  markets: OddsApiMarket[]
}
export interface OddsApiEvent {
  id: string
  sport_key: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers: OddsApiBook[]
}

export interface OddsApiCall<T> {
  ok: boolean
  status: number
  data: T | null
  /** The Odds API's machine-readable error, e.g. OUT_OF_USAGE_CREDITS. */
  errorCode: string | null
}

/** One call to The Odds API with credit bookkeeping. `ttl` is the Next data-cache lifetime (seconds). */
export async function callOddsApi<T>(path: string, params: Record<string, string>, ttl: number, tag: string): Promise<OddsApiCall<T>> {
  const apiKey = process.env.THE_ODDS_API_KEY
  if (!apiKey) return { ok: false, status: 0, data: null, errorCode: 'NO_KEY' }
  const qs = new URLSearchParams({ apiKey, ...params }).toString()
  const url = `${BASE}${path}?${qs}`
  try {
    const res = await fetch(url, { next: { revalidate: ttl }, signal: AbortSignal.timeout(12000) })
    const remaining = res.headers.get('x-requests-remaining')
    const used = res.headers.get('x-requests-used')
    const last = res.headers.get('x-requests-last')
    if (remaining !== null) {
      const today = new Date().toISOString().slice(0, 10)
      const prev = getCredits()
      // Responses served from Next's persistent fetch cache carry the headers they were stored with, so a
      // reading can be older than what we already know. Credits only ever go down within a month: keep the
      // lowest `remaining` and highest `used` seen.
      const remainingNow = prev.remaining !== null ? Math.min(prev.remaining, Number(remaining)) : Number(remaining)
      const usedNow = used !== null ? Math.max(prev.used ?? 0, Number(used)) : prev.used
      const cost = last !== null ? Number(last) : 0
      // A new day starts a new daily-spend counter from the monthly total as it stood before this call.
      const newDay = prev.day !== today
      const state = saveCredits({
        remaining: remainingNow,
        used: usedNow,
        lastCost: last !== null ? Number(last) : null,
        exhausted: remainingNow <= 0,
        day: today,
        usedAtDayStart: newDay ? (prev.used ?? (usedNow !== null ? usedNow - cost : null)) : prev.usedAtDayStart ?? null,
      })
      console.log(`[odds] the-odds-api ${tag} → ${res.status}; credits remaining=${state.remaining} used=${state.used} lastCost=${state.lastCost}`)
    }
    if (!res.ok) {
      let errorCode: string | null = null
      try {
        errorCode = ((await res.json()) as { error_code?: string }).error_code ?? null
      } catch {
        // body wasn't JSON — status alone is enough
      }
      if (errorCode === 'OUT_OF_USAGE_CREDITS' || res.status === 429) saveCredits({ exhausted: true })
      console.error(`[odds] the-odds-api ${tag} failed: ${res.status} ${errorCode ?? ''} ${redact(url)}`)
      return { ok: false, status: res.status, data: null, errorCode }
    }
    return { ok: true, status: res.status, data: (await res.json()) as T, errorCode: null }
  } catch (err) {
    console.error(`[odds] the-odds-api ${tag} threw: ${(err as Error).message}`)
    return { ok: false, status: 0, data: null, errorCode: 'NETWORK' }
  }
}

function side(book: string, o: OddsApiOutcome | undefined): Side | null {
  if (!o || typeof o.price !== 'number') return null
  return { price: o.price, point: typeof o.point === 'number' ? o.point : null, book }
}

function bookLine(sport: Sport, away: string, home: string, awayName: string, homeName: string, b: OddsApiBook): BookLine {
  const h2h = b.markets.find((m) => m.key === 'h2h')
  const spreads = b.markets.find((m) => m.key === 'spreads')
  const totals = b.markets.find((m) => m.key === 'totals')
  void sport
  void away
  void home
  const byName = (m: OddsApiMarket | undefined, name: string) => m?.outcomes.find((o) => o.name === name)
  const aSp = byName(spreads, awayName)
  const hSp = byName(spreads, homeName)
  const over = byName(totals, 'Over')
  const under = byName(totals, 'Under')
  return {
    bookKey: b.key,
    book: b.title,
    awayMl: byName(h2h, awayName)?.price ?? null,
    homeMl: byName(h2h, homeName)?.price ?? null,
    awaySpread: aSp && typeof aSp.point === 'number' ? { point: aSp.point, price: aSp.price } : null,
    homeSpread: hSp && typeof hSp.point === 'number' ? { point: hSp.point, price: hSp.price } : null,
    total: over && typeof over.point === 'number' ? { point: over.point, over: over.price, under: under?.price ?? null } : null,
  }
}

function completeness(b: BookLine): number {
  return (b.homeMl !== null ? 1 : 0) + (b.homeSpread ? 1 : 0) + (b.total ? 1 : 0)
}

/** Picks the headline book: most complete markets first, then the preference order. */
export function pickHeadline(books: BookLine[]): BookLine | null {
  if (books.length === 0) return null
  const rank = (b: BookLine) => {
    const i = BOOK_PREFERENCE.indexOf(b.bookKey)
    return i === -1 ? 99 : i
  }
  return [...books].sort((a, b) => completeness(b) - completeness(a) || rank(a) - rank(b))[0]
}

export function gameOddsFromBooks(
  base: Pick<GameOdds, 'sport' | 'gameId' | 'eventId' | 'source' | 'fetchedAt' | 'commenceTime' | 'live' | 'away' | 'home'>,
  books: BookLine[]
): GameOdds | null {
  const head = pickHeadline(books)
  if (!head) return null
  const mk = (price: number | null, point: number | null): Side | null => (price === null ? null : { price, point, book: head.book })
  const ordered = [head, ...books.filter((b) => b !== head)].slice(0, 8)
  return {
    ...base,
    book: head.book,
    moneyline: { away: mk(head.awayMl, null), home: mk(head.homeMl, null) },
    spread: {
      away: head.awaySpread ? mk(head.awaySpread.price, head.awaySpread.point) : null,
      home: head.homeSpread ? mk(head.homeSpread.price, head.homeSpread.point) : null,
    },
    total: {
      line: head.total?.point ?? null,
      over: head.total ? mk(head.total.over, head.total.point) : null,
      under: head.total ? mk(head.total.under, head.total.point) : null,
    },
    books: ordered,
  }
}

/** Converts The Odds API events into GameOdds (events whose teams we can't map are skipped, with a log). */
export function eventsToGames(sport: Sport, events: OddsApiEvent[], fetchedAt: string): GameOdds[] {
  const out: GameOdds[] = []
  for (const ev of events) {
    const away = abbrFromTeamName(sport, ev.away_team)
    const home = abbrFromTeamName(sport, ev.home_team)
    if (!away || !home) {
      console.warn(`[odds] could not map teams "${ev.away_team}" @ "${ev.home_team}" (${sport})`)
      continue
    }
    const books = ev.bookmakers.map((b) => bookLine(sport, away, home, ev.away_team, ev.home_team, b))
    const g = gameOddsFromBooks(
      {
        sport,
        gameId: ev.id,
        eventId: ev.id,
        source: 'the-odds-api',
        fetchedAt,
        commenceTime: ev.commence_time,
        live: Date.parse(ev.commence_time) <= Date.now(),
        away,
        home,
      },
      books
    )
    if (g) out.push(g)
  }
  return out
}

export async function fetchOddsApiBoard(sport: Sport, ttl: number): Promise<GameOdds[] | null> {
  const keys = sport === 'nba' ? [SPORT_KEYS.nba, NBA_PRESEASON_KEY] : [SPORT_KEYS[sport]]
  const fetchedAt = new Date().toISOString()
  const games: GameOdds[] = []
  let anyOk = false
  for (const key of keys) {
    const res = await callOddsApi<OddsApiEvent[]>(
      `/sports/${key}/odds`,
      { regions: 'us', markets: 'h2h,spreads,totals', oddsFormat: 'american', dateFormat: 'iso' },
      ttl,
      key
    )
    if (!res.ok || !res.data) {
      if (!anyOk) return null
      break
    }
    anyOk = true
    games.push(...eventsToGames(sport, res.data, fetchedAt))
    if (games.length > 0) break // regular-season key had games; no need to spend credits on preseason
  }
  return anyOk ? games : null
}

// ---------------------------------------------------------------------------
// Player props
// ---------------------------------------------------------------------------

export const PROP_MARKETS: Record<Sport, { key: string; label: string }[]> = {
  mlb: [
    { key: 'batter_hits', label: 'Hits' },
    { key: 'batter_home_runs', label: 'Home Runs' },
    { key: 'pitcher_strikeouts', label: 'Strikeouts' },
  ],
  nfl: [
    { key: 'player_pass_yds', label: 'Passing Yards' },
    { key: 'player_rush_yds', label: 'Rushing Yards' },
    { key: 'player_reception_yds', label: 'Receiving Yards' },
    { key: 'player_receptions', label: 'Receptions' },
  ],
  nba: [
    { key: 'player_points', label: 'Points' },
    { key: 'player_rebounds', label: 'Rebounds' },
    { key: 'player_assists', label: 'Assists' },
  ],
  cfb: [
    { key: 'player_pass_yds', label: 'Passing Yards' },
    { key: 'player_rush_yds', label: 'Rushing Yards' },
    { key: 'player_reception_yds', label: 'Receiving Yards' },
  ],
  cbb: [
    { key: 'player_points', label: 'Points' },
    { key: 'player_rebounds', label: 'Rebounds' },
    { key: 'player_assists', label: 'Assists' },
  ],
  nhl: [
    { key: 'player_points', label: 'Points' },
    { key: 'player_shots_on_goal', label: 'Shots on Goal' },
    { key: 'player_assists', label: 'Assists' },
  ],
}

interface EventOddsResponse {
  id: string
  bookmakers: OddsApiBook[]
}

export async function fetchOddsApiProps(sport: Sport, eventId: string, ttl: number, sportKey?: string): Promise<PropOffer[] | null> {
  const markets = PROP_MARKETS[sport]
  const key = sportKey ?? SPORT_KEYS[sport]
  const res = await callOddsApi<EventOddsResponse>(
    `/sports/${key}/events/${eventId}/odds`,
    { regions: 'us', markets: markets.map((m) => m.key).join(','), oddsFormat: 'american', dateFormat: 'iso' },
    ttl,
    `${key}/props`
  )
  if (!res.ok || !res.data) return null

  const labelFor = (k: string) => markets.find((m) => m.key === k)?.label ?? k
  const bookRank = (k: string) => {
    const i = BOOK_PREFERENCE.indexOf(k)
    return i === -1 ? 99 : i
  }
  const books = [...(res.data.bookmakers ?? [])].sort((a, b) => bookRank(a.key) - bookRank(b.key))

  // One offer per (market, player): first book in preference order that posted it, keeping its own line.
  const offers = new Map<string, PropOffer>()
  for (const b of books) {
    for (const m of b.markets) {
      for (const o of m.outcomes) {
        const player = o.description
        if (!player || typeof o.point !== 'number') continue
        const k = `${m.key}|${player}`
        let offer = offers.get(k)
        if (!offer) {
          offer = { market: m.key, marketLabel: labelFor(m.key), player, line: o.point, over: null, under: null }
          offers.set(k, offer)
        }
        if (offer.line !== o.point) continue // a later book with a different number — keep the first book's line
        const s = side(b.title, o)
        if (o.name === 'Over' && !offer.over) offer.over = s
        else if (o.name === 'Under' && !offer.under) offer.under = s
      }
    }
  }
  return Array.from(offers.values()).filter((p) => p.over || p.under)
}

export function creditsRemaining(): number | null {
  return getCredits().remaining
}
