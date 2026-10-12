import { NextResponse } from 'next/server'
import { getCfbAnalysis } from '@/lib/cfb/engine'

export const dynamic = 'force-dynamic'

/**
 * GET /api/college-edges?sport=cfb&ids=1,2,3 → { edges: { [gameId]: { count, topGrade, topConf } } }
 * Edge badges for the slate. Computed lazily (box scores are cached on disk after the first pass) and capped
 * at 8 games per call so the slate itself never waits on them.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sport = searchParams.get('sport')
  const ids = (searchParams.get('ids') ?? '').split(',').filter(Boolean).slice(0, 8)
  if (sport !== 'cfb' || ids.length === 0) return NextResponse.json({ edges: {} })

  const out: Record<string, { count: number; topGrade: string | null; topConf: number | null }> = {}
  await Promise.all(
    ids.map(async (id) => {
      try {
        const data = await getCfbAnalysis(id)
        if (!data) return
        const top = data.edges[0]
        out[id] = { count: data.edges.length, topGrade: top?.grade ?? null, topConf: top?.conf ?? null }
      } catch (err) {
        console.error(`[api/college-edges] ${id} failed`, err)
      }
    })
  )
  return NextResponse.json({ edges: out })
}
