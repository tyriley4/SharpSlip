export const NBA_TEAM_NAMES: Record<string, string> = {
  ATL: 'Atlanta Hawks', BOS: 'Boston Celtics', BKN: 'Brooklyn Nets', CHA: 'Charlotte Hornets',
  CHI: 'Chicago Bulls', CLE: 'Cleveland Cavaliers', DAL: 'Dallas Mavericks', DEN: 'Denver Nuggets',
  DET: 'Detroit Pistons', GSW: 'Golden State Warriors', HOU: 'Houston Rockets', IND: 'Indiana Pacers',
  LAC: 'LA Clippers', LAL: 'Los Angeles Lakers', MEM: 'Memphis Grizzlies', MIA: 'Miami Heat',
  MIL: 'Milwaukee Bucks', MIN: 'Minnesota Timberwolves', NOP: 'New Orleans Pelicans', NYK: 'New York Knicks',
  OKC: 'Oklahoma City Thunder', ORL: 'Orlando Magic', PHI: 'Philadelphia 76ers', PHX: 'Phoenix Suns',
  POR: 'Portland Trail Blazers', SAC: 'Sacramento Kings', SAS: 'San Antonio Spurs', TOR: 'Toronto Raptors',
  UTA: 'Utah Jazz', WAS: 'Washington Wizards',
}

export const NBA_TEAM_DIVISIONS: Record<string, string> = {
  BOS: 'Atlantic', BKN: 'Atlantic', NYK: 'Atlantic', PHI: 'Atlantic', TOR: 'Atlantic',
  CHI: 'Central', CLE: 'Central', DET: 'Central', IND: 'Central', MIL: 'Central',
  ATL: 'Southeast', CHA: 'Southeast', MIA: 'Southeast', ORL: 'Southeast', WAS: 'Southeast',
  DEN: 'Northwest', MIN: 'Northwest', OKC: 'Northwest', POR: 'Northwest', UTA: 'Northwest',
  GSW: 'Pacific', LAC: 'Pacific', LAL: 'Pacific', PHX: 'Pacific', SAC: 'Pacific',
  DAL: 'Southwest', HOU: 'Southwest', MEM: 'Southwest', NOP: 'Southwest', SAS: 'Southwest',
}

export const NBA_EAST_DIVISIONS = ['Atlantic', 'Central', 'Southeast']
export const NBA_WEST_DIVISIONS = ['Northwest', 'Pacific', 'Southwest']

export function nbaConference(abbr: string): 'East' | 'West' | null {
  const div = NBA_TEAM_DIVISIONS[abbr]
  if (!div) return null
  return NBA_EAST_DIVISIONS.includes(div) ? 'East' : 'West'
}

/** Stable numeric stats.nba.com team IDs. */
export const NBA_TEAM_IDS: Record<string, number> = {
  ATL: 1610612737, BOS: 1610612738, BKN: 1610612751, CHA: 1610612766,
  CHI: 1610612741, CLE: 1610612739, DAL: 1610612742, DEN: 1610612743,
  DET: 1610612765, GSW: 1610612744, HOU: 1610612745, IND: 1610612754,
  LAC: 1610612746, LAL: 1610612747, MEM: 1610612763, MIA: 1610612748,
  MIL: 1610612749, MIN: 1610612750, NOP: 1610612740, NYK: 1610612752,
  OKC: 1610612760, ORL: 1610612753, PHI: 1610612755, PHX: 1610612756,
  POR: 1610612757, SAC: 1610612758, SAS: 1610612759, TOR: 1610612761,
  UTA: 1610612762, WAS: 1610612764,
}

const NBA_TEAM_ID_TO_ABBR: Record<number, string> = Object.fromEntries(
  Object.entries(NBA_TEAM_IDS).map(([abbr, id]) => [id, abbr])
)

export function nbaAbbrFromTeamId(teamId: number): string {
  return NBA_TEAM_ID_TO_ABBR[teamId] ?? String(teamId)
}

/** Real NBA arena reference data — stats.nba.com has no dedicated venues endpoint, and every current NBA arena is an enclosed/indoor building, so weather is always neutral. */
export const NBA_ARENAS: Record<string, { name: string; city: string; capacity: number }> = {
  ATL: { name: 'State Farm Arena', city: 'Atlanta', capacity: 16600 },
  BOS: { name: 'TD Garden', city: 'Boston', capacity: 19156 },
  BKN: { name: 'Barclays Center', city: 'Brooklyn', capacity: 17732 },
  CHA: { name: 'Spectrum Center', city: 'Charlotte', capacity: 19077 },
  CHI: { name: 'United Center', city: 'Chicago', capacity: 20917 },
  CLE: { name: 'Rocket Mortgage FieldHouse', city: 'Cleveland', capacity: 19432 },
  DAL: { name: 'American Airlines Center', city: 'Dallas', capacity: 19200 },
  DEN: { name: 'Ball Arena', city: 'Denver', capacity: 19520 },
  DET: { name: 'Little Caesars Arena', city: 'Detroit', capacity: 20332 },
  GSW: { name: 'Chase Center', city: 'San Francisco', capacity: 18064 },
  HOU: { name: 'Toyota Center', city: 'Houston', capacity: 18055 },
  IND: { name: 'Gainbridge Fieldhouse', city: 'Indianapolis', capacity: 17923 },
  LAC: { name: 'Intuit Dome', city: 'Inglewood', capacity: 18000 },
  LAL: { name: 'Crypto.com Arena', city: 'Los Angeles', capacity: 19060 },
  MEM: { name: 'FedExForum', city: 'Memphis', capacity: 17794 },
  MIA: { name: 'Kaseya Center', city: 'Miami', capacity: 19600 },
  MIL: { name: 'Fiserv Forum', city: 'Milwaukee', capacity: 17341 },
  MIN: { name: 'Target Center', city: 'Minneapolis', capacity: 18978 },
  NOP: { name: 'Smoothie King Center', city: 'New Orleans', capacity: 16867 },
  NYK: { name: 'Madison Square Garden', city: 'New York', capacity: 19812 },
  OKC: { name: 'Paycom Center', city: 'Oklahoma City', capacity: 18203 },
  ORL: { name: 'Kia Center', city: 'Orlando', capacity: 18846 },
  PHI: { name: 'Wells Fargo Center', city: 'Philadelphia', capacity: 20478 },
  PHX: { name: 'Footprint Center', city: 'Phoenix', capacity: 17071 },
  POR: { name: 'Moda Center', city: 'Portland', capacity: 19393 },
  SAC: { name: 'Golden 1 Center', city: 'Sacramento', capacity: 17608 },
  SAS: { name: 'Frost Bank Center', city: 'San Antonio', capacity: 18418 },
  TOR: { name: 'Scotiabank Arena', city: 'Toronto', capacity: 19800 },
  UTA: { name: 'Delta Center', city: 'Salt Lake City', capacity: 18306 },
  WAS: { name: 'Capital One Arena', city: 'Washington', capacity: 20356 },
}

/** The most recent NBA season that actually has real season-long data (games/standings/stats). */
export const NBA_CURRENT_SEASON = '2025-26'
export const NBA_NEXT_SEASON = '2026-27'

export function nbaSeasonStartYear(seasonString: string): number {
  return Number(seasonString.slice(0, 4))
}
