import { reportError } from '@/lib/monitoring/sentry'
import { scoreConviction, edgeBaseScore } from './convictionScore'
import { getPlayerHistory } from './data/playerHistory'
import { loadGameContext } from './data/gameContext'
import { contextModule } from './modules/context'
import { h2hModule } from './modules/h2h'
import { hitRateModule, primaryRate } from './modules/hitRate'
import { matchupModule } from './modules/matchup'
import { recentFormModule } from './modules/recentForm'
import { situationalModule } from './modules/situational'
import type { ModuleInput } from './modules/shared'
import type { BettingOutcome, Edge, EdgeResult, GameContext, ModuleOutput, PlayerHistory } from './types'

const MAX_INSIGHTS = 8

const MODULES: { name: string; run: (i: ModuleInput) => ModuleOutput }[] = [
  { name: 'recentForm', run: recentFormModule },
  { name: 'hitRate', run: hitRateModule },
  { name: 'matchup', run: matchupModule },
  { name: 'situational', run: situationalModule },
  { name: 'h2h', run: h2hModule },
  { name: 'context', run: contextModule },
]

/**
 * Pure evaluation of one outcome against already-loaded context: runs the six evidence modules, scores conviction and
 * returns the supporting insights. Nothing here fetches data, so the same context serves every outcome in a game.
 */
export function evaluateWithContext(outcome: BettingOutcome, game: GameContext, history: PlayerHistory | null): EdgeResult {
  const input: ModuleInput = { outcome, game, history }
  const edges: Edge[] = []
  let conflicts = 0
  for (const m of MODULES) {
    try {
      const out = m.run(input)
      edges.push(...out.edges)
      conflicts += out.conflicts
    } catch (err) {
      reportError(err, `edge-module-${m.name}`)
    }
  }

  const primary = primaryRate(input)
  const historicalRate = primary ? primary.rate : null
  const hitSamples = edges.filter((e) => e.category === 'hit_rate').map((e) => e.sample ?? 0)
  const sampleSize = primary ? primary.games : hitSamples.length ? Math.max(...hitSamples) : 0

  const scoring = edges.filter((e) => e.weight > 0).sort((a, b) => edgeBaseScore(b) - edgeBaseScore(a))
  const informational = edges.filter((e) => e.weight === 0)
  const conviction = scoreConviction({ edges: scoring, conflicts, historicalRate, impliedProbability: outcome.impliedProbability ?? null, sampleSize })

  // Without a measurable history of this exact outcome there is nothing to grade, however many soft facts exist.
  const hasHistory = historicalRate !== null
  const grade = hasHistory ? conviction.grade : null

  return {
    grade,
    convictionScore: conviction.convictionScore,
    historicalHitRate: historicalRate === null ? null : Math.round(historicalRate * 1000) / 10,
    edges: [...scoring, ...informational].slice(0, MAX_INSIGHTS),
    isSharpFind: hasHistory && conviction.isSharpFind,
    sampleSize,
    limitedSample: conviction.limitedSample,
    ungradedReason: grade ? undefined : hasHistory ? 'Insufficient data' : 'Insufficient data',
  }
}

/** evaluateOutcome(outcome): loads (cached) game context and player history, then evaluates. Never throws. */
export async function evaluateOutcome(outcome: BettingOutcome, opts: { away: string; home: string }): Promise<EdgeResult> {
  try {
    const game = await loadGameContext(outcome.sport, outcome.gameId, opts.away, opts.home)
    const history = outcome.type === 'player_prop' && outcome.player && outcome.category ? await getPlayerHistory(outcome.sport, outcome.player.name, outcome.player.team, outcome.category) : null
    return evaluateWithContext(outcome, game, history)
  } catch (err) {
    reportError(err, 'edge-engine')
    return { grade: null, convictionScore: 0, historicalHitRate: null, edges: [], isSharpFind: false, sampleSize: 0, limitedSample: false, ungradedReason: 'Analysis unavailable' }
  }
}
