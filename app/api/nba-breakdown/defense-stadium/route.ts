import { NextResponse } from 'next/server'
import { getNBADefenseStadiumTabData } from '@/lib/nba/defenseStadiumBreakdown'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('gameId')
  const team = searchParams.get('team') === 'home' ? 'home' : 'away'
  if (!gameId) return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })

  try {
    const data = await getNBADefenseStadiumTabData(gameId, team)
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/nba-breakdown/defense-stadium] failed:', err)
    return NextResponse.json({ error: 'Defense/Stadium data temporarily unavailable' }, { status: 500 })
  }
}
