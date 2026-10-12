'use client'

import { useCallback, useState } from 'react'
import type { BoardRow } from './types'

/** Team → Player selection: the team narrows the board, the players are highlighted for comparison. */
export interface TeamFilterValue {
  team: string
  players: string[]
}

export const ALL_TEAMS = 'All Teams'
export const EMPTY_TEAM_FILTER: TeamFilterValue = { team: ALL_TEAMS, players: [] }

export function teamFilterActive(f: TeamFilterValue): boolean {
  return f.team !== ALL_TEAMS
}

/** Keeps only the chosen team's players and renumbers ranks within that team. */
export function applyTeamFilter(rows: BoardRow[], f: TeamFilterValue): BoardRow[] {
  if (!teamFilterActive(f)) return rows
  return rows.filter((r) => r.team === f.team).map((r, i) => ({ ...r, rank: i + 1 }))
}

export function useTeamFilter() {
  const [value, setValue] = useState<TeamFilterValue>(EMPTY_TEAM_FILTER)

  const setTeam = useCallback((team: string) => setValue({ team, players: [] }), [])
  const togglePlayer = useCallback(
    (name: string) =>
      setValue((v) => ({ ...v, players: v.players.includes(name) ? v.players.filter((p) => p !== name) : [...v.players, name] })),
    []
  )
  const clear = useCallback(() => setValue(EMPTY_TEAM_FILTER), [])

  return { value, setTeam, togglePlayer, clear }
}

export type TeamFilterController = ReturnType<typeof useTeamFilter>
