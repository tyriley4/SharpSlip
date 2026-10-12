import { NextResponse } from 'next/server'
import { getUnifiedGamesForDate } from '@/lib/home/schedule'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Missing or invalid date (expected YYYY-MM-DD)' }, { status: 400 })
  }

  try {
    const games = await getUnifiedGamesForDate(date)
    return NextResponse.json({ games })
  } catch (err) {
    console.error('[api/schedule] failed:', err)
    return NextResponse.json({ error: 'Schedule temporarily unavailable' }, { status: 500 })
  }
}
