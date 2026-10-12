import { NextResponse } from 'next/server'
import { CBB_BETTING_CATEGORIES, CBB_BETTING_THRESHOLDS, CBB_GAME_CATEGORIES, getCbbBettingLeaders, getCbbWindowedLeaders } from '@/lib/college/cbbLeaders'
import { attachPropPrices } from '@/lib/odds/propPrices'

export const maxDuration = 60

const WINDOWS = ['Season', 'Last 30', 'Last 14', 'Last 7']

/** CBB leaderboards that depend on filters: mode=game (windowed/filtered Players stats) and mode=betting (prop hit rates). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode')
  const sub = searchParams.get('sub') ?? ''
  const category = searchParams.get('category') ?? ''
  const window = searchParams.get('window') ?? 'Season'
  const ha = searchParams.get('homeAway') ?? 'All'
  const homeAway = ha === 'Home' || ha === 'Away' ? ha : 'All'
  const filter = { window, homeAway: homeAway as 'All' | 'Home' | 'Away', vsTeam: searchParams.get('vs') || 'All Teams', month: Number(searchParams.get('month') ?? 0) || 0 }
  if (!WINDOWS.includes(window)) return NextResponse.json({ error: 'Invalid window' }, { status: 400 })

  try {
    if (mode === 'game') {
      if (sub !== 'Players' || !CBB_GAME_CATEGORIES.Players.includes(category)) return NextResponse.json({ error: 'Invalid sub/category' }, { status: 400 })
      return NextResponse.json({ rows: await getCbbWindowedLeaders(category, filter) })
    }
    if (mode === 'betting') {
      const threshold = Number(searchParams.get('threshold'))
      if (sub !== 'Players' || !CBB_BETTING_CATEGORIES.includes(category) || !CBB_BETTING_THRESHOLDS[category]?.includes(threshold)) return NextResponse.json({ error: 'Invalid category/threshold' }, { status: 400 })
      const rows = await getCbbBettingLeaders(category, threshold, filter)
      return NextResponse.json({ rows: attachPropPrices('cbb', category, threshold, rows) })
    }
    return NextResponse.json({ error: 'mode must be game or betting' }, { status: 400 })
  } catch (err) {
    console.error('[api/cbb-leaders] failed:', err)
    return NextResponse.json({ error: 'CBB leaders temporarily unavailable' }, { status: 500 })
  }
}
