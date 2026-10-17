import { reportError } from '@/lib/monitoring/sentry'
import { mapWithConcurrency } from '@/lib/utils/concurrency'
import { cached } from '@/lib/net/ttlCache'
import { dateOffset, getUnifiedGamesForDate } from '@/lib/home/schedule'
import { getCachedPlayerProps, getPlayerPropsStatus } from '@/lib/odds/api'
import type { GameOdds, PropOffer, Side } from '@/lib/odds/types'
import { impliedProb, noVigProb } from '@/lib/parlay/math'
import { fmtLine, mk } from '@/lib/parlay/lines'
import { slugify } from '@/lib/players/slug'
import type { Sport } from '@/lib/sport/SportContext'
import { loadGameContext } from './data/gameContext'
import { loadHitterMatchup, type HitterMatchup } from './data/mlbMatchup'
import { foundationHeadline } from './gameFoundation'
import type { ExplanationContext } from './explanationGenerator'
import { qualityOf } from './qualityFilter'
import { computeSynthesis } from './teamSynthesis'
import { EARLY_SEASON_NOTE, NBA_ANALYSIS_NOTE, PLAYOFF_BANNER, PRESEASON_ANALYSIS_NOTE } from './seasonText'
import { getPlayerHistory, categoryForMarket } from './data/playerHistory'
import { rosterIndex } from './data/rosters'
import { evaluateWithContext } from './edgeEngine'
import type { BettingOutcome, Edge, EdgeResult, Grade, GameContext, PlayerHistory, SeasonContext } from './types'

export interface BetInsight {
  description: string
  category: Edge['category']
  supportingData: string
  /** 0-12 quality score; items at 6-8 are drawn muted, 9+ at full weight. */
  quality?: number
  /** Games behind the item when it rests on fewer than the standard minimum (an early-season signal). */
  smallSample?: number
}

export interface BetLeg {
  sport: Sport
  label: string
  typeLabel: string
  oddsAmerican: number
  prob: number
  lineId: string
  matchup: string
  grade?: string
  book?: string
}

/** Everything the written explanation needs, so tapping the icon makes no request. */
export interface BetExplainData {
  outcome: Pick<BettingOutcome, 'type' | 'direction' | 'player' | 'team' | 'opponent'>
  evidence: Edge[]
  context: ExplanationContext
  conflicts: number
  impliedProbability: number | null
}

export interface BetCardData {
  id: string
  section: 'game' | 'prop'
  market: string
  description: string
  /** American odds; null when no real price exists (estimated line). */
  odds: number | null
  book: string | null
  estimated: boolean
  /** Market implied probability, 0-100 (no-vig for two-sided markets). */
  impliedProbability: number | null
  grade: Grade | null
  convictionScore: number
  historicalHitRate: number | null
  isSharpFind: boolean
  limitedSample: boolean
  sampleSize: number
  ungradedReason?: string
  /** One plain sentence about the grade: no-edge, weak evidence, no live odds, role cap. */
  gradeNote?: string
  explain?: BetExplainData
  insights: BetInsight[]
  leg: BetLeg
  sport: Sport
  gameId: string
  matchup: string
  /** Props: who. */
  player?: { name: string; team: string; position: string }
}

export interface PropGroup {
  group: string
  players: { name: string; team: string; position: string; bets: BetCardData[] }[]
}

export interface RecommendedBets {
  sport: Sport
  gameId: string
  matchup: string
  generatedAt: string
  oddsSource: 'real' | 'estimated'
  note: string | null
  gameLines: BetCardData[]
  props: PropGroup[]
  /** Why game lines are missing for a game that is under way or finished (never filled with estimates). */
  linesUnavailable?: string
  /** Why there are no props (budget / not posted / none). */
  propsNote: string | null
  firstHalfNote: string
  /** History is last season because the current one has not produced results yet. */
  priorSeasonOnly: boolean
  season: SeasonContext
  /** Banner for the tab: preseason (no analysis), playoff weighting or early season. */
  seasonNote: string | null
  /** Engine failed for the game as a whole. */
  unavailable: boolean
}

const FIRST_HALF_NOTE: Record<Sport, string> = {
  mlb: 'First 5 innings lines are not offered on the current data plan.',
  nfl: 'First-half lines are not offered on the current data plan.',
  cfb: 'First-half lines are not offered on the current data plan.',
  nba: 'First-half lines are not offered on the current data plan.',
  cbb: 'First-half lines are not offered on the current data plan.',
  nhl: 'First-period lines are not offered on the current data plan.',
}

