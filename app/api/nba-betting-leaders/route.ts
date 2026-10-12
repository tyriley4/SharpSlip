import { NextResponse } from 'next/server'
import { getNbaBettingLeaders } from '@/lib/nba/bettingLeaders'
import { attachPropPrices } from '@/lib/odds/propPrices'
import { NBA_CURRENT_SEASON } from '@/lib/nba/divisions'
import { DEFAULT_NBA_FILTERS, HOME_AWAY_OPTIONS, MONTH_OPTIONS, TIME_WINDOWS, type NBALeaderFilters } from '@/lib/nba/filters'
import { NBA_BETTING_CATEGORIES, NBA_BETTING_THRESHOLDS, type NBABettingCategory } from '@/lib/nba/leaderCategories'

function pick<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return value && (options as readonly string[]).includes(value) ? (value as T) : fallback
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') as NBABettingCategory | null
  const threshold = Number(searchParams.get('threshold'))

  if (!category || !(NBA_BETTING_CATEGORIES as readonly string[]).includes(category) || Number.isNaN(threshold)) {
    return NextResponse.json({ error: 'Missing or invalid category/threshold' }, { status: 400 })
  }
  if (!NBA_BETTING_THRESHOLDS[category].includes(threshold)) {
    return NextResponse.json({ error: 'Invalid threshold for category' }, { status: 400 })
  }

  const filters: NBALeaderFilters = {
    window: pick(searchParams.get('window'), TIME_WINDOWS, DEFAULT_NBA_FILTERS.window),
    team: searchParams.get('team') || DEFAULT_NBA_FILTERS.team,
    homeAway: pick(searchParams.get('homeAway'), HOME_AWAY_OPTIONS, DEFAULT_NBA_FILTERS.homeAway),
    month: pick(searchParams.get('month'), MONTH_OPTIONS, DEFAULT_NBA_FILTERS.month),
  }

  try {
    const rows = await getNbaBettingLeaders(category, threshold, filters, NBA_CURRENT_SEASON)
    return NextResponse.json({ rows: attachPropPrices('nba', category, threshold, rows) })
  } catch (err) {
    console.error('[api/nba-betting-leaders] failed:', err)
    return NextResponse.json({ error: 'NBA betting leaders temporarily unavailable' }, { status: 500 })
  }
}
