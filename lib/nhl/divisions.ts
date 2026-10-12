export const NHL_TEAM_NAMES: Record<string, string> = {
  ANA: 'Anaheim Ducks',
  BOS: 'Boston Bruins',
  BUF: 'Buffalo Sabres',
  CAR: 'Carolina Hurricanes',
  CBJ: 'Columbus Blue Jackets',
  CGY: 'Calgary Flames',
  CHI: 'Chicago Blackhawks',
  COL: 'Colorado Avalanche',
  DAL: 'Dallas Stars',
  DET: 'Detroit Red Wings',
  EDM: 'Edmonton Oilers',
  FLA: 'Florida Panthers',
  LAK: 'Los Angeles Kings',
  MIN: 'Minnesota Wild',
  MTL: 'Montreal Canadiens',
  NJD: 'New Jersey Devils',
  NSH: 'Nashville Predators',
  NYI: 'New York Islanders',
  NYR: 'New York Rangers',
  OTT: 'Ottawa Senators',
  PHI: 'Philadelphia Flyers',
  PIT: 'Pittsburgh Penguins',
  SEA: 'Seattle Kraken',
  SJS: 'San Jose Sharks',
  STL: 'St. Louis Blues',
  TBL: 'Tampa Bay Lightning',
  TOR: 'Toronto Maple Leafs',
  UTA: 'Utah Mammoth',
  VAN: 'Vancouver Canucks',
  VGK: 'Vegas Golden Knights',
  WPG: 'Winnipeg Jets',
  WSH: 'Washington Capitals',
}

// Fallback conference/division map, used where a live standings lookup isn't available (e.g. the
// Games tab). The Standings page itself uses the live conferenceAbbrev/divisionName straight off
// the /standings response instead, since that's always authoritative.
export type NHLConference = 'Eastern' | 'Western'
export type NHLDivision = 'Atlantic' | 'Metropolitan' | 'Central' | 'Pacific'

export const NHL_TEAM_DIVISIONS: Record<string, NHLDivision> = {
  BOS: 'Atlantic', BUF: 'Atlantic', DET: 'Atlantic', FLA: 'Atlantic', MTL: 'Atlantic', OTT: 'Atlantic', TBL: 'Atlantic', TOR: 'Atlantic',
  CAR: 'Metropolitan', CBJ: 'Metropolitan', NJD: 'Metropolitan', NYI: 'Metropolitan', NYR: 'Metropolitan', PHI: 'Metropolitan', PIT: 'Metropolitan', WSH: 'Metropolitan',
  CHI: 'Central', COL: 'Central', DAL: 'Central', MIN: 'Central', NSH: 'Central', STL: 'Central', UTA: 'Central', WPG: 'Central',
  ANA: 'Pacific', CGY: 'Pacific', EDM: 'Pacific', LAK: 'Pacific', SEA: 'Pacific', SJS: 'Pacific', VAN: 'Pacific', VGK: 'Pacific',
}

export function nhlConference(abbr: string): NHLConference {
  const div = NHL_TEAM_DIVISIONS[abbr]
  return div === 'Atlantic' || div === 'Metropolitan' ? 'Eastern' : 'Western'
}

export const NHL_EAST_DIVISIONS: NHLDivision[] = ['Atlantic', 'Metropolitan']
export const NHL_WEST_DIVISIONS: NHLDivision[] = ['Central', 'Pacific']

// Stable numeric team IDs used by the separate api.nhle.com/stats/rest reporting API (team
// summary endpoint) — well-documented, long-stable constants from the NHL developer community.
export const NHL_TEAM_IDS: Record<string, number> = {
  NJD: 1, NYI: 2, NYR: 3, PHI: 4, PIT: 5, BOS: 6, BUF: 7, MTL: 8, OTT: 9, TOR: 10,
  CAR: 12, FLA: 13, TBL: 14, WSH: 15, CHI: 16, DET: 17, NSH: 18, STL: 19, CGY: 20,
  COL: 21, EDM: 22, VAN: 23, ANA: 24, DAL: 25, LAK: 26, SJS: 28, CBJ: 29, MIN: 30,
  WPG: 52, VGK: 54, SEA: 55, UTA: 59,
}

const NHL_TEAM_ID_TO_ABBR: Record<number, string> = Object.fromEntries(
  Object.entries(NHL_TEAM_IDS).map(([abbr, id]) => [id, abbr])
)

