import { NextResponse } from 'next/server'
import { getNHLDefenseArenaTabData } from '@/lib/nhl/defenseArenaBreakdown'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('gameId')
  const team = searchParams.get('team') === 'home' ? 'home' : 'away'
  if (!gameId) return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })

  try {
    const data = await getNHLDefenseArenaTabData(gameId, team)
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/nhl-breakdown/defense-arena] failed:', err)
    return NextResponse.json({ error: 'Defense/arena data temporarily unavailable' }, { status: 500 })
  }
}
