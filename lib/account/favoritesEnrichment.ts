import { getTodaysGames as getTodaysMlbGames, getMlbTeamsIndex, getStandings as getMlbStandings } from '@/lib/mlb/api'
import { mapScheduleGame, mapStandings } from '@/lib/mlb/mappers'
import { findMlbPlayerIdBySlug } from '@/lib/mlb/playerLookup'
import { buildLiveMlbPlayerRow } from '@/lib/mlb/playerProfile'
import { getActiveNFLSeason, getNFLSchedule } from '@/lib/nfl/api'
import { mapNflStandings } from '@/lib/nfl/mappers'
import { getNBAStandings, getTodaysNBAGames } from '@/lib/nba/api'
import { findNbaPlayerIdBySlug } from '@/lib/nba/playerLookup'
import { buildLiveNbaPlayerRow } from '@/lib/nba/playerProfile'
import { getNHLStandings, getTodaysNHLGames } from '@/lib/nhl/api'
import { findNhlPlayerIdBySlug } from '@/lib/nhl/playerLookup'
import { buildLiveNhlPlayerRow } from '@/lib/nhl/playerProfile'
import { getPlayerBySlug } from '@/lib/players/getPlayer'
import type { FavoritePlayer, FavoriteTeam } from './types'

export interface EnrichedFavoriteTeam {
  sport: string
  abbr: string
  record: string | null
  playingToday: boolean
  gameHref: string | null
}

export interface EnrichedFavoritePlayer {
  sport: string
  slug: string
  name: string
  team: string | null
  headlineStat: string | null
  statsAvailable: boolean
}

async function enrichMlbTeam(abbr: string): Promise<EnrichedFavoriteTeam> {
  const [rawGames, rawStandings, teams] = await Promise.all([getTodaysMlbGames(), getMlbStandings(), getMlbTeamsIndex()])
  const games = (rawGames ?? []).map(mapScheduleGame)
  const todayGame = games.find((g) => g.away.abbr === abbr || g.home.abbr === abbr)

  let record: string | null = null
  if (todayGame) {
    const side = todayGame.away.abbr === abbr ? todayGame.away : todayGame.home
    record = `${side.wins}-${side.losses}`
  } else if (rawStandings && teams) {
    const mapped = Object.values(mapStandings(rawStandings, teams)).flat()
    const row = mapped.find((t) => t.abbr === abbr)
    if (row) record = `${row.w}-${row.l}`
  }

  return { sport: 'mlb', abbr, record, playingToday: !!todayGame, gameHref: todayGame ? `/games/${todayGame.id}` : null }
}

async function enrichNflTeam(abbr: string): Promise<EnrichedFavoriteTeam> {
  const rawSchedule = await getNFLSchedule(await getActiveNFLSeason())
  if (!rawSchedule) return { sport: 'nfl', abbr, record: null, playingToday: false, gameHref: null }

  const standings = Object.values(mapNflStandings(rawSchedule)).flat()
  const row = standings.find((t) => t.abbr === abbr)
  return { sport: 'nfl', abbr, record: row ? `${row.w}-${row.l}` : null, playingToday: false, gameHref: null }
}

async function enrichNbaTeam(abbr: string): Promise<EnrichedFavoriteTeam> {
  const [games, standings] = await Promise.all([getTodaysNBAGames(), getNBAStandings()])
  const todayGame = (games ?? []).find((g) => g.away.abbr === abbr || g.home.abbr === abbr)
  const row = (standings ?? []).find((t) => t.abbr === abbr)

  return {
    sport: 'nba',
    abbr,
    record: row ? `${row.wins}-${row.losses}` : null,
    playingToday: !!todayGame,
    gameHref: todayGame ? `/games/nba/${todayGame.gameId}` : null,
  }
}

async function enrichNhlTeam(abbr: string): Promise<EnrichedFavoriteTeam> {
  const [games, standings] = await Promise.all([getTodaysNHLGames(), getNHLStandings()])
  const todayGame = (games ?? []).find((g) => g.away.abbr === abbr || g.home.abbr === abbr)
  const row = (standings ?? []).find((t) => t.abbr === abbr)

  return {
    sport: 'nhl',
    abbr,
    record: row ? `${row.wins}-${row.losses}-${row.otLosses}` : null,
    playingToday: !!todayGame,
    gameHref: todayGame ? `/games/nhl/${todayGame.gameId}` : null,
  }
}

export async function enrichFavoriteTeam(team: FavoriteTeam): Promise<EnrichedFavoriteTeam> {
  try {
    if (team.sport === 'mlb') return await enrichMlbTeam(team.abbr)
    if (team.sport === 'nfl') return await enrichNflTeam(team.abbr)
    if (team.sport === 'nba') return await enrichNbaTeam(team.abbr)
    return await enrichNhlTeam(team.abbr)
  } catch (err) {
    console.error(`[favoritesEnrichment] team lookup failed for ${team.sport}/${team.abbr}:`, err)
    return { sport: team.sport, abbr: team.abbr, record: null, playingToday: false, gameHref: null }
  }
}

export async function enrichFavoritePlayer(player: FavoritePlayer): Promise<EnrichedFavoritePlayer> {
  try {
    const stored = await getPlayerBySlug(player.slug)
    if (stored) {
      return { sport: player.sport, slug: player.slug, name: stored.name, team: stored.team, headlineStat: stored.headline_stat, statsAvailable: true }
    }

    if (player.sport === 'mlb') {
      const match = await findMlbPlayerIdBySlug(player.slug)
      if (match) {
        const row = await buildLiveMlbPlayerRow(match.id, player.slug)
        if (row) return { sport: 'mlb', slug: player.slug, name: row.name, team: row.team, headlineStat: row.headline_stat, statsAvailable: true }
      }
    } else if (player.sport === 'nba') {
      const match = await findNbaPlayerIdBySlug(player.slug)
      if (match) {
        const row = await buildLiveNbaPlayerRow(match.id, player.slug)
        if (row) return { sport: 'nba', slug: player.slug, name: row.name, team: row.team, headlineStat: row.headline_stat, statsAvailable: true }
      }
    } else if (player.sport === 'nhl') {
      const match = await findNhlPlayerIdBySlug(player.slug)
      if (match) {
        const row = await buildLiveNhlPlayerRow(match.id, player.slug)
        if (row) return { sport: 'nhl', slug: player.slug, name: row.name, team: row.team, headlineStat: row.headline_stat, statsAvailable: true }
      }
    }
  } catch (err) {
    console.error(`[favoritesEnrichment] player lookup failed for ${player.sport}/${player.slug}:`, err)
  }

  return { sport: player.sport, slug: player.slug, name: player.name, team: null, headlineStat: null, statsAvailable: false }
}
