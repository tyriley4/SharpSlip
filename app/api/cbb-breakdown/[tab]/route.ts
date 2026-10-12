import { NextResponse } from 'next/server'
import { getCbbTrendsData } from '@/lib/cbb/engine'
import { getCbbLiveState } from '@/lib/cbb/live'
import { getCbbArenaTabData, getCbbDefenseTabData, getCbbScoringTabData, getCbbSummaryTabData } from '@/lib/cbb/tabs'

export const dynamic = 'force-dynamic'

/** One route for every college basketball breakdown tab: /api/cbb-breakdown/{summary|scoring|defense|arena|trends|live}?gameId=… */
export async function GET(request: Request, { params }: { params: { tab: string } }) {
  const gameId = new URL(request.url).searchParams.get('gameId')
  if (!gameId) return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })

  try {
    let data: unknown = null
    switch (params.tab) {
      case 'summary':
        data = await getCbbSummaryTabData(gameId)
        break
      case 'scoring':
        data = await getCbbScoringTabData(gameId)
        break
      case 'defense':
        data = await getCbbDefenseTabData(gameId)
        break
      case 'arena':
        data = await getCbbArenaTabData(gameId)
        break
      case 'trends':
        data = await getCbbTrendsData(gameId)
        break
      case 'live':
        data = await getCbbLiveState(gameId)
        break
      default:
        return NextResponse.json({ error: 'Unknown tab' }, { status: 404 })
    }
    if (!data) return NextResponse.json({ error: `${params.tab} data unavailable` }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error(`[api/cbb-breakdown/${params.tab}] failed:`, err)
    return NextResponse.json({ error: `${params.tab} data temporarily unavailable` }, { status: 500 })
  }
}
