import { gameLineRows, type BetLine, type GameLines } from './lines'
import { combinedAmericanFromPrices, combinedProb, edgeToProb, gradeFromProb } from './math'
import type { GameOdds } from '@/lib/odds/types'
import type { Sport } from '@/lib/sport/SportContext'

export interface InsightLeg {
  key: string
  label: string
  typeLabel: string
  grade: string
  conf: number
  /** Team the insight is about, when it names one. */
  team: string | null
  /** Extra text (line / alt play) used to read a totals lean. */
  detail: string
}

/** A game plus everything needed to build lines and legs for it (serializable). */
export interface ParlayGame {
  sport: Sport
  gameId: string
  href: string
  awayAbbr: string
  homeAbbr: string
  startTime: string | null
  network: string | null
  status: string
  favorite: string | null
  /** Real posted lines for this game; null when no book has it (the game then can't be priced for suggestions). */
  odds: GameOdds | null
  insights: InsightLeg[]
}

export interface PoolLeg {
  lineId: string
  sport: Sport
  gameId: string
  matchup: string
  label: string
  typeLabel: string
  odds: number
  prob: number
  grade: 'A' | 'B' | 'C'
  source: 'insight' | 'line'
  /** Sportsbook this price is from. */
  book: string
}

export type RiskLevel = 'conservative' | 'moderate' | 'aggressive'
export type TargetOdds = 'none' | '200-400' | '400-800' | '800-1500' | '1500+'

export interface SuggestFilters {
  legs: 2 | 3 | 4 | 5
  risk: RiskLevel
  sport: Sport | 'all'
  target: TargetOdds
}

export interface SuggestedParlay {
  legs: PoolLeg[]
  prob: number
  odds: number
}

export interface SuggestResult {
  parlays: SuggestedParlay[]
  reason: 'ok' | 'insufficient' | 'target'
}

/** The game's real posted lines as bettable rows (empty when no book has posted it). */
export function gameLines(game: ParlayGame): GameLines {
  return { gameLines: game.odds ? gameLineRows(game.odds) : [], props: [] }
}

function tier(grade: string): 'A' | 'B' | 'C' {
  if (grade.startsWith('A')) return 'A'
  if (grade.startsWith('B')) return 'B'
  return 'C'
}

function poolLeg(line: BetLine, prob: number, grade: 'A' | 'B' | 'C', source: PoolLeg['source']): PoolLeg {
  return {
    lineId: line.id,
    sport: line.sport,
    gameId: line.gameId,
    matchup: line.matchup,
    label: line.label,
    typeLabel: line.market,
    odds: line.odds,
    prob,
    grade,
    source,
    book: line.book,
  }
}

/**
 * Every leg we could responsibly suggest from today's slate. Each one is priced at a real posted line:
 * insights that name a team are expressed as that team's moneyline, totals insights as the posted
 * over/under, and the market's strongest moneyline side is added as a baseline. Games no book has
 * posted are left out rather than priced with a guess.
 */
export function buildPool(games: ParlayGame[]): PoolLeg[] {
  const byLine = new Map<string, PoolLeg>()
  const keep = (leg: PoolLeg) => {
    const prev = byLine.get(leg.lineId)
    if (!prev || leg.prob > prev.prob) byLine.set(leg.lineId, leg)
  }

  for (const g of games) {
    if (!g.odds) continue
    const rows = gameLineRows(g.odds)
    const ml = rows.find((r) => r.title === 'Moneyline')
    const total = rows.find((r) => r.title === 'Total')

    for (const ins of g.insights) {
      const prob = edgeToProb(ins.conf)
      const grade = tier(ins.grade)
      if (ml && ins.team) {
        const side = ml.options.find((o) => o.label === `${ins.team} ML`)
        if (side) keep({ ...poolLeg(side, prob, grade, 'insight'), label: `${ins.team} ML`, typeLabel: ins.typeLabel })
      } else if (total && /total/i.test(ins.typeLabel)) {
        const text = `${ins.label} ${ins.detail}`.toLowerCase()
        const side = text.includes('under') ? total.options[1] : text.includes('over') || text.includes('high-scoring') ? total.options[0] : null
        if (side) keep(poolLeg(side, prob, grade, 'insight'))
      }
    }

    if (ml) {
      const best = ml.options[0].prob >= ml.options[1].prob ? ml.options[0] : ml.options[1]
      keep(poolLeg(best, best.prob, gradeFromProb(best.prob), 'line'))
    }
  }
  return Array.from(byLine.values())
}

