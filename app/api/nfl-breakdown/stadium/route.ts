import { NextResponse } from 'next/server'
import { getNFLStadiumTabData } from '@/lib/nfl/stadiumBreakdown'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('gameId')
  if (!gameId) return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })

  try {
    const data = await getNFLStadiumTabData(gameId)
    if (!data) return NextResponse.json({ error: 'Stadium data unavailable' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/nfl-breakdown/stadium] failed:', err)
    return NextResponse.json({ error: 'Stadium data temporarily unavailable' }, { status: 500 })
  }
}
