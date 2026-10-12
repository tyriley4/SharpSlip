export const NHL_SKATER_GAME_STAT_CATEGORIES = ['PTS', 'G', 'A', '+/-', 'SOG', 'PIM', 'TOI', 'PPG', 'SHG', 'GWG'] as const
export const NHL_GOALIE_GAME_STAT_CATEGORIES = ['SV%', 'GAA', 'W', 'SO', 'SA', 'GA', 'MIN'] as const
export const NHL_TEAM_GAME_STAT_CATEGORIES = ['GF/G', 'GA/G', 'PP%', 'PK%', 'SOG/G', 'SA/G'] as const

export const NHL_SKATER_BETTING_CATEGORIES = ['Points', 'Goals', 'Assists', 'Shots on Goal'] as const
export type NHLSkaterBettingCategory = (typeof NHL_SKATER_BETTING_CATEGORIES)[number]

export const NHL_GOALIE_BETTING_CATEGORIES = ['Saves'] as const
export type NHLGoalieBettingCategory = (typeof NHL_GOALIE_BETTING_CATEGORIES)[number]

export const NHL_SKATER_BETTING_THRESHOLDS: Record<NHLSkaterBettingCategory, number[]> = {
  Points: [0.5, 1.5, 2.5, 3.5],
  Goals: [0.5, 1.5],
  Assists: [0.5, 1.5, 2.5],
  'Shots on Goal': [1.5, 2.5, 3.5, 4.5, 5.5],
}

export const NHL_GOALIE_BETTING_THRESHOLDS: Record<NHLGoalieBettingCategory, number[]> = {
  Saves: [19.5, 24.5, 29.5, 34.5],
}

export const NHL_SKATER_BETTING_STAT_KEY: Record<NHLSkaterBettingCategory, 'points' | 'goals' | 'assists' | 'shots'> = {
  Points: 'points',
  Goals: 'goals',
  Assists: 'assists',
  'Shots on Goal': 'shots',
}

// Player-page prop categories for goalies (distinct from the Leaders tab's Saves-only betting
// category — the player page also offers a Goals Allowed line per the NHL spec).
export const NHL_GOALIE_PLAYER_PROP_CATEGORIES = ['Saves', 'Goals Allowed'] as const
export type NHLGoaliePlayerPropCategory = (typeof NHL_GOALIE_PLAYER_PROP_CATEGORIES)[number]

export const NHL_GOALIE_PLAYER_PROP_THRESHOLDS: Record<NHLGoaliePlayerPropCategory, number[]> = {
  Saves: [19.5, 24.5, 29.5, 34.5],
  'Goals Allowed': [1.5, 2.5, 3.5],
}

export const NHL_GOALIE_PLAYER_PROP_STAT_KEY: Record<NHLGoaliePlayerPropCategory, 'saves' | 'goalsAgainst'> = {
  Saves: 'saves',
  'Goals Allowed': 'goalsAgainst',
}