const SPREAD_NAME: Record<Sport, string> = { mlb: 'Run Line', nhl: 'Puck Line', nba: 'Spread', nfl: 'Spread', cfb: 'Spread', cbb: 'Spread' }

const insightsOf = (r: EdgeResult): BetInsight[] => r.edges.map((e) => ({ description: e.description, category: e.category, supportingData: e.supportingData, quality: qualityOf(e), smallSample: e.smallSample }))

function card(
  base: { id: string; section: 'game' | 'prop'; market: string; description: string; odds: number | null; book: string | null; estimated: boolean; implied: number | null; sport: Sport; gameId: string; matchup: string; typeLabel: string; player?: BetCardData['player'] },
  r: EdgeResult,
  outcome: BettingOutcome,
  game: GameContext
): BetCardData {
  const prob = base.implied !== null ? base.implied : (r.historicalHitRate ?? 50)
  return {
    id: base.id,
    section: base.section,
    market: base.market,
    description: base.description,
    odds: base.odds,
    book: base.book,
    estimated: base.estimated,
    impliedProbability: base.implied,
    grade: r.grade,
    convictionScore: r.convictionScore,
    historicalHitRate: r.historicalHitRate,
    // Sharp Finds are a player-prop concept: they are never flagged on game lines.
    isSharpFind: base.section === 'prop' && r.isSharpFind,
    limitedSample: r.limitedSample,
    sampleSize: r.sampleSize,
    ungradedReason: r.ungradedReason,
    gradeNote: r.gradeNote,
    explain: {
      outcome: { type: outcome.type, direction: outcome.direction, player: outcome.player, team: outcome.team, opponent: outcome.opponent },
      evidence: r.edges,
      context: { season: game.season, hasOdds: base.odds !== null, priorSeasonOnly: game.priorSeasonOnly, away: game.away, home: game.home, sport: game.sport, foundation: foundationHeadline(game, outcome.team?.abbr ?? outcome.player?.team ?? null, outcome.type === 'total' ? 'total' : outcome.type === 'player_prop' ? 'prop' : 'team') },
      conflicts: r.conflicts ?? 0,
      impliedProbability: base.implied,
    },
    insights: insightsOf(r),
    sport: base.sport,
    gameId: base.gameId,
    matchup: base.matchup,
    player: base.player,
    leg: {
      sport: base.sport,
      label: base.description,
      typeLabel: base.typeLabel,
      oddsAmerican: base.odds ?? -110,
      prob: Math.round(prob * 10) / 10,
      lineId: base.id,
      matchup: base.matchup,
      grade: r.grade ?? undefined,
      book: base.book ?? (base.odds === null ? 'Estimated line' : undefined),
    },
  }
}

interface LineSpec {
  id: string
  market: string
  description: string
  odds: number | null
  book: string | null
  implied: number | null
  estimated: boolean
  typeLabel: string
  outcome: BettingOutcome
}

const pair = (a: Side, b: Side) => noVigProb(a.price, b.price)