export function nhlAbbrFromTeamId(teamId: number): string {
  return NHL_TEAM_ID_TO_ABBR[teamId] ?? String(teamId)
}

export interface NHLArena {
  name: string
  city: string
  capacity: number
}

export const NHL_ARENAS: Record<string, NHLArena> = {
  ANA: { name: 'Honda Center', city: 'Anaheim, CA', capacity: 17174 },
  BOS: { name: 'TD Garden', city: 'Boston, MA', capacity: 17850 },
  BUF: { name: 'KeyBank Center', city: 'Buffalo, NY', capacity: 19070 },
  CAR: { name: 'Lenovo Center', city: 'Raleigh, NC', capacity: 18700 },
  CBJ: { name: 'Nationwide Arena', city: 'Columbus, OH', capacity: 18500 },
  CGY: { name: 'Scotiabank Saddledome', city: 'Calgary, AB', capacity: 19289 },
  CHI: { name: 'United Center', city: 'Chicago, IL', capacity: 19717 },
  COL: { name: 'Ball Arena', city: 'Denver, CO', capacity: 18007 },
  DAL: { name: 'American Airlines Center', city: 'Dallas, TX', capacity: 18532 },
  DET: { name: 'Little Caesars Arena', city: 'Detroit, MI', capacity: 19515 },
  EDM: { name: 'Rogers Place', city: 'Edmonton, AB', capacity: 18347 },
  FLA: { name: 'Amerant Bank Arena', city: 'Sunrise, FL', capacity: 19250 },
  LAK: { name: 'Crypto.com Arena', city: 'Los Angeles, CA', capacity: 18230 },
  MIN: { name: 'Grand Casino Arena', city: 'Saint Paul, MN', capacity: 17954 },
  MTL: { name: 'Bell Centre', city: 'Montreal, QC', capacity: 21105 },
  NJD: { name: 'Prudential Center', city: 'Newark, NJ', capacity: 16514 },
  NSH: { name: 'Bridgestone Arena', city: 'Nashville, TN', capacity: 17159 },
  NYI: { name: 'UBS Arena', city: 'Elmont, NY', capacity: 17255 },
  NYR: { name: 'Madison Square Garden', city: 'New York, NY', capacity: 18006 },
  OTT: { name: 'Canadian Tire Centre', city: 'Ottawa, ON', capacity: 18652 },
  PHI: { name: 'Wells Fargo Center', city: 'Philadelphia, PA', capacity: 19543 },
  PIT: { name: 'PPG Paints Arena', city: 'Pittsburgh, PA', capacity: 18387 },
  SEA: { name: 'Climate Pledge Arena', city: 'Seattle, WA', capacity: 17151 },
  SJS: { name: 'SAP Center', city: 'San Jose, CA', capacity: 17562 },
  STL: { name: 'Enterprise Center', city: 'St. Louis, MO', capacity: 18096 },
  TBL: { name: 'Amalie Arena', city: 'Tampa, FL', capacity: 19092 },
  TOR: { name: 'Scotiabank Arena', city: 'Toronto, ON', capacity: 18819 },
  UTA: { name: 'Delta Center', city: 'Salt Lake City, UT', capacity: 16819 },
  VAN: { name: 'Rogers Arena', city: 'Vancouver, BC', capacity: 18910 },
  VGK: { name: 'T-Mobile Arena', city: 'Las Vegas, NV', capacity: 17500 },
  WPG: { name: 'Canada Life Centre', city: 'Winnipeg, MB', capacity: 15321 },
  WSH: { name: 'Capital One Arena', city: 'Washington, DC', capacity: 18573 },
}

/** NHL season IDs are encoded YYYYZZZZ (e.g. 20262027 for the 2026-27 season). */
export function nhlCurrentSeasonId(asOf: Date = new Date()): number {
  // The season flips over in the fall; before ~August we're still in the season that started the
  // previous calendar year.
  const year = asOf.getUTCMonth() >= 7 ? asOf.getUTCFullYear() : asOf.getUTCFullYear() - 1
  return year * 10000 + (year + 1)
}

export function nhlSeasonLabel(seasonId: number): string {
  const start = Math.floor(seasonId / 10000)
  const end = seasonId % 10000
  return `${start}-${String(end).slice(-2)}`
}

export const NHL_CURRENT_SEASON = nhlCurrentSeasonId()
export const NHL_CURRENT_SEASON_LABEL = nhlSeasonLabel(NHL_CURRENT_SEASON)
