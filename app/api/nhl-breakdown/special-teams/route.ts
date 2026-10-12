import { NextResponse } from 'next/server'
import { getNHLSpecialTeamsData } from '@/lib/nhl/specialTeamsBreakdown'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('gameId')
  const team = searchParams.get('team') === 'home' ? 'home' : 'away'
  if (!gameId) return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })

  try {
    const data = await getNHLSpecialTeamsData(gameId, team)
    if (!data) return NextResponse.json({ error: 'Special teams data unavailable' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/nhl-breakdown/special-teams] failed:', err)
    return NextResponse.json({ error: 'Special teams data temporarily unavailable' }, { status: 500 })
  }
}
