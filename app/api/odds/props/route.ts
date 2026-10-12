import { NextResponse } from 'next/server'
import { getPlayerPropsStatus } from '@/lib/odds/api'
import type { Sport } from '@/lib/sport/SportContext'

export const dynamic = 'force-dynamic'

const SPORTS: Sport[] = ['mlb', 'nfl', 'cfb', 'nba', 'cbb', 'nhl']

/** GET /api/odds/props?sport=nba&gameId=123&away=LAL&home=SAC → { props, reason } (props is null when unavailable; reason explains why). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sport = searchParams.get('sport') as Sport | null
  const gameId = searchParams.get('gameId')
  const away = searchParams.get('away')
  const home = searchParams.get('home')
  if (!sport || !SPORTS.includes(sport) || !gameId || !away || !home) {
    return NextResponse.json({ error: 'sport, gameId, away and home are required' }, { status: 400 })
  }
  try {
    const { props, reason } = await getPlayerPropsStatus(sport, gameId, { away, home })
    return NextResponse.json({ props, reason })
  } catch (err) {
    console.error('[api/odds/props] failed:', err)
    return NextResponse.json({ props: null, error: 'Props temporarily unavailable' })
  }
}
