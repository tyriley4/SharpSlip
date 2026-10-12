import { NextResponse } from 'next/server'
import { getPlayerCategoryStats } from '@/lib/mlb/bettingPlayerStats'
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
  const playerId = Number(searchParams.get('playerId'))
  const group = searchParams.get('group') === 'pitching' ? 'pitching' : 'hitting'
  const category = (searchParams.get('category') ?? '') as PropCategory
  const threshold = Number(searchParams.get('threshold'))

  if (Number.isNaN(playerId) || !category || Number.isNaN(threshold)) {
    return NextResponse.json({ error: 'Missing playerId, category, or threshold' }, { status: 400 })
  }
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
    const stats = await getPlayerCategoryStats(playerId, group, category, threshold, filters)
    if (!stats) return NextResponse.json({ error: 'No game log available' }, { status: 404 })
    return NextResponse.json(stats)
  } catch (err) {
    console.error('[api/betting-stats] failed:', err)
    return NextResponse.json({ error: 'Betting stats temporarily unavailable' }, { status: 500 })
  }
}
