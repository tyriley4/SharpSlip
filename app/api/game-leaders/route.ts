import { NextResponse } from 'next/server'
import { getWindowedGameLeaders } from '@/lib/leaders/gameLeaders'

export const maxDuration = 60

const WINDOWS = ['Last 30', 'Last 14', 'Last 7', 'Career']

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sport = searchParams.get('sport')
  const sub = searchParams.get('sub') ?? ''
  const category = searchParams.get('category') ?? ''
  const window = searchParams.get('window') ?? ''

  if ((sport !== 'nfl' && sport !== 'nba' && sport !== 'nhl') || !sub || !category || !WINDOWS.includes(window)) {
    return NextResponse.json({ error: 'Missing or invalid sport/sub/category/window' }, { status: 400 })
  }

  try {
    const rows = await getWindowedGameLeaders(sport, sub, category, window)
    return NextResponse.json({ rows })
  } catch (err) {
    console.error('[api/game-leaders] failed:', err)
    return NextResponse.json({ error: 'Leaders data temporarily unavailable' }, { status: 500 })
  }
}
