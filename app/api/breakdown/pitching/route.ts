import { NextResponse } from 'next/server'
import { getPitchingTabData } from '@/lib/mlb/pitchingBreakdown'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gamePk = Number(searchParams.get('gamePk'))
  const team = searchParams.get('team') === 'home' ? 'home' : 'away'

  if (Number.isNaN(gamePk)) {
    return NextResponse.json({ error: 'Missing gamePk' }, { status: 400 })
  }

  try {
    const data = await getPitchingTabData(gamePk, team)
    if (!data) return NextResponse.json({ error: 'Pitching data unavailable' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/breakdown/pitching] failed:', err)
    return NextResponse.json({ error: 'Pitching data temporarily unavailable' }, { status: 500 })
  }
}
