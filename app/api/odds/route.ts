import { NextResponse } from 'next/server'
import { getCredits, getGameOdds } from '@/lib/odds/api'
import type { Sport } from '@/lib/sport/SportContext'

export const dynamic = 'force-dynamic'

const SPORTS: Sport[] = ['mlb', 'nfl', 'cfb', 'nba', 'cbb', 'nhl']

/** GET /api/odds?sport=mlb&gameId=123&away=NYY&home=TB → { odds } (null when no book has posted the game). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sport = searchParams.get('sport') as Sport | null
  const gameId = searchParams.get('gameId')
  const away = searchParams.get('away')
  const home = searchParams.get('home')
  if (!sport || !SPORTS.includes(sport) || !gameId || !away || !home) {
    return NextResponse.json({ error: 'sport, gameId, away and home are required' }, { status: 400 })
  }
  try {
    const odds = await getGameOdds(sport, gameId, { away, home })
    const credits = getCredits()
    return NextResponse.json({ odds, credits: { remaining: credits.remaining, exhausted: credits.exhausted } })
  } catch (err) {
    console.error('[api/odds] failed:', err)
    return NextResponse.json({ odds: null, error: 'Lines temporarily unavailable' })
  }
}
