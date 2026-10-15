import { getLineEvidence, getScoringMatchup } from '../data/lines'
import type { ModuleOutput } from '../types'
import type { ModuleInput } from './shared'

/** Team-line evidence common to every sport: records in tonight's situation from closing lines, and recent offense against defense. */
export function teamModule(input: ModuleInput): ModuleOutput {
  const a = getLineEvidence(input)
  const b = getScoringMatchup(input)
  return { edges: [...a.edges, ...b.edges], conflicts: a.conflicts + b.conflicts }
}
