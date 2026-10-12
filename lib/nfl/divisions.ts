/** nflverse uses some historical/alternate abbreviations that differ from this app's team-color keys. */
export const NFL_TEAM_ABBR_ALIASES: Record<string, string> = {
  LA: 'LAR',
  OAK: 'LV',
  SD: 'LAC',
  STL: 'LAR',
}

export function normalizeNflAbbr(abbr: string): string {
  return NFL_TEAM_ABBR_ALIASES[abbr] ?? abbr
}

export const NFL_TEAM_NAMES: Record<string, string> = {
  BUF: 'Buffalo Bills', MIA: 'Miami Dolphins', NE: 'New England Patriots', NYJ: 'New York Jets',
  BAL: 'Baltimore Ravens', CIN: 'Cincinnati Bengals', CLE: 'Cleveland Browns', PIT: 'Pittsburgh Steelers',
  HOU: 'Houston Texans', IND: 'Indianapolis Colts', JAX: 'Jacksonville Jaguars', TEN: 'Tennessee Titans',
  DEN: 'Denver Broncos', KC: 'Kansas City Chiefs', LV: 'Las Vegas Raiders', LAC: 'Los Angeles Chargers',
  DAL: 'Dallas Cowboys', NYG: 'New York Giants', PHI: 'Philadelphia Eagles', WAS: 'Washington Commanders',
  CHI: 'Chicago Bears', DET: 'Detroit Lions', GB: 'Green Bay Packers', MIN: 'Minnesota Vikings',
  ATL: 'Atlanta Falcons', CAR: 'Carolina Panthers', NO: 'New Orleans Saints', TB: 'Tampa Bay Buccaneers',
  ARI: 'Arizona Cardinals', LAR: 'Los Angeles Rams', SF: 'San Francisco 49ers', SEA: 'Seattle Seahawks',
}

/** City (for weather lookups) for each team's home venue — teams whose name isn't the city are mapped explicitly. */
export const NFL_TEAM_CITY: Record<string, string> = {
  BUF: 'Buffalo', MIA: 'Miami', NE: 'Foxborough', NYJ: 'East Rutherford',
  BAL: 'Baltimore', CIN: 'Cincinnati', CLE: 'Cleveland', PIT: 'Pittsburgh',
  HOU: 'Houston', IND: 'Indianapolis', JAX: 'Jacksonville', TEN: 'Nashville',
  DEN: 'Denver', KC: 'Kansas City', LV: 'Las Vegas', LAC: 'Inglewood',
  DAL: 'Arlington', NYG: 'East Rutherford', PHI: 'Philadelphia', WAS: 'Landover',
  CHI: 'Chicago', DET: 'Detroit', GB: 'Green Bay', MIN: 'Minneapolis',
  ATL: 'Atlanta', CAR: 'Charlotte', NO: 'New Orleans', TB: 'Tampa',
  ARI: 'Glendale', LAR: 'Inglewood', SF: 'Santa Clara', SEA: 'Seattle',
}

export const NFL_TEAM_DIVISIONS: Record<string, string> = {
  BUF: 'AFC East', MIA: 'AFC East', NE: 'AFC East', NYJ: 'AFC East',
  BAL: 'AFC North', CIN: 'AFC North', CLE: 'AFC North', PIT: 'AFC North',
  HOU: 'AFC South', IND: 'AFC South', JAX: 'AFC South', TEN: 'AFC South',
  DEN: 'AFC West', KC: 'AFC West', LV: 'AFC West', LAC: 'AFC West',
  DAL: 'NFC East', NYG: 'NFC East', PHI: 'NFC East', WAS: 'NFC East',
  CHI: 'NFC North', DET: 'NFC North', GB: 'NFC North', MIN: 'NFC North',
  ATL: 'NFC South', CAR: 'NFC South', NO: 'NFC South', TB: 'NFC South',
  ARI: 'NFC West', LAR: 'NFC West', SF: 'NFC West', SEA: 'NFC West',
}
