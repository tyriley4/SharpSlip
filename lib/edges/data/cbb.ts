import { CFB_POWER_CONFERENCES } from './cfb'

/**
 * College basketball data connections. The framework is the NBA's with conference strength weighting and a stronger home
 * court factor. The season opens in November; before then there is nothing current to analyse.
 */
export const CBB_POWER_CONFERENCES = [...CFB_POWER_CONFERENCES, 'Big East Conference']

/** Opponent-quality multiplier from the opponent's conference. */
export function cbbOpponentWeight(conference: string | undefined): number | undefined {
  if (!conference) return undefined
  return CBB_POWER_CONFERENCES.includes(conference) ? 1.2 : 0.85
}
