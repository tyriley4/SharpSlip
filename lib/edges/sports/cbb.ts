import type { ModuleInput } from '../modules/shared'
import type { ModuleOutput } from '../types'
import { basketballEvidence } from './basketball'

/** College basketball evidence: the NBA framework with conference-strength weighting and the home-court record (KenPom ratings are not available). */
export function cbbEvidence(input: ModuleInput): ModuleOutput {
  return basketballEvidence(input, 'cbb')
}
