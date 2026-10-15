/**
 * College football data connections. The framework is the NFL's, with two college adjustments: opponents from the power
 * conferences count 1.3x and group-of-five opponents 0.8x, and home field is weighted more heavily (see the venue item
 * in the matchup module). Position-level target share, snap counts and depth charts are not published for college, so
 * those items are NFL-only; weather uses the venue's own indoor flag.
 */
export const CFB_POWER_CONFERENCES = ['Southeastern Conference', 'Big Ten Conference', 'Big 12 Conference', 'Atlantic Coast Conference', 'Pac-12 Conference']

/** Opponent-quality multiplier from the opponent's conference. */
export function cfbOpponentWeight(conference: string | undefined, abbr: string): number | undefined {
  if (!conference) return undefined
  return CFB_POWER_CONFERENCES.includes(conference) || abbr === 'ND' ? 1.3 : 0.8
}
