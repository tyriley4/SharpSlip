import { NextResponse } from 'next/server'
import { getActiveNFLSeason } from '@/lib/nfl/api'
import { isNflBettingSub, NFL_BETTING_CATEGORIES, NFL_BETTING_THRESHOLDS } from '@/lib/nfl/bettingCategories'
import { getNflBettingLeaders } from '@/lib/nfl/bettingLeaders'
import { attachPropPrices } from '@/lib/odds/propPrices'
import { DEFAULT_NFL_FILTERS, HOME_AWAY_OPTIONS, MONTH_OPTIONS, TIME_WINDOWS, type NFLLeaderFilters } from '@/lib/nfl/filters'

function pick<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return value && (options as readonly string[]).includes(value) ? (value as T) : fallback
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sub = searchParams.get('sub') ?? ''
  const category = searchParams.get('category') ?? ''
  const threshold = Number(searchParams.get('threshold'))

  if (!isNflBettingSub(sub) || !NFL_BETTING_CATEGORIES[sub].includes(category) || Number.isNaN(threshold)) {
    return NextResponse.json({ error: 'Missing or invalid sub/category/threshold' }, { status: 400 })
  }
  if (!NFL_BETTING_THRESHOLDS[category].includes(threshold)) {
    return NextResponse.json({ error: 'Invalid threshold for category' }, { status: 400 })
  }

  const filters: NFLLeaderFilters = {
    window: pick(searchParams.get('window'), TIME_WINDOWS, DEFAULT_NFL_FILTERS.window),
    team: searchParams.get('team') || DEFAULT_NFL_FILTERS.team,
    homeAway: pick(searchParams.get('homeAway'), HOME_AWAY_OPTIONS, DEFAULT_NFL_FILTERS.homeAway),
    month: pick(searchParams.get('month'), MONTH_OPTIONS, DEFAULT_NFL_FILTERS.month),
    conference: 'All',
  }

  try {
    const season = await getActiveNFLSeason()
    const rows = await getNflBettingLeaders(sub, category, threshold, filters, season)
    return NextResponse.json({ rows: attachPropPrices('nfl', category, threshold, rows) })
  } catch (err) {
    console.error('[api/nfl-betting-leaders] failed:', err)
    return NextResponse.json({ error: 'NFL betting leaders temporarily unavailable' }, { status: 500 })
  }
}
