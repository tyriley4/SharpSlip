import { NextResponse } from 'next/server'
import { getNHLTrendsData } from '@/lib/nhl/trendsEngine'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('gameId')
  if (!gameId) return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })

  try {
    const trends = await getNHLTrendsData(gameId)
    if (!trends) return NextResponse.json({ error: 'Trends unavailable' }, { status: 404 })
    return NextResponse.json({ trends })
  } catch (err) {
    console.error('[api/nhl-breakdown/trends] failed:', err)
    return NextResponse.json({ error: 'Trends temporarily unavailable' }, { status: 500 })
  }
}
