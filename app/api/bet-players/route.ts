import { NextResponse } from 'next/server'
import { searchBetPlayers } from '@/lib/account/playerSearch'
import { BET_SPORTS, type BetSport } from '@/lib/account/types'

export const maxDuration = 30

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sport = searchParams.get('sport') as BetSport | null
  if (!sport || !BET_SPORTS.includes(sport)) {
    return NextResponse.json({ error: 'Missing or invalid sport' }, { status: 400 })
  }
  const teams = (searchParams.get('teams') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 2)
  const q = searchParams.get('q') ?? ''

  try {
    return NextResponse.json({ players: await searchBetPlayers(sport, teams, q) })
  } catch (err) {
    console.error('[api/bet-players] failed:', err)
    return NextResponse.json({ players: [] })
  }
}
