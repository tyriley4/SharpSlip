import { NextResponse } from 'next/server'
import { getNFLReceivingTabData } from '@/lib/nfl/receivingBreakdown'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('gameId')
  const team = searchParams.get('team') === 'home' ? 'home' : 'away'
  if (!gameId) return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })

  try {
    const data = await getNFLReceivingTabData(gameId, team)
    if (!data) return NextResponse.json({ error: 'Receiving data unavailable' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/nfl-breakdown/receiving] failed:', err)
    return NextResponse.json({ error: 'Receiving data temporarily unavailable' }, { status: 500 })
  }
}
