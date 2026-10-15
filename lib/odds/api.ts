import { getCollegeDirectory } from '@/lib/college/directory'
import { scoreboardFor, type EspnGame } from '@/lib/espn/api'
import { cachedResult, peekCache } from '@/lib/net/ttlCache'
import type { Sport } from '@/lib/sport/SportContext'
import { fetchOddsPapiBoard } from './oddsPapi'
import { rememberOffers } from './propPrices'
import { archiveFromGameOdds, getCredits, recordLines } from './store'
import { callOddsApi, eventsToGames, fetchOddsApiBoard, fetchOddsApiProps, NBA_PRESEASON_KEY, PROP_MARKETS, SPORT_KEYS, type OddsApiEvent } from './theOddsApi'
import type { BookLine, CreditState, GameOdds, GamePropsResult, OddsBoard, OddsSource } from './types'
import { reportError } from '@/lib/monitoring/sentry'

/**
 * Real betting lines. Source order (first one that returns games wins):
 *   1. The Odds API (free tier = 500 credits/month, 3 credits per sport refresh)
 *   2. OddsPapi — takes over as primary once The Odds API is below CREDIT_FLOOR credits or exhausted
 *   3. ESPN's embedded DraftKings lines (free, today's slate only)
 *   4. Last known good copy held in memory
 * Every successful read logs which source served it.
 */

/** Below this many remaining credits we stop spending them and use OddsPapi first. */
export const CREDIT_FLOOR = 100
/** Player props cost one credit per market per game, so they need more headroom than game lines. */
const PROPS_CREDIT_FLOOR = 150

const LIVE_TTL = 60
const PREGAME_TTL = 3600
const PROPS_TTL = 3600
const HISTORICAL_TTL = 7 * 86400

const lastLive = new Map<Sport, boolean>()
const loggedEspn = new Set<string>()

/**
 * Cache lifetime for a board. 1h pregame / 60s live per the spec while credits are plentiful, but the
 * free tier only has 500 credits a month, so the lifetime stretches as the balance drops to guarantee
 * we never run it dry.
 */
export function boardTtl(live: boolean, credits: CreditState): number {
  const pressure = spendPressure(credits)
  if (live) return pressure < 0.5 ? LIVE_TTL : pressure < 1 ? 300 : 1800
  return pressure < 0.5 ? PREGAME_TTL : pressure < 1 ? 3 * 3600 : 6 * 3600
}

/**
 * Today's credit spend as a fraction of today's fair share (remaining credits spread over the days left
 * in the month). Under 0.5 the spec'd 60s / 1h cache lifetimes apply; past 1 the cache stretches so the
 * month's 500 credits can't run out early.
 */
export function spendPressure(credits: CreditState): number {
  if (credits.remaining === null || credits.used === null || credits.usedAtDayStart == null) return 0
  const now = new Date()
  const daysLeft = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate() - now.getUTCDate() + 1
  const startOfDayRemaining = credits.remaining + (credits.used - credits.usedAtDayStart)
  const dailyBudget = Math.max(3, startOfDayRemaining / Math.max(1, daysLeft))
  return (credits.used - credits.usedAtDayStart) / dailyBudget
}

function espnToOdds(sport: Sport, g: EspnGame): GameOdds | null {
  const o = g.odds
  if (!o) return null
  const book = o.provider || 'DraftKings'
  const side = (price: number | null, point: number | null) => (price === null ? null : { price, point, book })
  const awaySpread = o.homeSpread === null ? null : -o.homeSpread
  const line: BookLine = {
    bookKey: 'espn',
    book,
    awayMl: o.awayMl,
    homeMl: o.homeMl,
    awaySpread: awaySpread !== null && o.awaySpreadPrice !== null ? { point: awaySpread, price: o.awaySpreadPrice } : null,
    homeSpread: o.homeSpread !== null && o.homeSpreadPrice !== null ? { point: o.homeSpread, price: o.homeSpreadPrice } : null,
    total: o.total !== null ? { point: o.total, over: o.overPrice, under: o.underPrice } : null,
  }
  return {
    sport,
    gameId: g.id,
    eventId: null,
    source: 'espn',
    fetchedAt: new Date().toISOString(),
    commenceTime: g.date,
    live: g.state === 'in',
    away: g.away.abbr,
    home: g.home.abbr,
    book,
    moneyline: { away: side(o.awayMl, null), home: side(o.homeMl, null) },
    spread: {
      away: line.awaySpread ? side(line.awaySpread.price, line.awaySpread.point) : null,
      home: line.homeSpread ? side(line.homeSpread.price, line.homeSpread.point) : null,
    },
    total: {
      line: o.total,
      over: o.total !== null ? side(o.overPrice, o.total) : null,
      under: o.total !== null ? side(o.underPrice, o.total) : null,
    },
    books: [line],
  }
}

