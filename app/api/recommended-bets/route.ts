import { NextResponse } from 'next/server'
import { getRecommendedBets } from '@/lib/edges/recommended'
import type { Sport } from '@/lib/sport/SportContext'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SPORTS: Sport[] = ['mlb', 'nfl', 'cfb', 'nba', 'cbb', 'nhl']

/** GET /api/recommended-bets?sport=nfl&gameId=...&away=TB&home=DAL - graded bets with supporting insights for one game. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const sport = sp.get('sport') as Sport | null
  const gameId = sp.get('gameId')
  const away = sp.get('away')
  const home = sp.get('home')
  if (!sport || !SPORTS.includes(sport) || !gameId || !away || !home) {
    return NextResponse.json({ error: 'sport, gameId, away and home are required' }, { status: 400 })
  }
  return NextResponse.json(await getRecommendedBets(sport, gameId, away, home))
}
