import { NextResponse } from 'next/server'
import { getNFLDefenseTabData } from '@/lib/nfl/defenseBreakdown'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('gameId')
  const team = searchParams.get('team') === 'home' ? 'home' : 'away'
  if (!gameId) return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })

  try {
    const data = await getNFLDefenseTabData(gameId, team)
    if (!data) return NextResponse.json({ error: 'Defense data unavailable' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/nfl-breakdown/defense] failed:', err)
    return NextResponse.json({ error: 'Defense data temporarily unavailable' }, { status: 500 })
  }
}