/** Moneyline, spread and total outcomes from one real posted line (every price here is a real sportsbook price). */
function realLineSpecs(odds: GameOdds, sport: Sport, gameId: string, matchup: string): LineSpec[] {
  const { away, home } = odds
  const specs: LineSpec[] = []
  const t = (abbr: string, opp: string, isHome: boolean) => ({ abbr, opponent: opp, home: isHome })
  const { away: aMl, home: hMl } = odds.moneyline
  if (aMl && hMl) {
    const pa = pair(aMl, hMl)
    specs.push({ id: mk(sport, gameId, matchup, 'Moneyline', away, '', '', 0, 0, '').id, market: 'Moneyline', description: `${away} Moneyline`, odds: aMl.price, book: aMl.book, implied: pa, estimated: false, typeLabel: 'Moneyline', outcome: { type: 'moneyline', sport, gameId, team: t(away, home, false), direction: 'away', homeAway: 'away', odds: aMl.price, impliedProbability: pa / 100 } })
    specs.push({ id: mk(sport, gameId, matchup, 'Moneyline', home, '', '', 0, 0, '').id, market: 'Moneyline', description: `${home} Moneyline`, odds: hMl.price, book: hMl.book, implied: 100 - pa, estimated: false, typeLabel: 'Moneyline', outcome: { type: 'moneyline', sport, gameId, team: t(home, away, true), direction: 'home', homeAway: 'home', odds: hMl.price, impliedProbability: (100 - pa) / 100 } })
  }
  const { away: aSp, home: hSp } = odds.spread
  if (aSp && hSp && aSp.point !== null && hSp.point !== null) {
    const pa = pair(aSp, hSp)
    specs.push({ id: mk(sport, gameId, matchup, 'Spread', `${away}${aSp.point}`, '', '', 0, 0, '').id, market: SPREAD_NAME[sport], description: `${away} ${fmtLine(aSp.point)}`, odds: aSp.price, book: aSp.book, implied: pa, estimated: false, typeLabel: SPREAD_NAME[sport], outcome: { type: 'spread', sport, gameId, team: t(away, home, false), threshold: aSp.point, direction: 'away', homeAway: 'away', odds: aSp.price, impliedProbability: pa / 100 } })
    specs.push({ id: mk(sport, gameId, matchup, 'Spread', `${home}${hSp.point}`, '', '', 0, 0, '').id, market: SPREAD_NAME[sport], description: `${home} ${fmtLine(hSp.point)}`, odds: hSp.price, book: hSp.book, implied: 100 - pa, estimated: false, typeLabel: SPREAD_NAME[sport], outcome: { type: 'spread', sport, gameId, team: t(home, away, true), threshold: hSp.point, direction: 'home', homeAway: 'home', odds: hSp.price, impliedProbability: (100 - pa) / 100 } })
  }
  const { over, under, line } = odds.total
  if (over && under && line !== null) {
    const po = pair(over, under)
    specs.push({ id: mk(sport, gameId, matchup, 'Total', `O${line}`, '', '', 0, 0, '').id, market: 'Total', description: `Over ${line}`, odds: over.price, book: over.book, implied: po, estimated: false, typeLabel: 'Total', outcome: { type: 'total', sport, gameId, threshold: line, direction: 'over', odds: over.price, impliedProbability: po / 100 } })
    specs.push({ id: mk(sport, gameId, matchup, 'Total', `U${line}`, '', '', 0, 0, '').id, market: 'Total', description: `Under ${line}`, odds: under.price, book: under.book, implied: 100 - po, estimated: false, typeLabel: 'Total', outcome: { type: 'total', sport, gameId, threshold: line, direction: 'under', odds: under.price, impliedProbability: (100 - po) / 100 } })
  }
  return specs
}

const half = (x: number) => Math.round(x * 2) / 2

/** No real price anywhere: lines estimated from each team season scoring, clearly labelled and without odds. */
function estimatedLineSpecs(game: GameContext, sport: Sport, gameId: string, matchup: string): LineSpec[] {
  const season = (abbr: string) => {
    const g = game.results[abbr] ?? []
    if (g.length === 0) return []
    const s = Math.max(...g.map((x) => x.season))
    return g.filter((x) => x.season === s)
  }
  const a = season(game.away)
  const h = season(game.home)
  if (a.length < 3 || h.length < 3) return []
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
  const total = half((mean(a.map((g) => g.us + g.them)) + mean(h.map((g) => g.us + g.them))) / 2)
  const margin = mean(h.map((g) => g.us - g.them)) - mean(a.map((g) => g.us - g.them))
  // Each margin is against an average opponent; half the gap (small samples regress) is the expected home margin, and the home number is its negative.
  const cap = sport === 'nfl' || sport === 'cfb' ? 17 : sport === 'nba' || sport === 'cbb' ? 12 : 1.5
  // Baseball and hockey run/puck lines are always 1.5 with the favourite laying it, so only the direction is estimated.
  const homeLine = sport === 'mlb' || sport === 'nhl' ? (margin >= 0 ? -1.5 : 1.5) : half(Math.max(-cap, Math.min(cap, -margin / 2))) || -0.5
  const specs: LineSpec[] = []
  const t = (abbr: string, opp: string, isHome: boolean) => ({ abbr, opponent: opp, home: isHome })
  for (const [abbr, opp, isHome, line] of [
    [game.away, game.home, false, -homeLine],
    [game.home, game.away, true, homeLine],
  ] as const) {
    specs.push({ id: `${sport}:${gameId}:Spread:${abbr}${line}`, market: SPREAD_NAME[sport], description: `${abbr} ${fmtLine(line)}`, odds: null, book: null, implied: null, estimated: true, typeLabel: SPREAD_NAME[sport], outcome: { type: 'spread', sport, gameId, team: t(abbr, opp, isHome), threshold: line, direction: isHome ? 'home' : 'away', homeAway: isHome ? 'home' : 'away' } })
    specs.push({ id: `${sport}:${gameId}:Moneyline:${abbr}`, market: 'Moneyline', description: `${abbr} Moneyline`, odds: null, book: null, implied: null, estimated: true, typeLabel: 'Moneyline', outcome: { type: 'moneyline', sport, gameId, team: t(abbr, opp, isHome), direction: isHome ? 'home' : 'away', homeAway: isHome ? 'home' : 'away' } })
  }
  for (const dir of ['over', 'under'] as const) {
    specs.push({ id: `${sport}:${gameId}:Total:${dir === 'over' ? 'O' : 'U'}${total}`, market: 'Total', description: `${dir === 'over' ? 'Over' : 'Under'} ${total}`, odds: null, book: null, implied: null, estimated: true, typeLabel: 'Total', outcome: { type: 'total', sport, gameId, threshold: total, direction: dir } })
  }
  void matchup
  return specs
}

