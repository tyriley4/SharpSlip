import { NextResponse } from 'next/server'
import { getNhlGoalieBettingLeaders, getNhlSkaterBettingLeaders } from '@/lib/nhl/bettingLeaders'
import { attachPropPrices } from '@/lib/odds/propPrices'
import { DEFAULT_NHL_FILTERS, HOME_AWAY_OPTIONS, MONTH_OPTIONS, TIME_WINDOWS, type NHLLeaderFilters } from '@/lib/nhl/filters'
import {
  NHL_GOALIE_BETTING_CATEGORIES,
  NHL_GOALIE_BETTING_THRESHOLDS,
  NHL_SKATER_BETTING_CATEGORIES,
  NHL_SKATER_BETTING_THRESHOLDS,
  type NHLGoalieBettingCategory,
  type NHLSkaterBettingCategory,
} from '@/lib/nhl/leaderCategories'

function pick<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return value && (options as readonly string[]).includes(value) ? (value as T) : fallback
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const group = searchParams.get('group') === 'goalie' ? 'goalie' : 'skater'
  const category = searchParams.get('category') ?? ''
  const threshold = Number(searchParams.get('threshold'))

  const filters: NHLLeaderFilters = {
    window: pick(searchParams.get('window'), TIME_WINDOWS, DEFAULT_NHL_FILTERS.window),
    team: searchParams.get('team') || DEFAULT_NHL_FILTERS.team,
    homeAway: pick(searchParams.get('homeAway'), HOME_AWAY_OPTIONS, DEFAULT_NHL_FILTERS.homeAway),
    month: pick(searchParams.get('month'), MONTH_OPTIONS, DEFAULT_NHL_FILTERS.month),
  }

  try {
    if (group === 'goalie') {
      if (!(NHL_GOALIE_BETTING_CATEGORIES as readonly string[]).includes(category) || Number.isNaN(threshold)) {
        return NextResponse.json({ error: 'Missing or invalid category/threshold' }, { status: 400 })
      }
      const cat = category as NHLGoalieBettingCategory
      if (!NHL_GOALIE_BETTING_THRESHOLDS[cat].includes(threshold)) {
        return NextResponse.json({ error: 'Invalid threshold for category' }, { status: 400 })
      }
      const rows = await getNhlGoalieBettingLeaders(cat, threshold, filters)
      return NextResponse.json({ rows })
    }

    if (!(NHL_SKATER_BETTING_CATEGORIES as readonly string[]).includes(category) || Number.isNaN(threshold)) {
      return NextResponse.json({ error: 'Missing or invalid category/threshold' }, { status: 400 })
    }
    const cat = category as NHLSkaterBettingCategory
    if (!NHL_SKATER_BETTING_THRESHOLDS[cat].includes(threshold)) {
      return NextResponse.json({ error: 'Invalid threshold for category' }, { status: 400 })
    }
    const rows = await getNhlSkaterBettingLeaders(cat, threshold, filters)
    return NextResponse.json({ rows: attachPropPrices('nhl', cat, threshold, rows) })
  } catch (err) {
    console.error('[api/nhl-betting-leaders] failed:', err)
    return NextResponse.json({ error: 'NHL betting leaders temporarily unavailable' }, { status: 500 })
  }
}
