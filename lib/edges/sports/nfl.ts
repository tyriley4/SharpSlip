import type { ModuleInput } from '../modules/shared'
import type { ModuleOutput } from '../types'
import { footballEvidence } from './football'

/** NFL evidence: spreads, moneylines, totals and the QB / RB / WR / TE props (see football.ts for the framework). */
export function nflEvidence(input: ModuleInput): ModuleOutput {
  return footballEvidence(input, 'nfl')
}
