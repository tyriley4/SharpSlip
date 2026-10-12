import { NextResponse } from 'next/server'
import { getBallparkTabData } from '@/lib/mlb/ballparkBreakdown'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gamePk = Number(searchParams.get('gamePk'))

  if (Number.isNaN(gamePk)) {
    return NextResponse.json({ error: 'Missing gamePk' }, { status: 400 })
  }

  try {
    const data = await getBallparkTabData(gamePk)
    if (!data) return NextResponse.json({ error: 'Ballpark data unavailable' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/breakdown/ballpark] failed:', err)
    return NextResponse.json({ error: 'Ballpark data temporarily unavailable' }, { status: 500 })
  }
}
