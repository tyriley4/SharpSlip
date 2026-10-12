import { NextResponse } from 'next/server'
import { getAllEdgesToday } from '@/lib/home/topEdges'

export const revalidate = 3600

export async function GET() {
  try {
    const edges = await getAllEdgesToday()
    return NextResponse.json({ edges })
  } catch (err) {
    console.error('[api/all-edges] failed:', err)
    return NextResponse.json({ error: 'Edges temporarily unavailable' }, { status: 500 })
  }
}
