import { NextResponse } from 'next/server'
import { enrichFavoritePlayer, enrichFavoriteTeam } from '@/lib/account/favoritesEnrichment'
import type { Favorites } from '@/lib/account/types'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<Favorites>
    const teams = body.teams ?? []
    const players = body.players ?? []

    const [teamRows, playerRows] = await Promise.all([
      Promise.all(teams.map(enrichFavoriteTeam)),
      Promise.all(players.map(enrichFavoritePlayer)),
    ])

    return NextResponse.json({ teams: teamRows, players: playerRows })
  } catch (err) {
    console.error('[api/account/favorites-data] failed:', err)
    return NextResponse.json({ error: 'Favorites data temporarily unavailable' }, { status: 500 })
  }
}
