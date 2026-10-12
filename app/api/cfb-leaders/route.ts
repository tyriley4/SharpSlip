import { NextResponse } from 'next/server'
import { CFB_BETTING_CATEGORIES, CFB_BETTING_THRESHOLDS, getCfbBettingLeaders, getCfbWindowedLeaders, isCfbBettingSub, CFB_GAME_CATEGORIES, CFB_SUBS, type CfbSub } from '@/lib/college/cfbLeaders'
import { attachPropPrices } from '@/lib/odds/propPrices'

export const maxDuration = 60

const WINDOWS = ['Season', 'Last 30', 'Last 14', 'Last 7']
const HOME_AWAY = ['All', 'Home', 'Away'] as const

/**
 * CFB leaderboards that depend on filters: `mode=game` (windowed / filtered game stats) and `mode=betting`
 * (hit rates at a threshold). Computed from the league-wide box-score rows.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode')
  const sub = searchParams.get('sub') ?? ''
  const category = searchParams.get('category') ?? ''
  const window = searchParams.get('window') ?? 'Season'
  const homeAwayRaw = searchParams.get('homeAway') ?? 'All'
  const homeAway = (HOME_AWAY as readonly string[]).includes(homeAwayRaw) ? (homeAwayRaw as (typeof HOME_AWAY)[number]) : 'All'
  const conference = searchParams.get('conference') || 'All'
  const vsTeam = searchParams.get('vs') || 'All Teams'
  const month = Number(searchParams.get('month') ?? 0) || 0

  if (!WINDOWS.includes(window)) return NextResponse.json({ error: 'Invalid window' }, { status: 400 })
  const filter = { window, homeAway, conference, vsTeam, month }

  try {
    if (mode === 'game') {
      if (!(CFB_SUBS as string[]).includes(sub) || !CFB_GAME_CATEGORIES[sub as CfbSub].includes(category)) return NextResponse.json({ error: 'Invalid sub/category' }, { status: 400 })
      return NextResponse.json({ rows: await getCfbWindowedLeaders(sub, category, filter) })
    }
    if (mode === 'betting') {
      const threshold = Number(searchParams.get('threshold'))
      if (!isCfbBettingSub(sub) || !CFB_BETTING_CATEGORIES[sub].includes(category) || !CFB_BETTING_THRESHOLDS[category]?.includes(threshold)) {
        return NextResponse.json({ error: 'Invalid sub/category/threshold' }, { status: 400 })
      }
      const rows = await getCfbBettingLeaders(sub, category, threshold, filter)
      return NextResponse.json({ rows: attachPropPrices('cfb', category, threshold, rows) })
    }
    return NextResponse.json({ error: 'mode must be game or betting' }, { status: 400 })
  } catch (err) {
    console.error('[api/cfb-leaders] failed:', err)
    return NextResponse.json({ error: 'CFB leaders temporarily unavailable' }, { status: 500 })
  }
}
