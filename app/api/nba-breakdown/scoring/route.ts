import { NextResponse } from 'next/server'
import { getNBAScoringTabData } from '@/lib/nba/playerCardsBreakdown'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('gameId')
  const team = searchParams.get('team') === 'home' ? 'home' : 'away'
  if (!gameId) return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })

  try {
    const data = await getNBAScoringTabData(gameId, team)
    if (!data) return NextResponse.json({ error: 'Scoring data unavailable' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/nba-breakdown/scoring] failed:', err)
    return NextResponse.json({ error: 'Scoring data temporarily unavailable' }, { status: 500 })
  }
}
