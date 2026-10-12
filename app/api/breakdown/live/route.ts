import { NextResponse } from 'next/server'
import { getLiveGameState } from '@/lib/mlb/liveBreakdown'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gamePk = Number(searchParams.get('gamePk'))

  if (Number.isNaN(gamePk)) {
    return NextResponse.json({ error: 'Missing gamePk' }, { status: 400 })
  }

  try {
    const data = await getLiveGameState(gamePk)
    if (!data) return NextResponse.json({ error: 'Live data unavailable' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/breakdown/live] failed:', err)
    return NextResponse.json({ error: 'Live data temporarily unavailable' }, { status: 500 })
  }
}
