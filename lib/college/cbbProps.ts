/** Pure CBB prop-market constants shared by the leaders boards and the player-page calculator (safe for client code). */

export const CBB_SUBS = ['Players', 'Teams'] as const

export const CBB_GAME_CATEGORIES: Record<string, string[]> = {
  Players: ['PTS', 'REB', 'AST', 'BLK', 'STL', 'FG%', '3P%', 'FT%'],
  Teams: ['Points/G', 'Points Allowed/G', 'Reb/G', 'Ast/G', 'FG%', '3P%'],
}

export const CBB_BETTING_CATEGORIES = ['Points', 'Rebounds', 'Assists', '3-Pointers', 'PRA']

export const CBB_BETTING_THRESHOLDS: Record<string, number[]> = {
  Points: [9.5, 14.5, 19.5, 24.5, 29.5],
  Rebounds: [3.5, 4.5, 5.5, 6.5, 7.5],
  Assists: [2.5, 3.5, 4.5, 5.5],
  '3-Pointers': [0.5, 1.5, 2.5, 3.5],
  PRA: [19.5, 24.5, 29.5, 34.5, 39.5],
}

export const formatCbbThreshold = (_category: string, t: number) => `${t}+`
