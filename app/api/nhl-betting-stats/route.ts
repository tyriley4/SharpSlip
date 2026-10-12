import { NextResponse } from 'next/server'
import { getNhlPlayerCategoryStats } from '@/lib/nhl/bettingPlayerStats'
import {
  NHL_GOALIE_PLAYER_PROP_CATEGORIES,
  NHL_GOALIE_PLAYER_PROP_THRESHOLDS,
  NHL_SKATER_BETTING_CATEGORIES,
  NHL_SKATER_BETTING_THRESHOLDS,
  type NHLGoaliePlayerPropCategory,
  type NHLSkaterBettingCategory,
} from '@/lib/nhl/leaderCategories'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const playerId = Number(searchParams.get('playerId'))
  const isGoalie = searchParams.get('isGoalie') === 'true'
  const category = searchParams.get('category') ?? ''
  const threshold = Number(searchParams.get('threshold'))

  if (Number.isNaN(playerId) || !category || Number.isNaN(threshold)) {
    return NextResponse.json({ error: 'Missing playerId, category, or threshold' }, { status: 400 })
  }

  if (isGoalie) {
    if (!(NHL_GOALIE_PLAYER_PROP_CATEGORIES as readonly string[]).includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }
    if (!NHL_GOALIE_PLAYER_PROP_THRESHOLDS[category as NHLGoaliePlayerPropCategory].includes(threshold)) {
      return NextResponse.json({ error: 'Invalid threshold for category' }, { status: 400 })
    }
  } else {
    if (!(NHL_SKATER_BETTING_CATEGORIES as readonly string[]).includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }
    if (!NHL_SKATER_BETTING_THRESHOLDS[category as NHLSkaterBettingCategory].includes(threshold)) {
      return NextResponse.json({ error: 'Invalid threshold for category' }, { status: 400 })
    }
  }

  try {
    const stats = await getNhlPlayerCategoryStats(playerId, category as NHLSkaterBettingCategory | NHLGoaliePlayerPropCategory, threshold, isGoalie)
    if (!stats) return NextResponse.json({ error: 'No game log available' }, { status: 404 })
    return NextResponse.json(stats)
  } catch (err) {
    console.error('[api/nhl-betting-stats] failed:', err)
    return NextResponse.json({ error: 'Betting stats temporarily unavailable' }, { status: 500 })
  }
}
