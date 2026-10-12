import { NextResponse } from 'next/server'
import { getTrendsData } from '@/lib/mlb/trendsEngine'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gamePk = Number(searchParams.get('gamePk'))

  if (Number.isNaN(gamePk)) {
    return NextResponse.json({ error: 'Missing gamePk' }, { status: 400 })
  }

  try {
    const trends = await getTrendsData(gamePk)
    if (!trends) return NextResponse.json({ error: 'Trends unavailable' }, { status: 404 })
    return NextResponse.json({ trends })
  } catch (err) {
    console.error('[api/breakdown/trends] failed:', err)
    return NextResponse.json({ error: 'Trends temporarily unavailable' }, { status: 500 })
  }
}
