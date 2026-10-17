import type { ModuleInput } from '../modules/shared'
import type { ModuleOutput } from '../types'
import { cbbEvidence } from './cbb'
import { cfbEvidence } from './cfb'
import { mlbEvidence } from './mlb'
import { nbaEvidence } from './nba'
import { nflEvidence } from './nfl'
import { nhlEvidence } from './nhl'

/** The sport's evidence module: every team line and player prop for the game goes through one entry point per sport. */
export function sportEvidence(input: ModuleInput): ModuleOutput {
  switch (input.game.sport) {
    case 'mlb':
      return mlbEvidence(input)
    case 'nfl':
      return nflEvidence(input)
    case 'cfb':
      return cfbEvidence(input)
    case 'nba':
      return nbaEvidence(input)
    case 'cbb':
      return cbbEvidence(input)
    case 'nhl':
      return nhlEvidence(input)
  }
}
