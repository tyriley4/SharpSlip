import { NextResponse } from 'next/server'
import { getBettingLeaders } from '@/lib/mlb/bettingLeaders'
import { attachPropPrices } from '@/lib/odds/propPrices'
import { thresholdsFor, type PropCategory } from '@/lib/mlb/bettingCategories'
import {
  DAY_NIGHT_OPTIONS,
  DEFAULT_FILTERS,
  HOME_AWAY_OPTIONS,
  MONTH_OPTIONS,
  TIME_WINDOWS,
  type LeaderFilters,
} from '@/lib/mlb/filters'

function pick<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return value && (options as readonly string[]).includes(value) ? (value as T) : fallback
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sub = searchParams.get('sub') === 'Pitchers' ? 'Pitchers' : 'Hitters'
  const category = (searchParams.get('category') ?? '') as PropCategory
  const threshold = Number(searchParams.get('threshold'))

  if (!category || Number.isNaN(threshold)) {
    return NextResponse.json({ error: 'Missing category or threshold' }, { status: 400 })
  }

  const group = sub === 'Hitters' ? 'hitting' : 'pitching'
  if (!thresholdsFor(category, group).includes(threshold)) {
    return NextResponse.json({ error: 'Invalid threshold for category' }, { status: 400 })
  }

  const filters: LeaderFilters = {
    window: pick(searchParams.get('window'), TIME_WINDOWS, DEFAULT_FILTERS.window),
    team: searchParams.get('team') || DEFAULT_FILTERS.team,
    homeAway: pick(searchParams.get('homeAway'), HOME_AWAY_OPTIONS, DEFAULT_FILTERS.homeAway),
    handedness: DEFAULT_FILTERS.handedness,
    dayNight: pick(searchParams.get('dayNight'), DAY_NIGHT_OPTIONS, DEFAULT_FILTERS.dayNight),
    month: pick(searchParams.get('month'), MONTH_OPTIONS, DEFAULT_FILTERS.month),
  }

  try {
    const rows = await getBettingLeaders(sub, category, threshold, filters)
    return NextResponse.json({ rows: attachPropPrices('mlb', category, threshold, rows, sub) })
  } catch (err) {
    console.error('[api/betting-leaders] failed:', err)
    return NextResponse.json({ error: 'Betting leaders temporarily unavailable' }, { status: 500 })
  }
}
