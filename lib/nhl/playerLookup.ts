import { slugify } from '@/lib/players/slug'
import { getAllNHLGoalieStats, getAllNHLSkaterStats, type NHLGoalieSeasonStats, type NHLSkaterSeasonStats } from './api'

/** Resolves a player-page slug (e.g. "connor-mcdavid") to a live NHL skater ID. */
export async function findNhlSkaterIdBySlug(slug: string): Promise<{ id: number; fullName: string } | null> {
  const players = await getAllNHLSkaterStats()
  if (!players) return null
  const match = players.find((p) => slugify(p.name) === slug)
  return match ? { id: match.playerId, fullName: match.name } : null
}

export async function findNhlGoalieIdBySlug(slug: string): Promise<{ id: number; fullName: string } | null> {
  const players = await getAllNHLGoalieStats()
  if (!players) return null
  const match = players.find((p) => slugify(p.name) === slug)
  return match ? { id: match.playerId, fullName: match.name } : null
}

/** Tries skaters first (the larger pool), then goalies. */
export async function findNhlPlayerIdBySlug(slug: string): Promise<{ id: number; fullName: string } | null> {
  const skater = await findNhlSkaterIdBySlug(slug)
  if (skater) return skater
  return findNhlGoalieIdBySlug(slug)
}

export async function resolveNhlSkaterIds(names: string[]): Promise<NHLSkaterSeasonStats[]> {
  const players = await getAllNHLSkaterStats()
  if (!players) return []
  const bySlug = new Map(players.map((p) => [slugify(p.name), p]))
  return names.map((n) => bySlug.get(slugify(n))).filter((p): p is NHLSkaterSeasonStats => Boolean(p))
}

export async function resolveNhlGoalieIds(names: string[]): Promise<NHLGoalieSeasonStats[]> {
  const players = await getAllNHLGoalieStats()
  if (!players) return []
  const bySlug = new Map(players.map((p) => [slugify(p.name), p]))
  return names.map((n) => bySlug.get(slugify(n))).filter((p): p is NHLGoalieSeasonStats => Boolean(p))
}