/** Whether the game is under way or finished (its pregame lines are gone and must not be replaced by estimates). */
async function gamePhase(sport: Sport, gameId: string, startTime: string | null): Promise<'live' | 'final' | null> {
  const games = (await cached('edges:todays-games', 600, () => getUnifiedGamesForDate(dateOffset(0)))) ?? []
  const g = games.find((x) => x.sport === sport && x.id === gameId)
  if (g) return g.status === 'Final' ? 'final' : g.status === 'Live' ? 'live' : null
  return startTime && Date.parse(startTime) <= Date.now() ? 'live' : null
}

/** Position group label for the props list, by sport. */
function groupFor(sport: Sport, position: string, marketLabel: string): string {
  const p = position.toUpperCase()
  if (sport === 'mlb') return marketLabel === 'Strikeouts' || ['SP', 'RP', 'P'].includes(p) ? 'Starting Pitchers' : 'Lineup'
  if (sport === 'nfl' || sport === 'cfb') return ['QB', 'RB', 'WR', 'TE'].includes(p) ? p : p === 'FB' || p === 'HB' ? 'RB' : 'DEF'
  if (sport === 'nhl') return p === 'G' ? 'Goalies' : p === 'D' ? 'Defense' : 'Forwards'
  return 'Players'
}

const GROUP_ORDER: Record<Sport, string[]> = {
  mlb: ['Starting Pitchers', 'Lineup', 'Bullpen'],
  nfl: ['QB', 'RB', 'WR', 'TE', 'DEF'],
  cfb: ['QB', 'RB', 'WR', 'TE', 'DEF'],
  nba: ['Starters', 'Bench'],
  cbb: ['Players'],
  nhl: ['Forwards', 'Defense', 'Goalies'],
}

/** Builds the full Recommended Bets payload for one game. */
/** 'live' may spend an odds credit to fetch props (a user opened the game); 'cached' only uses props already fetched (scans). */
export type PropsMode = 'live' | 'cached'

