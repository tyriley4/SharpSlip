export const HITTER_CATEGORIES: { label: string; param: string }[] = [
  { label: 'AVG', param: 'battingAverage' },
  { label: 'HR', param: 'homeRuns' },
  { label: 'RBI', param: 'runsBattedIn' },
  { label: 'OPS', param: 'onBasePlusSlugging' },
  { label: 'OBP', param: 'onBasePercentage' },
  { label: 'SLG', param: 'sluggingPercentage' },
  { label: 'H', param: 'hits' },
  { label: 'R', param: 'runs' },
  { label: 'SB', param: 'stolenBases' },
  { label: 'K', param: 'strikeouts' },
]

/** API-backed pitcher categories. "QS" is handled separately — the leaders endpoint has no quality-starts category. */
export const PITCHER_API_CATEGORIES: { label: string; param: string }[] = [
  { label: 'ERA', param: 'earnedRunAverage' },
  { label: 'W', param: 'wins' },
  { label: 'K', param: 'strikeouts' },
  { label: 'WHIP', param: 'walksAndHitsPerInningPitched' },
  { label: 'K/9', param: 'strikeoutsPer9Inn' },
  { label: 'BB/9', param: 'walksPer9Inn' },
  { label: 'SV', param: 'saves' },
  { label: 'HLD', param: 'holds' },
]

export const PITCHER_CATEGORY_LABELS = [...PITCHER_API_CATEGORIES.map((c) => c.label), 'QS']

export const TEAM_CATEGORIES: { label: string; group: 'hitting' | 'pitching'; field: string; perGame?: boolean; ascending?: boolean }[] = [
  { label: 'R/G', group: 'hitting', field: 'runs', perGame: true },
  { label: 'ERA', group: 'pitching', field: 'era', ascending: true },
  { label: 'AVG', group: 'hitting', field: 'avg' },
  { label: 'HR', group: 'hitting', field: 'homeRuns' },
  { label: 'SB', group: 'hitting', field: 'stolenBases' },
  { label: 'OBP', group: 'hitting', field: 'obp' },
]
