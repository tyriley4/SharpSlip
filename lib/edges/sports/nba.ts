import type { ModuleInput } from '../modules/shared'
import type { ModuleOutput } from '../types'
import { basketballEvidence } from './basketball'

/** NBA evidence: lines, totals and the points / rebounds / assists props (see basketball.ts for the framework). */
export function nbaEvidence(input: ModuleInput): ModuleOutput {
  return basketballEvidence(input, 'nba')
}
