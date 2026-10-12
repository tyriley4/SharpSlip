import { NextResponse } from 'next/server'
import { getNFLRushingTabData } from '@/lib/nfl/rushingBreakdown'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('gameId')
  const team = searchParams.get('team') === 'home' ? 'home' : 'away'
  if (!gameId) return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })

  try {
    const data = await getNFLRushingTabData(gameId, team)
    if (!data) return NextResponse.json({ error: 'Rushing data unavailable' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/nfl-breakdown/rushing] failed:', err)
    return NextResponse.json({ error: 'Rushing data temporarily unavailable' }, { status: 500 })
  }
}
