/**
 * Roof facts. Weather is only ever shown for open-air venues: domes and closed retractable roofs never get a forecast,
 * and NBA, NHL and indoor college basketball never have weather at all.
 */

/** True when a team plays its home games under a roof (a dome or a retractable roof that is normally closed). */
export const nflRoofedHome = (abbr: string) => NFL_ROOFED.has(abbr)

/** NFL home teams whose stadium is a dome or a retractable roof that is normally closed (SoFi is covered). */
const NFL_ROOFED = new Set(['DAL', 'ARI', 'LV', 'IND', 'DET', 'MIN', 'ATL', 'NO', 'LAR', 'LAC', 'HOU'])
/** Retractable NFL roofs: open-air only when the schedule explicitly says the roof is open. */
const NFL_RETRACTABLE = new Set(['DAL', 'ARI', 'IND', 'ATL', 'HOU'])

/** True when an NFL game is indoors. `roof` is the nflverse schedule roof value ("dome", "closed", "open", "outdoors"). */
export function nflIndoors(home: string, roof: string | null | undefined): boolean {
  const r = (roof ?? '').toLowerCase()
  if (r === 'dome' || r === 'closed') return true
  if (r === 'outdoors') return false
  if (r === 'open') return !NFL_RETRACTABLE.has(home) && NFL_ROOFED.has(home)
  return NFL_ROOFED.has(home)
}

/** MLB: Tropicana Field is a fixed dome; the rest are retractable and need the game-time roof status. */
const MLB_FIXED_DOME = new Set(['TB'])
const MLB_RETRACTABLE = new Set(['TOR', 'HOU', 'TEX', 'AZ', 'ARI', 'MIL', 'MIA'])

export type MlbRoof = 'fixed' | 'retractable' | 'open-air'

export function mlbRoofType(home: string): MlbRoof {
  return MLB_FIXED_DOME.has(home) ? 'fixed' : MLB_RETRACTABLE.has(home) ? 'retractable' : 'open-air'
}

/** Sports that are always played indoors (or have no weather feed): never show weather. */
export const ALWAYS_INDOOR = new Set(['nba', 'nhl', 'cbb'])
