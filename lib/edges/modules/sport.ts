import { getTeamGameContext, getStarterEvidence } from '../data/mlb'
import { getNbaEvidence } from '../data/nba'
import { getGameTotalEvidence, getNflTeamEvidence, getQBEvidence, getRBRushingEvidence, getReceiverEvidence } from '../data/nfl'
import { getNhlEvidence } from '../data/nhl'
import type { ModuleOutput } from '../types'
import type { ModuleInput } from './shared'

const merge = (...outs: ModuleOutput[]): ModuleOutput => ({ edges: outs.flatMap((o) => o.edges), conflicts: outs.reduce((n, o) => n + o.conflicts, 0) })

/**
 * The sport-specific evidence, built from the data each sport's loader brought in: starter, lineup, series and bullpen for
 * MLB; target share, snaps, position-specific defense and the cornerback situation for the NFL; goalies and special
 * teams for the NHL; schedule fatigue for the NBA. College football and basketball use the shared modules.
 */
export function sportModule(input: ModuleInput): ModuleOutput {
  switch (input.game.sport) {
    case 'mlb':
      return merge(getStarterEvidence(input), getTeamGameContext(input))
    case 'nfl':
      return merge(getReceiverEvidence(input), getRBRushingEvidence(input), getQBEvidence(input), getGameTotalEvidence(input), getNflTeamEvidence(input))
    case 'nhl':
      return getNhlEvidence(input)
    case 'nba':
      return getNbaEvidence(input)
    default:
      return { edges: [], conflicts: 0 }
  }
}
