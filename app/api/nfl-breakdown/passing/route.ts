import { NextResponse } from 'next/server'
import { getNFLPassingTabData } from '@/lib/nfl/passingBreakdown'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('gameId')
  const team = searchParams.get('team') === 'home' ? 'home' : 'away'
  if (!gameId) return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })

  try {
    const data = await getNFLPassingTabData(gameId, team)
    if (!data) return NextResponse.json({ error: 'Passing data unavailable' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/nfl-breakdown/passing] failed:', err)
    return NextResponse.json({ error: 'Passing data temporarily unavailable' }, { status: 500 })
  }
}
