import { buildCbbPlayerProfile, findCbbPlayerBySlug } from '@/lib/cbb/playerProfile'
import { cfbPlayerGames, findCfbPlayerBySlug } from '@/lib/cfb/playerProfile'
import { findMlbPlayerIdBySlug } from '@/lib/mlb/playerLookup'
import { findNbaPlayerIdBySlug } from '@/lib/nba/playerLookup'
import { findNhlSkaterIdBySlug } from '@/lib/nhl/playerLookup'
import { cached } from '@/lib/net/ttlCache'
import { slugify } from '@/lib/players/slug'
import { getCareerPayload, findNflPlayerId } from '@/lib/props/careerLogs'
import type { Sport } from '@/lib/sport/SportContext'
import type { PlayerHistory } from '../types'
import { loadCareerStage } from './careerStage'

/** Maps a sportsbook prop market label to the stat category used in game logs. */
export function categoryForMarket(sport: Sport, marketLabel: string): string | null {
  const m = marketLabel.toLowerCase()
  if (sport === 'mlb') return m === 'hits' ? 'Hits' : m === 'home runs' ? 'Home Runs' : m === 'strikeouts' ? 'Strikeouts' : null
  if (sport === 'nfl' || sport === 'cfb') return m === 'passing yards' ? 'Pass Yards' : m === 'rushing yards' ? 'Rush Yards' : m === 'receiving yards' ? 'Receiving Yards' : m === 'receptions' ? 'Receptions' : null
  if (sport === 'nba' || sport === 'cbb') return m === 'points' ? 'Points' : m === 'rebounds' ? 'Rebounds' : m === 'assists' ? 'Assists' : null
  if (sport === 'nhl') return m === 'points' ? 'Points' : m === 'shots on goal' ? 'Shots on Goal' : m === 'assists' ? 'Assists' : null
  return null
}

/**
 * A player multi-season game history keyed by stat category, found by name. Pro sports pull up to five seasons;
 * college sports have the current season only (the feeds carry no earlier college logs). Cached 24 hours.
 * Returns null when the player cannot be resolved or has no games - callers then leave the bet ungraded.
 */
export async function getPlayerHistory(sport: Sport, name: string, team: string, category: string, opts: { pitching?: boolean } = {}): Promise<PlayerHistory | null> {
  const h = await rawPlayerHistory(sport, name, team, category, opts)
  if (!h || h.stage !== undefined) return h
  const stage = await loadCareerStage(sport, h, { pitching: opts.pitching ?? category === 'Strikeouts' }).catch(() => null)
  return stage ? { ...h, stage } : h
}

async function rawPlayerHistory(sport: Sport, name: string, team: string, category: string, opts: { pitching?: boolean } = {}): Promise<PlayerHistory | null> {
  const pitching = opts.pitching ?? category === 'Strikeouts'
  const slug = slugify(name)
  const key = `edges:player:${sport}:${slug}:${team}:${pitching ? 'p' : 'h'}`
  return cached(key, 86400, async () => {
    try {
      if (sport === 'mlb') {
        const found = await findMlbPlayerIdBySlug(slug)
        if (!found) return null
        const payload = await getCareerPayload({ sport: 'mlb', playerId: String(found.id), group: pitching ? 'pitching' : 'hitting', scope: 'career' })
        return payload ? { playerId: String(found.id), name: found.fullName, team, position: pitching ? 'P' : '', games: payload.games } : null
      }
      if (sport === 'nba') {
        const found = await findNbaPlayerIdBySlug(slug)
        if (!found) return null
        const payload = await getCareerPayload({ sport: 'nba', playerId: String(found.id), scope: 'career' })
        return payload ? { playerId: String(found.id), name: found.fullName, team, position: '', games: payload.games } : null
      }
      if (sport === 'nhl') {
        const found = await findNhlSkaterIdBySlug(slug)
        if (!found) return null
        const payload = await getCareerPayload({ sport: 'nhl', playerId: String(found.id), scope: 'career' })
        return payload ? { playerId: String(found.id), name: found.fullName, team, position: '', games: payload.games } : null
      }
      if (sport === 'nfl') {
        const found = await findNflPlayerId(slug, team)
        if (!found) return null
        const payload = await getCareerPayload({ sport: 'nfl', playerId: found.id, scope: 'career' })
        return payload ? { playerId: found.id, name, team: found.team, position: found.position, games: payload.games } : null
      }
      if (sport === 'cfb') {
        const ref = findCfbPlayerBySlug(slug, team)
        if (!ref) return null
        const { games } = cfbPlayerGames(ref.playerId)
        if (games.length === 0) return null
        const season = String(new Date(games[0].date).getUTCFullYear())
        return {
          playerId: ref.playerId,
          name: ref.name,
          team: ref.team,
          position: '',
          games: games.map((g) => ({ season, date: g.date.slice(0, 10), home: g.home, opp: g.opp, values: Object.fromEntries(Object.entries(g.values).filter(([, v]) => v !== null)) as Record<string, number> })),
        }
      }
      if (sport === 'cbb') {
        const ref = await findCbbPlayerBySlug(slug, team)
        if (!ref) return null
        const profile = await buildCbbPlayerProfile(ref, slug)
        if (!profile) return null
        return {
          playerId: ref.playerId,
          name: ref.name,
          team: profile.row.team,
          position: profile.row.position,
          games: profile.games.map((g) => ({ season: profile.seasonLabel, date: g.date.slice(0, 10), home: g.home, opp: g.opp, values: Object.fromEntries(Object.entries(g.values).filter(([, v]) => v !== null)) as Record<string, number> })),
        }
      }
      return null
    } catch {
      return null
    }
  })
}
