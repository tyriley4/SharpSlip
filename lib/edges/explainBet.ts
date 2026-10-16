import { generateBetExplanation } from './explanationGenerator'
import type { BetCardData } from './recommended'

/** The written explanation for a graded bet, from the evidence already on its card (pure, so it runs on the server or in the browser). */
export function explainBet(bet: Pick<BetCardData, 'explain' | 'convictionScore' | 'grade' | 'description' | 'limitedSample' | 'gradeNote' | 'historicalHitRate' | 'isSharpFind'>): string | null {
  const x = bet.explain
  if (!x) return null
  return generateBetExplanation(x.outcome, x.evidence, bet.convictionScore, bet.grade ?? 'F', x.context, {
    description: bet.description,
    conflicts: x.conflicts,
    limitedSample: bet.limitedSample,
    gradeNote: bet.gradeNote,
    historicalHitRate: bet.historicalHitRate,
    impliedProbability: x.impliedProbability,
    isSharpFind: bet.isSharpFind,
  })
}
