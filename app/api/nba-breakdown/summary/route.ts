import { NextResponse } from 'next/server'
import { getNBASummaryTabData } from '@/lib/nba/summaryBreakdown'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('gameId')
  if (!gameId) return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })

  try {
    const data = await getNBASummaryTabData(gameId)
    if (!data) return NextResponse.json({ error: 'Summary unavailable' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/nba-breakdown/summary] failed:', err)
    return NextResponse.json({ error: 'Summary temporarily unavailable' }, { status: 500 })
  }
}
