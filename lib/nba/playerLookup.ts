import { slugify } from '@/lib/players/slug'
import { getAllNBAPlayerSeasonStats, type NBAPlayerSeasonStats } from './api'

/** Resolves a player-page slug (e.g. "nikola-jokic") to a live NBA Stats player ID. */
export async function findNbaPlayerIdBySlug(slug: string): Promise<{ id: number; fullName: string } | null> {
  const players = await getAllNBAPlayerSeasonStats()
  if (!players) return null
  const match = players.find((p) => slugify(p.name) === slug)
  return match ? { id: match.playerId, fullName: match.name } : null
}

/** Resolves a list of known full names (e.g. the notable-players pool) to live NBA IDs in one pass. */
export async function resolveNbaPlayerIds(names: string[]): Promise<NBAPlayerSeasonStats[]> {
  const players = await getAllNBAPlayerSeasonStats()
  if (!players) return []
  const bySlug = new Map(players.map((p) => [slugify(p.name), p]))
  return names.map((n) => bySlug.get(slugify(n))).filter((p): p is NBAPlayerSeasonStats => Boolean(p))
}
