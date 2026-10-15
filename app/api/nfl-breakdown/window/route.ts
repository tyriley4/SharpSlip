import { NextResponse } from 'next/server'
import { getNFLWindowPanel, type NflWindowTab } from '@/lib/nfl/windowPanel'

const TABS: NflWindowTab[] = ['passing', 'rushing', 'receiving', 'defense']

/** GET /api/nfl-breakdown/window?gameId=..&team=away|home&tab=passing&games=5 */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const gameId = sp.get('gameId')
  const tab = sp.get('tab') as NflWindowTab | null
  const games = Number(sp.get('games'))
  if (!gameId || !tab || !TABS.includes(tab) || !Number.isInteger(games) || games < 1 || games > 17) {
    return NextResponse.json({ error: 'gameId, tab and games (1-17) are required' }, { status: 400 })
  }
  try {
    const team = sp.get('team') === 'home' ? 'home' : 'away'
    const data = await getNFLWindowPanel(gameId, team, tab, games)
    if (!data) return NextResponse.json({ error: 'Window data unavailable' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/nfl-breakdown/window] failed:', err)
    return NextResponse.json({ error: 'Window data temporarily unavailable' }, { status: 500 })
  }
}
