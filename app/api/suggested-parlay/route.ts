import { NextResponse } from 'next/server'
import { buildPool, suggestParlays } from '@/lib/parlay/suggest'
import { getParlayGames } from '@/lib/parlay/todayGames'

export const revalidate = 3600

export async function GET() {
  try {
    const games = await getParlayGames()
    const pool = buildPool(games)
    const { parlays } = suggestParlays(pool, { legs: 2, risk: 'moderate', sport: 'all', target: 'none' }, 1)
    return NextResponse.json({ parlay: parlays[0] ?? null })
  } catch (err) {
    console.error('[api/suggested-parlay] failed:', err)
    return NextResponse.json({ error: 'Suggested parlay temporarily unavailable' }, { status: 500 })
  }
}
