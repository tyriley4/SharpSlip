import { NextResponse } from 'next/server'
import { getTopEdgesToday } from '@/lib/home/topEdges'

export const revalidate = 3600

export async function GET() {
  try {
    const edges = await getTopEdgesToday()
    return NextResponse.json({ edges })
  } catch (err) {
    console.error('[api/top-edges] failed:', err)
    return NextResponse.json({ error: 'Top edges temporarily unavailable' }, { status: 500 })
  }
}