/** Free tier of last resort: the lines ESPN prints on its own scoreboard. */
async function espnBoard(sport: Sport): Promise<GameOdds[] | null> {
  const board = await scoreboardFor(sport, { ttl: 300 })
  if (!board) return null
  return board.games.filter((g) => g.state !== 'post').flatMap((g) => espnToOdds(sport, g) ?? [])
}

async function loadBoard(sport: Sport): Promise<OddsBoard | null> {
  // College club names (130+ / 360+) come from ESPN's directory; matching book names to abbreviations needs them loaded first.
  if (sport === 'cfb' || sport === 'cbb') await getCollegeDirectory(sport).catch(() => null)
  const credits = getCredits()
  const remaining = credits.remaining
  const oddsApiUsable = !!process.env.THE_ODDS_API_KEY && !credits.exhausted && (remaining === null || remaining >= CREDIT_FLOOR)
  const papiUsable = !!process.env.ODDSPAPI_KEY

  if (!oddsApiUsable && process.env.THE_ODDS_API_KEY) {
    console.warn(`[odds] The Odds API credits low/exhausted (remaining=${remaining}) — using OddsPapi as primary`)
  }

  const attempts: { source: OddsSource; run: () => Promise<GameOdds[] | null> }[] = []
  if (oddsApiUsable) attempts.push({ source: 'the-odds-api', run: () => fetchOddsApiBoard(sport, boardTtl(lastLive.get(sport) ?? false, credits)) })
  if (papiUsable) attempts.push({ source: 'oddspapi', run: () => fetchOddsPapiBoard(sport) })
  attempts.push({ source: 'espn', run: () => espnBoard(sport) })

  let emptyOk: OddsBoard | null = null
  for (const a of attempts) {
    try {
      const games = await a.run()
      if (games === null) {
        console.warn(`[odds] ${sport}: ${a.source} unavailable, trying next source`)
        continue
      }
      const board: OddsBoard = { sport, source: a.source, fetchedAt: new Date().toISOString(), games }
      if (games.length === 0) {
        emptyOk ??= board
        console.log(`[odds] ${sport}: ${a.source} returned no games, trying next source`)
        continue
      }
      console.log(`[odds] ${sport}: ${games.length} games from ${a.source}`)
      return board
    } catch (err) {
    reportError(err, 'odds')
      console.error(`[odds] ${sport}: ${a.source} threw`, err)
    }
  }
  return emptyOk
}

/** All posted games for a sport, from the best available source. */
export async function getOddsBoard(sport: Sport): Promise<OddsBoard | null> {
  const ttl = boardTtl(lastLive.get(sport) ?? false, getCredits())
  const r = await cachedResult(`odds:board:${sport}`, ttl, () => loadBoard(sport), { maxStaleSeconds: 12 * 3600 })
  const board = r.value
  if (!board) return null
  lastLive.set(sport, board.games.some((g) => g.live))
  if (r.origin === 'live') {
    recordLines(board.games.flatMap((g) => archiveFromGameOdds(g) ?? []))
  } else if (r.origin === 'stale') {
    console.warn(`[odds] ${sport}: serving cached board from ${board.source}`)
  }
  return board
}

