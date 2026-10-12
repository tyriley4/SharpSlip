import { NextResponse } from 'next/server'
import { getNBAReboundingTabData } from '@/lib/nba/playerCardsBreakdown'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('gameId')
  const team = searchParams.get('team') === 'home' ? 'home' : 'away'
  if (!gameId) return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })

  try {
    const data = await getNBAReboundingTabData(gameId, team)
    if (!data) return NextResponse.json({ error: 'Rebounding data unavailable' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/nba-breakdown/rebounding] failed:', err)
    return NextResponse.json({ error: 'Rebounding data temporarily unavailable' }, { status: 500 })
  }
}
