import { NextResponse } from 'next/server'
import { getNHLGoalieTabData } from '@/lib/nhl/playerCardsBreakdown'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('gameId')
  const team = searchParams.get('team') === 'home' ? 'home' : 'away'
  if (!gameId) return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })

  try {
    const data = await getNHLGoalieTabData(gameId, team)
    if (!data) return NextResponse.json({ error: 'Goalie data unavailable' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/nhl-breakdown/goalie] failed:', err)
    return NextResponse.json({ error: 'Goalie data temporarily unavailable' }, { status: 500 })
  }
}