export interface TeamsRef {
  away: string
  home: string
}

function matchGame(games: GameOdds[], gameId: string, teams?: TeamsRef): GameOdds | null {
  if (teams) {
    const exact = games.find((g) => g.away === teams.away && g.home === teams.home)
    if (exact) return exact
  }
  return games.find((g) => g.gameId === gameId || g.eventId === gameId) ?? null
}

/**
 * Moneyline, spread and total for one game. `teams` (the app's abbreviations) is how we match our
 * game ids to the books' event ids; it is optional only when `gameId` is already a provider event id.
 */
export async function getGameOdds(sport: Sport, gameId: string, teams?: TeamsRef): Promise<GameOdds | null> {
  try {
    const board = await getOddsBoard(sport)
    const hit = board ? matchGame(board.games, gameId, teams) : null
    if (hit) return { ...hit, gameId }

    // The primary source didn't list this game (e.g. far-off date) — ESPN may still have today's line.
    if (board && board.source !== 'espn') {
      const espn = await espnBoard(sport)
      const alt = espn ? matchGame(espn, gameId, teams) : null
      if (alt) {
        if (!loggedEspn.has(`${sport}:${gameId}`)) {
          loggedEspn.add(`${sport}:${gameId}`)
          console.log(`[odds] ${sport} ${gameId}: served from espn (not on ${board.source})`)
        }
        return { ...alt, gameId }
      }
    }
    return null
  } catch (err) {
    reportError(err, 'odds')
    console.error('[odds] getGameOdds failed', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Player props
// ---------------------------------------------------------------------------

/**
 * Player props from The Odds API (the only provider here that has them). One credit per prop market
 * per game, so it only runs when the balance is comfortably above the floor, and results are cached an hour.
 */
export type PropsReason = 'ok' | 'budget' | 'no-key' | 'not-posted' | 'error'

export interface PropsStatus {
  props: GamePropsResult | null
  /** Why there are no props: 'budget' means we are pacing credits (free tier), not that books haven't posted them. */
  reason: PropsReason
}

/** Like getPlayerProps but says why there is nothing to show, so the UI can tell "not posted yet" from "paused to save credits". */
export async function getPlayerPropsStatus(sport: Sport, gameId: string, teams?: TeamsRef): Promise<PropsStatus> {
  try {
    if (!process.env.THE_ODDS_API_KEY) return { props: null, reason: 'no-key' }
    const board = await getOddsBoard(sport)
    const game = board && board.source === 'the-odds-api' ? matchGame(board.games, gameId, teams) : null
    if (!game?.eventId) {
      // Props come only from The Odds API. When it is skipped for low credits the board is another source, and the honest
      // reason is the credit budget, not that the books have not posted them.
      const credits = getCredits()
      const paused = credits.exhausted || (credits.remaining !== null && credits.remaining < PROPS_CREDIT_FLOOR)
      return { props: null, reason: paused ? 'budget' : 'not-posted' }
    }

    // Only games within a day or so have props posted; don't burn credits on later ones.
    const start = game.commenceTime ? Date.parse(game.commenceTime) : NaN
    if (Number.isFinite(start) && start - Date.now() > 36 * 3600 * 1000) return { props: null, reason: 'not-posted' }

    let blocked = false
    const r = await cachedResult(`odds:props:${sport}:${game.eventId}`, PROPS_TTL, async () => {
      // A fresh cached copy is served above without spending anything; only a real fetch is subject to the budget.
      const credits = getCredits()
      if (credits.exhausted || (credits.remaining !== null && credits.remaining < PROPS_CREDIT_FLOOR) || spendPressure(credits) > 1.5) {
        console.warn(`[odds] props skipped for ${sport} ${gameId}: credits remaining=${credits.remaining}, today's spend at ${spendPressure(credits).toFixed(1)}x its share`)
        blocked = true
        return null
      }
      const key = sport === 'nba' ? await nbaKeyFor() : SPORT_KEYS[sport]
      const props = await fetchOddsApiProps(sport, game.eventId!, PROPS_TTL, key)
      if (!props) return null
      rememberOffers(sport, props)
      const result: GamePropsResult = { sport, gameId, source: 'the-odds-api', fetchedAt: new Date().toISOString(), props }
      return result
    })
    if (r.value) {
      console.log(`[odds] props ${sport} ${gameId}: ${r.value.props.length} offers (${r.origin})`)
      return { props: r.value, reason: 'ok' }
    }
    return { props: null, reason: blocked ? 'budget' : 'error' }
  } catch (err) {
    reportError(err, 'odds')
    console.error('[odds] getPlayerProps failed', err)
    return { props: null, reason: 'error' }
  }
}

/** Player props only if they are already cached - never spends a credit. For home-screen scans and anything not tied to a user opening the game. */
export async function getCachedPlayerProps(sport: Sport, gameId: string, teams?: TeamsRef): Promise<GamePropsResult | null> {
  try {
    const board = await getOddsBoard(sport)
    const game = board && board.source === 'the-odds-api' ? matchGame(board.games, gameId, teams) : null
    return game?.eventId ? peekCache<GamePropsResult>(`odds:props:${sport}:${game.eventId}`, PROPS_TTL) : null
  } catch {
    return null
  }
}

export async function getPlayerProps(sport: Sport, gameId: string, teams?: TeamsRef): Promise<GamePropsResult | null> {
  return (await getPlayerPropsStatus(sport, gameId, teams)).props
}

/** Preseason NBA events live under their own sport key; try the regular key first then preseason. */
async function nbaKeyFor(): Promise<string> {
  // The board already came from whichever key had games; a preseason slate means the regular key is empty.
  const probe = await callOddsApi<unknown[]>(`/sports/${SPORT_KEYS.nba}/events`, {}, 3600, 'nba/events-probe')
  const regular = Array.isArray(probe.data) && probe.data.length > 0
  return regular ? SPORT_KEYS.nba : NBA_PRESEASON_KEY
}

export function propMarketsFor(sport: Sport) {
  return PROP_MARKETS[sport]
}

// ---------------------------------------------------------------------------
// Historical odds
// ---------------------------------------------------------------------------

/**
 * Closing-ish lines for a past game from The Odds API's historical endpoint. This costs 10 credits per
 * market per request (30 for the three game markets) and is a paid-plan endpoint, so it is never called
 * implicitly: callers must pass `confirmCost: true`, and it refuses unless 300+ credits remain.
 */
export async function getHistoricalOdds(sport: Sport, gameId: string, teams: TeamsRef, atIso: string, options: { confirmCost?: boolean } = {}): Promise<GameOdds | null> {
  try {
    if (!options.confirmCost) {
      console.warn('[odds] getHistoricalOdds skipped: pass { confirmCost: true } — each call costs ~30 credits')
      return null
    }
    const credits = getCredits()
    if (!process.env.THE_ODDS_API_KEY || credits.exhausted || (credits.remaining !== null && credits.remaining < 300)) {
      console.warn(`[odds] getHistoricalOdds refused: credits remaining=${credits.remaining}`)
      return null
    }
    const r = await cachedResult(`odds:historical:${sport}:${teams.away}@${teams.home}:${atIso.slice(0, 13)}`, HISTORICAL_TTL, async () => {
      const res = await callOddsApi<{ data: OddsApiEvent[] }>(
        `/historical/sports/${SPORT_KEYS[sport]}/odds`,
        { regions: 'us', markets: 'h2h,spreads,totals', oddsFormat: 'american', date: atIso },
        HISTORICAL_TTL,
        `${SPORT_KEYS[sport]}/historical`
      )
      if (!res.ok || !res.data) return null
      const games = eventsToGames(sport, res.data.data ?? [], new Date().toISOString())
      return matchGame(games, gameId, teams)
    })
    return r.value ? { ...r.value, gameId } : null
  } catch (err) {
    reportError(err, 'odds')
    console.error('[odds] getHistoricalOdds failed', err)
    return null
  }
}

export { getCredits }
