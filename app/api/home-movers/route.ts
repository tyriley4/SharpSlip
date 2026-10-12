import { NextResponse } from 'next/server'
import { getCondensedMovers, MOVER_WINDOWS, type MoverWindow } from '@/lib/home/movers'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const windowParam = searchParams.get('window')
  const window: MoverWindow = (MOVER_WINDOWS as readonly string[]).includes(windowParam ?? '') ? (windowParam as MoverWindow) : '7D'

  try {
    const movers = await getCondensedMovers(window)
    return NextResponse.json(movers)
  } catch (err) {
    console.error('[api/home-movers] failed:', err)
    return NextResponse.json({ error: 'Movers temporarily unavailable' }, { status: 500 })
  }
}
