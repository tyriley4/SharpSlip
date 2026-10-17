import { reportError } from '@/lib/monitoring/sentry'
import { scoreConviction } from './convictionScore'
import { getPlayerHistory } from './data/playerHistory'
import { loadGameContext } from './data/gameContext'
import { MIN_QUALITY, qualityOf } from './evidenceFramework'
import { horizonGroup, horizonOf } from './horizon'
import { stageEvidenceMultipliers } from './historicalRates'
import { synthesisFor } from './teamSynthesis'
import { passesEvidenceFilter } from './evidenceFilter'
import { primaryRate } from './primaryRate'
import { sportEvidence } from './sports'
import type { ModuleExtras, ModuleInput } from './modules/shared'
import { roleModule, type RoleOutput } from './roleContext'
import type { BettingOutcome, Edge, EdgeResult, GameContext, Grade, ModuleOutput, PlayerHistory } from './types'

const MAX_INSIGHTS = 8

const MODULES: { name: string; run: (i: ModuleInput) => ModuleOutput & Partial<Pick<RoleOutput, 'gradeCap'>> }[] = [
  { name: 'role', run: roleModule },
  { name: 'sport', run: sportEvidence },
]

const ORDER: Grade[] = ['F', 'D', 'C', 'B', 'A']

/**
 * Pure evaluation of one outcome against already-loaded context: runs the evidence modules (opportunity, statistical
 * support, situational), drops anything below the quality bar, then scores conviction with the market layer on top.
 * Nothing here fetches data, so the same context serves every outcome in a game.
 */
export function evaluateWithContext(outcome: BettingOutcome, game: GameContext, history: PlayerHistory | null, extras?: ModuleExtras): EdgeResult {
  const input: ModuleInput = { outcome, game, history, extras }
  const edges: Edge[] = []
  let conflicts = 0
  let gradeCap: { grade: Grade; note: string } | undefined
  for (const m of MODULES) {
    try {
      const out = m.run(input)
      edges.push(...out.edges)
      conflicts += out.conflicts
      if (out.gradeCap && (!gradeCap || ORDER.indexOf(out.gradeCap.grade) < ORDER.indexOf(gradeCap.grade))) gradeCap = out.gradeCap
    } catch (err) {
      reportError(err, `edge-module-${m.name}`)
    }
  }

  // Team synthesis: clusters of grade A/B player edges behind this team or total.
  const syn = synthesisFor(outcome, extras?.synthesis, game)
  edges.push(...syn.edges)

  const primary = primaryRate(input)
  const historicalRate = primary ? primary.rate : null
  // Career stage: an ascending player's career is context and his current season leads; a declining veteran's career flatters him.
  const mult = stageEvidenceMultipliers(history?.stage?.stage)
  // Only evidence that clears the quality bar and the evidence filter (records, real numbers, no pooled stats) can score.
  const surfaced = edges
    .filter((e) => qualityOf(e) >= MIN_QUALITY && passesEvidenceFilter(e))
    .map((e) => {
      if (mult.current === 1 && mult.career === 1) return e
      const g = horizonGroup(horizonOf(e))
      return g === 'historical' ? { ...e, weight: e.weight * mult.career } : g === 'current' ? { ...e, weight: e.weight * mult.current } : e
  })
  const hitSamples = surfaced.filter((e) => e.category === 'hit_rate').map((e) => e.sample ?? 0)
  const sampleSize = primary ? primary.games : hitSamples.length ? Math.max(...hitSamples) : 0

  const scoring = surfaced.filter((e) => e.weight > 0)
  const informational = surfaced.filter((e) => e.weight === 0)
  const conviction = scoreConviction({ edges: scoring, conflicts, historicalRate, impliedProbability: outcome.impliedProbability ?? null, sampleSize, season: game.season, gradeCap, synthesisMultiplier: syn.multiplier })

  // Ranked by priority tier (tonight-specific first, historical last), then by how directly each item bears on the bet.
  const ranked = [...scoring, ...informational].sort((a, b) => (a.tier ?? 9) - (b.tier ?? 9) || b.weight - a.weight || b.relevanceScore - a.relevanceScore || qualityOf(b) - qualityOf(a))

  return {
    grade: conviction.grade,
    convictionScore: conviction.convictionScore,
    historicalHitRate: historicalRate === null ? null : Math.round(historicalRate * 1000) / 10,
    edges: ranked.slice(0, MAX_INSIGHTS),
    isSharpFind: conviction.isSharpFind,
    sampleSize,
    limitedSample: conviction.limitedSample,
    ungradedReason: conviction.ungradedReason,
    gradeNote: conviction.gradeNote,
    conflicts,
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
