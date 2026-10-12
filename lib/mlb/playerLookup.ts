import { slugify } from '@/lib/players/slug'
import { getAllActivePlayers } from './api'

/** Resolves a player-page slug (e.g. "aaron-judge") to a live MLB person ID. */
export async function findMlbPlayerIdBySlug(slug: string): Promise<{ id: number; fullName: string } | null> {
  const players = await getAllActivePlayers()
  if (!players) return null
  return players.find((p) => slugify(p.fullName) === slug) ?? null
}

/** Resolves a list of known full names (e.g. the notable-players pool) to live MLB IDs in one pass. */
export async function resolvePlayerIds(names: string[]): Promise<{ id: number; fullName: string }[]> {
  const players = await getAllActivePlayers()
  if (!players) return []
  const bySlug = new Map(players.map((p) => [slugify(p.fullName), p]))
  return names.map((n) => bySlug.get(slugify(n))).filter((p): p is { id: number; fullName: string } => Boolean(p))
}
