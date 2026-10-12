import { NextResponse } from 'next/server'
import { getNFLTrendsData } from '@/lib/nfl/trendsEngine'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('gameId')
  if (!gameId) return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })

  try {
    const trends = await getNFLTrendsData(gameId)
    if (!trends) return NextResponse.json({ error: 'Trends unavailable' }, { status: 404 })
    return NextResponse.json({ trends })
  } catch (err) {
    console.error('[api/nfl-breakdown/trends] failed:', err)
    return NextResponse.json({ error: 'Trends temporarily unavailable' }, { status: 500 })
  }
}
