import { NextResponse } from 'next/server'
import { MOVER_WINDOWS, getMoversData, type MoverWindow } from '@/lib/mlb/movers'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const requested = searchParams.get('window') as MoverWindow | null
  const window: MoverWindow = requested && MOVER_WINDOWS.includes(requested) ? requested : '7D'

  try {
    const data = await getMoversData(window)
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/movers] failed:', err)
    return NextResponse.json({ error: 'Movers data temporarily unavailable' }, { status: 500 })
  }
}
