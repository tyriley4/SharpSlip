import { NextResponse } from 'next/server'
import { getNFLLiveState } from '@/lib/nfl/liveBreakdown'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const awayAbbr = searchParams.get('away')
  const homeAbbr = searchParams.get('home')
  if (!awayAbbr || !homeAbbr) return NextResponse.json({ error: 'Missing away/home' }, { status: 400 })

  try {
    const data = await getNFLLiveState(awayAbbr, homeAbbr)
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/nfl-breakdown/live] failed:', err)
    return NextResponse.json({ error: 'Live data temporarily unavailable' }, { status: 500 })
  }
}
