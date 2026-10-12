import { NextResponse } from 'next/server'
import { getGameLogTabData } from '@/lib/mlb/gameLogBreakdown'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gamePk = Number(searchParams.get('gamePk'))

  if (Number.isNaN(gamePk)) {
    return NextResponse.json({ error: 'Missing gamePk' }, { status: 400 })
  }

  try {
    const data = await getGameLogTabData(gamePk)
    if (!data) return NextResponse.json({ error: 'Game log unavailable' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/breakdown/gamelog] failed:', err)
    return NextResponse.json({ error: 'Game log temporarily unavailable' }, { status: 500 })
  }
}
