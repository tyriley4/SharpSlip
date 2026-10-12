import { NextResponse } from 'next/server'
import { getCfbForHome, getLiveScores } from '@/lib/espn/live'

export const dynamic = 'force-dynamic'

/** GET /api/live-scores → { items, liveCount, at, cfb } — real-time scores for the home ticker and the college football block (ESPN, 30s cache). */
export async function GET() {
  try {
    const [live, cfb] = await Promise.all([getLiveScores(), getCfbForHome().catch(() => [])])
    return NextResponse.json({ ...live, cfb })
  } catch (err) {
    console.error('[api/live-scores] failed:', err)
    return NextResponse.json({ items: [], liveCount: 0, at: new Date().toISOString(), cfb: [] })
  }
}
