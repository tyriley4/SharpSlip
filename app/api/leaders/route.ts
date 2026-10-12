import { NextResponse } from 'next/server'
import {
  DAY_NIGHT_OPTIONS,
  DEFAULT_FILTERS,
  HANDEDNESS_OPTIONS,
  HOME_AWAY_OPTIONS,
  MONTH_OPTIONS,
  TIME_WINDOWS,
  type LeaderFilters,
} from '@/lib/mlb/filters'
import { getFilteredLeaders } from '@/lib/mlb/filteredLeaders'

function pick<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return value && (options as readonly string[]).includes(value) ? (value as T) : fallback
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sub = searchParams.get('sub') === 'Pitchers' ? 'Pitchers' : 'Hitters'
  const category = searchParams.get('category') ?? ''

  const filters: LeaderFilters = {
    window: pick(searchParams.get('window'), TIME_WINDOWS, DEFAULT_FILTERS.window),
    team: searchParams.get('team') || DEFAULT_FILTERS.team,
    homeAway: pick(searchParams.get('homeAway'), HOME_AWAY_OPTIONS, DEFAULT_FILTERS.homeAway),
    handedness: pick(searchParams.get('handedness'), HANDEDNESS_OPTIONS, DEFAULT_FILTERS.handedness),
    dayNight: pick(searchParams.get('dayNight'), DAY_NIGHT_OPTIONS, DEFAULT_FILTERS.dayNight),
    month: pick(searchParams.get('month'), MONTH_OPTIONS, DEFAULT_FILTERS.month),
  }

  if (!category) {
    return NextResponse.json({ error: 'Missing category' }, { status: 400 })
  }

  try {
    const rows = await getFilteredLeaders(sub, category, filters)
    return NextResponse.json({ rows })
  } catch (err) {
    console.error('[api/leaders] failed:', err)
    return NextResponse.json({ error: 'Leaders data temporarily unavailable' }, { status: 500 })
  }
}
