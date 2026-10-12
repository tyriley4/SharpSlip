import { NextResponse } from 'next/server'
import { DEFAULT_SCATTER_FILTERS, type ScatterFilters } from '@/lib/scatter/axes'
import { buildScatter } from '@/lib/scatter/server'
import { SPORT_META } from '@/lib/sport/meta'
import type { Sport } from '@/lib/sport/SportContext'

export const maxDuration = 60

function pick<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return value && (options as readonly string[]).includes(value) ? (value as T) : fallback
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sport = searchParams.get('sport') as Sport | null
  const sub = searchParams.get('sub') ?? ''
  const x = searchParams.get('x') ?? ''
  const y = searchParams.get('y') ?? ''

  if (!sport || !(sport in SPORT_META) || !sub || !x || !y) {
    return NextResponse.json({ error: 'Missing sport, sub, x or y' }, { status: 400 })
  }

  const filters: ScatterFilters = {
    vsTeam: searchParams.get('vsTeam') || DEFAULT_SCATTER_FILTERS.vsTeam,
    hand: pick(searchParams.get('hand'), ['All', 'vs RHP', 'vs LHP'] as const, DEFAULT_SCATTER_FILTERS.hand),
    homeAway: pick(searchParams.get('homeAway'), ['All', 'Home', 'Away'] as const, DEFAULT_SCATTER_FILTERS.homeAway),
    conference: pick(searchParams.get('conference'), ['All', 'AFC', 'NFC'] as const, DEFAULT_SCATTER_FILTERS.conference),
  }

  try {
    return NextResponse.json(await buildScatter(sport, sub, x, y, filters))
  } catch (err) {
    console.error('[api/scatter] failed:', err)
    return NextResponse.json({ error: 'Scatter data temporarily unavailable' }, { status: 500 })
  }
}