export async function buildRecommended(sport: Sport, gameId: string, away: string, home: string, offersOverride?: PropOffer[], mode: PropsMode = 'live'): Promise<RecommendedBets> {
  const matchup = `${away} @ ${home}`
  const game = await loadGameContext(sport, gameId, away, home)
  const odds = game.odds
  const season = game.season
  if (season.isPreseason) {
    return { sport, gameId, matchup, generatedAt: new Date().toISOString(), oddsSource: 'estimated', note: null, gameLines: [], props: [], propsNote: null, firstHalfNote: FIRST_HALF_NOTE[sport], priorSeasonOnly: false, season, seasonNote: sport === 'nba' ? NBA_ANALYSIS_NOTE : PRESEASON_ANALYSIS_NOTE, unavailable: false }
  }
  const seasonNote = season.isPlayoffs ? PLAYOFF_BANNER : season.isEarlySeason ? EARLY_SEASON_NOTE : null

  // ---- Player props (real offers only; no price is ever invented)
  const propsStatus = offersOverride
    ? { props: null, reason: 'ok' as const }
    : mode === 'cached'
      ? { props: await getCachedPlayerProps(sport, gameId, { away, home }), reason: 'not-posted' as const }
      : await getPlayerPropsStatus(sport, gameId, { away, home })
  const offers: PropOffer[] = offersOverride ?? propsStatus.props?.props ?? []
  let propsNote: string | null = null
  if (offers.length === 0) {
    propsNote =
      propsStatus.reason === 'budget'
        ? 'Player props are paused for now to stay within the free data allowance. They return automatically.'
        : propsStatus.reason === 'no-key'
          ? 'Player props need a sportsbook data key that is not configured.'
          : 'Player props are not posted for this game yet - books usually release them a day or less before the start.'
  }
  const roster = offers.length > 0 ? await rosterIndex(sport, away, home) : new Map()
  const histories = new Map<string, PlayerHistory | null>()
  const players = Array.from(new Set(offers.map((o) => o.player)))
  await mapWithConcurrency(players, 6, async (name) => {
    const hit = roster.get(slugify(name))
    const offer = offers.find((o) => o.player === name)!
    const category = categoryForMarket(sport, offer.marketLabel)
    histories.set(name, category ? await getPlayerHistory(sport, name, hit?.team ?? '', category) : null)
  })

  // MLB hitters: platoon split and history against tonight's starter, loaded once per hitter.
  const hitterMatchups = new Map<string, HitterMatchup | null>()
  if (sport === 'mlb' && game.mlb) {
    const year = new Date().getUTCFullYear()
    await mapWithConcurrency(players, 5, async (name) => {
      const hit = roster.get(slugify(name))
      const history = histories.get(name)
      const offer = offers.find((o) => o.player === name)!
      const category = categoryForMarket(sport, offer.marketLabel)
      if (!hit || !history || !category || category === 'Strikeouts') return
      const facing = hit.team === away ? game.mlb!.probables.home : game.mlb!.probables.away
      if (!facing) return
      hitterMatchups.set(name, await loadHitterMatchup(history.playerId, facing.id, facing.name, year).catch(() => null))
    })
  }

  const cards: BetCardData[] = []
  for (const o of offers) {
    const hit = roster.get(slugify(o.player))
    const team = hit?.team ?? ''
    const opponent = team === away ? home : team === home ? away : undefined
    const category = categoryForMarket(sport, o.marketLabel)
    const position = hit?.position ?? ''
    const history = histories.get(o.player) ?? null
    for (const side of ['over', 'under'] as const) {
      const s = side === 'over' ? o.over : o.under
      if (!s) continue
      const other = side === 'over' ? o.under : o.over
      const implied = other ? noVigProb(s.price, other.price) : impliedProb(s.price)
      const dir = side === 'over' ? 'Over' : 'Under'
      const description = `${o.player} ${dir} ${o.line} ${o.marketLabel}`
      const outcome: BettingOutcome = {
        type: 'player_prop',
        sport,
        gameId,
        player: { name: o.player, team, position },
        category: category ?? undefined,
        threshold: o.line,
        direction: side,
        odds: s.price,
        impliedProbability: implied / 100,
        opponent,
        homeAway: team === home ? 'home' : team === away ? 'away' : undefined,
      }
      const result = category ? evaluateWithContext(outcome, game, history, { hitterMatchup: hitterMatchups.get(o.player) ?? null }) : evaluateWithContext({ ...outcome, category: undefined }, game, null)
      const id = mk(sport, gameId, matchup, 'Player Prop', `${o.market}:${o.player}:${o.line}:${side === 'over' ? 'O' : 'U'}`, '', '', 0, 0, '').id
      cards.push(card({ id, section: 'prop', market: o.marketLabel, description, odds: s.price, book: s.book, estimated: false, implied, sport, gameId, matchup, typeLabel: 'Player Prop', player: { name: o.player, team, position } }, result, outcome, game))
    }
  }

  // ---- Game lines (after the props, so clusters of player edges can lift the team and total bets)
  const synthesis = computeSynthesis(cards, game)
  const specs = odds ? realLineSpecs(odds, sport, gameId, matchup) : []
  let linesUnavailable: string | undefined
  if (specs.length === 0) {
    // A game under way or finished has no pregame market: say so instead of estimating lines the market never offered.
    const phase = await gamePhase(sport, gameId, game.startTime)
    if (phase) linesUnavailable = phase === 'final' ? 'This game is final, so its lines are no longer posted' : 'Live odds unavailable for in-progress game'
  }
  const usingEstimates = specs.length === 0 && !linesUnavailable
  const lineSpecs = linesUnavailable ? [] : usingEstimates ? estimatedLineSpecs(game, sport, gameId, matchup) : specs
  const gameLines = lineSpecs.map((s) =>
    card({ id: s.id, section: 'game', market: s.market, description: s.description, odds: s.odds, book: s.book, estimated: s.estimated, implied: s.implied, sport, gameId, matchup, typeLabel: s.typeLabel }, evaluateWithContext(s.outcome, game, null, { synthesis }), s.outcome, game)
  )

  // Group by position group, players ranked by their best conviction.
  const byGroup = new Map<string, Map<string, { name: string; team: string; position: string; bets: BetCardData[] }>>()
  for (const c of cards) {
    const group = groupFor(sport, c.player!.position, c.market)
    const g = byGroup.get(group) ?? new Map()
    const p = g.get(c.player!.name) ?? { name: c.player!.name, team: c.player!.team, position: c.player!.position, bets: [] }
    p.bets.push(c)
    g.set(c.player!.name, p)
    byGroup.set(group, g)
  }
  const best = (bets: BetCardData[]) => Math.max(...bets.map((b) => b.convictionScore))
  const props: PropGroup[] = Array.from(byGroup.entries())
    .map(([group, g]) => ({ group, players: Array.from(g.values()).map((p) => ({ ...p, bets: p.bets.sort((x, y) => y.convictionScore - x.convictionScore) })).sort((a, b) => best(b.bets) - best(a.bets)) }))
    .sort((a, b) => {
      const order = GROUP_ORDER[sport]
      const ia = order.indexOf(a.group)
      const ib = order.indexOf(b.group)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })

  // NBA starters vs bench: the five players with the highest scoring lines per team are the starters.
  if (sport === 'nba' && props.length === 1) {
    const all = props[0].players
    const lineOf = (p: (typeof all)[number]) => p.bets.find((b) => b.market === 'Points')?.leg.label.match(/(\d+(?:\.\d+)?)/g)?.pop()
    const rank = (team: string) => all.filter((p) => p.team === team).sort((a, b) => Number(lineOf(b) ?? 0) - Number(lineOf(a) ?? 0))
    const starters = new Set([...rank(away).slice(0, 5), ...rank(home).slice(0, 5)].map((p) => p.name))
    props.splice(0, 1, { group: 'Starters', players: all.filter((p) => starters.has(p.name)) }, { group: 'Bench', players: all.filter((p) => !starters.has(p.name)) })
  }

  return {
    sport,
    gameId,
    matchup,
    generatedAt: new Date().toISOString(),
    oddsSource: usingEstimates ? 'estimated' : 'real',
    note: usingEstimates ? 'Live odds temporarily unavailable - showing estimated lines' : null,
    linesUnavailable,
    gameLines,
    props: props.filter((g) => g.players.length > 0),
    propsNote,
    firstHalfNote: FIRST_HALF_NOTE[sport],
    priorSeasonOnly: game.priorSeasonOnly,
    season,
    seasonNote,
    unavailable: false,
  }
}

/** Recommended Bets for a game, cached an hour per game (the same odds cache the parlay builder reads). Never throws. */
export async function getRecommendedBets(sport: Sport, gameId: string, away: string, home: string, mode: PropsMode = 'live'): Promise<RecommendedBets> {
  const empty: RecommendedBets = { sport, gameId, matchup: `${away} @ ${home}`, generatedAt: new Date().toISOString(), oddsSource: 'estimated', note: null, gameLines: [], props: [], propsNote: null, firstHalfNote: FIRST_HALF_NOTE[sport], priorSeasonOnly: false, season: { isPreseason: false, isPlayoffs: false, isRegularSeason: true, isEarlySeason: false }, seasonNote: null, unavailable: true }
  try {
    const r = await cached(`edges:rec:${mode}:${sport}:${gameId}`, 3600, () => buildRecommended(sport, gameId, away, home, undefined, mode))
    return r ?? empty
  } catch (err) {
    reportError(err, 'recommended-bets')
    return empty
  }
}
