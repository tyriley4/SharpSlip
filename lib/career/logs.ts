import { getPlayerGameLog, type RawGameLogEntry } from '@/lib/mlb/api'
import { getNBAPlayerGameLog, type NBAPlayerGameLogRow } from '@/lib/nba/api'
import { getNHLPlayerGameLog, type NHLPlayerGameLogRow } from '@/lib/nhl/api'
import { mlbCareerSeasons, nbaCareerSeasons, nhlCareerSeasons } from './seasons'

/** True when the time window asks for multi-season history. */
export function isCareer(window: string): boolean {
  return window === 'Career'
}

/** A player's MLB game log — this season, or (Career) the last several seasons stitched oldest-first. */
export async function mlbLog(id: number, group: 'hitting' | 'pitching', career: boolean): Promise<RawGameLogEntry[] | null> {
  if (!career) return getPlayerGameLog(id, group)
  const parts = await Promise.all(mlbCareerSeasons().map((y) => getPlayerGameLog(id, group, y)))
  const all = parts.flatMap((p) => p ?? [])
  return all.length > 0 ? all : null
}

export async function nhlLog(id: number, career: boolean): Promise<NHLPlayerGameLogRow[] | null> {
  if (!career) return getNHLPlayerGameLog(id)
  const parts = await Promise.all(nhlCareerSeasons().map((s) => getNHLPlayerGameLog(id, s)))
  const all = parts.flatMap((p) => p ?? [])
  return all.length > 0 ? all : null
}

export async function nbaLog(id: number, season: string, career: boolean): Promise<NBAPlayerGameLogRow[] | null> {
  if (!career) return getNBAPlayerGameLog(id, season)
  const parts = await Promise.all(nbaCareerSeasons().map((s) => getNBAPlayerGameLog(id, s)))
  const all = parts.flatMap((p) => p ?? [])
  return all.length > 0 ? all : null
}
