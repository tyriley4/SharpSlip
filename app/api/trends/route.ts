import { NextResponse } from 'next/server'
import { SPORT_META } from '@/lib/sport/meta'
import type { Sport } from '@/lib/sport/SportContext'
import { buildTrends } from '@/lib/trend/server'

export const maxDuration = 60

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sport = searchParams.get('sport') as Sport | null
  const sub = searchParams.get('sub') ?? ''
  const mode = searchParams.get('mode') === 'betting' ? 'betting' : 'stat'
  const category = searchParams.get('category') ?? ''
  const threshold = Number(searchParams.get('threshold') ?? 0)
  const players = (searchParams.get('players') ?? '')
    .split(';;')
    .map((s) => s.split('|'))
    .filter((parts) => parts[0])
    .slice(0, 5)
    .map(([name, team]) => ({ name, team: team ?? '' }))

  if (!sport || !(sport in SPORT_META) || !sub || !category || players.length === 0) {
    return NextResponse.json({ error: 'Missing sport, sub, category or players' }, { status: 400 })
  }

  try {
    return NextResponse.json(await buildTrends(sport, sub, mode, category, Number.isFinite(threshold) ? threshold : 0, players))
  } catch (err) {
    console.error('[api/trends] failed:', err)
    return NextResponse.json({ error: 'Trend data temporarily unavailable' }, { status: 500 })
  }
}