const RISK_GRADES: Record<RiskLevel, ('A' | 'B' | 'C')[]> = {
  conservative: ['A'],
  moderate: ['A', 'B'],
  aggressive: ['A', 'B', 'C'],
}

function inTarget(odds: number, target: TargetOdds): boolean {
  switch (target) {
    case 'none':
      return true
    case '200-400':
      return odds >= 200 && odds <= 400
    case '400-800':
      return odds >= 400 && odds <= 800
    case '800-1500':
      return odds >= 800 && odds <= 1500
    case '1500+':
      return odds >= 1500
  }
}

function overlap(a: PoolLeg[], b: PoolLeg[]): number {
  const ids = new Set(a.map((l) => l.lineId))
  return b.filter((l) => ids.has(l.lineId)).length
}

const MAX_CANDIDATES = 14
const MAX_PER_GAME = 2

export function suggestParlays(pool: PoolLeg[], filters: SuggestFilters, count = 3): SuggestResult {
  const allowed = RISK_GRADES[filters.risk]
  const eligible = pool
    .filter((l) => (filters.sport === 'all' || l.sport === filters.sport) && allowed.includes(l.grade))
    .sort((a, b) => b.prob - a.prob)

  // Keep the strongest couple of legs per game so combinations stay varied but bounded.
  const perGame = new Map<string, number>()
  const seenLine = new Set<string>()
  const candidates: PoolLeg[] = []
  for (const leg of eligible) {
    if (seenLine.has(leg.lineId)) continue
    const key = `${leg.sport}-${leg.gameId}`
    const used = perGame.get(key) ?? 0
    if (used >= MAX_PER_GAME) continue
    perGame.set(key, used + 1)
    seenLine.add(leg.lineId)
    candidates.push(leg)
    if (candidates.length >= MAX_CANDIDATES) break
  }

  const n = filters.legs
  const distinctGames = new Set(candidates.map((c) => `${c.sport}-${c.gameId}`)).size
  if (distinctGames < n) return { parlays: [], reason: 'insufficient' }

  // Enumerate combinations with one leg per game (legs from the same game are correlated).
  const combos: SuggestedParlay[] = []
  const walk = (start: number, chosen: PoolLeg[], games: Set<string>) => {
    if (chosen.length === n) {
      const probs = chosen.map((c) => c.prob)
      const odds = combinedAmericanFromPrices(chosen.map((c) => c.odds))
      if (odds !== null) combos.push({ legs: [...chosen], prob: combinedProb(probs), odds })
      return
    }
    for (let i = start; i < candidates.length; i++) {
      const c = candidates[i]
      const key = `${c.sport}-${c.gameId}`
      if (games.has(key)) continue
      games.add(key)
      chosen.push(c)
      walk(i + 1, chosen, games)
      chosen.pop()
      games.delete(key)
    }
  }
  walk(0, [], new Set())

  const matching = combos.filter((c) => inTarget(c.odds, filters.target)).sort((a, b) => b.prob - a.prob)
  if (matching.length === 0) return { parlays: [], reason: combos.length === 0 ? 'insufficient' : 'target' }

  const chosen: SuggestedParlay[] = []
  for (const maxShared of [Math.floor(n / 2), n - 1]) {
    for (const combo of matching) {
      if (chosen.length >= count) break
      if (chosen.includes(combo)) continue
      if (chosen.every((c) => overlap(c.legs, combo.legs) <= maxShared)) chosen.push(combo)
    }
  }
  return { parlays: chosen.sort((a, b) => b.prob - a.prob), reason: 'ok' }
}
