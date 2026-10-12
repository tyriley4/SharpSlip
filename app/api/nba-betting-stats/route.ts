import { NextResponse } from 'next/server'
import { getNbaPlayerCategoryStats } from '@/lib/nba/bettingPlayerStats'
import { NBA_BETTING_CATEGORIES, NBA_BETTING_THRESHOLDS, type NBABettingCategory } from '@/lib/nba/leaderCategories'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const playerId = Number(searchParams.get('playerId'))
  const category = (searchParams.get('category') ?? '') as NBABettingCategory
  const threshold = Number(searchParams.get('threshold'))

  if (Number.isNaN(playerId) || !NBA_BETTING_CATEGORIES.includes(category) || Number.isNaN(threshold)) {
    return NextResponse.json({ error: 'Missing playerId, category, or threshold' }, { status: 400 })
  }
  if (!NBA_BETTING_THRESHOLDS[category].includes(threshold)) {
    return NextResponse.json({ error: 'Invalid threshold for category' }, { status: 400 })
  }

  try {
    const stats = await getNbaPlayerCategoryStats(playerId, category, threshold)
    if (!stats) return NextResponse.json({ error: 'No game log available' }, { status: 404 })
    return NextResponse.json(stats)
  } catch (err) {
    console.error('[api/nba-betting-stats] failed:', err)
    return NextResponse.json({ error: 'Betting stats temporarily unavailable' }, { status: 500 })
  }
}
