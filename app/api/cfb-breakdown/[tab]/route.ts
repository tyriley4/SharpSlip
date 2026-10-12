import { NextResponse } from 'next/server'
import { getCfbLiveState } from '@/lib/cfb/live'
import {
  getCfbDefenseTabData,
  getCfbPassingTabData,
  getCfbReceivingTabData,
  getCfbRushingTabData,
  getCfbStadiumTabData,
  getCfbSummaryTabData,
  getCfbTrendsData,
} from '@/lib/cfb/tabs'

export const dynamic = 'force-dynamic'

/** One route for every college football breakdown tab: /api/cfb-breakdown/{passing|rushing|receiving|defense|summary|trends|stadium|live}?gameId=…&team=away|home */
export async function GET(request: Request, { params }: { params: { tab: string } }) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('gameId')
  const team = searchParams.get('team') === 'home' ? 'home' : 'away'
  if (!gameId) return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })

  try {
    let data: unknown = null
    switch (params.tab) {
      case 'passing':
        data = await getCfbPassingTabData(gameId, team)
        break
      case 'rushing':
        data = await getCfbRushingTabData(gameId, team)
        break
      case 'receiving':
        data = await getCfbReceivingTabData(gameId, team)
        break
      case 'defense':
        data = await getCfbDefenseTabData(gameId, team)
        break
      case 'summary':
        data = await getCfbSummaryTabData(gameId)
        break
      case 'trends': {
        const trends = await getCfbTrendsData(gameId)
        data = trends ? { trends } : null
        break
      }
      case 'stadium':
        data = await getCfbStadiumTabData(gameId)
        break
      case 'live':
        data = await getCfbLiveState(gameId)
        break
      default:
        return NextResponse.json({ error: 'Unknown tab' }, { status: 404 })
    }
    if (!data) return NextResponse.json({ error: `${params.tab} data unavailable` }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error(`[api/cfb-breakdown/${params.tab}] failed:`, err)
    return NextResponse.json({ error: `${params.tab} data temporarily unavailable` }, { status: 500 })
  }
}
