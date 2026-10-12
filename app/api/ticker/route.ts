import { NextResponse } from 'next/server'
import { getTickerItems } from '@/lib/home/ticker'

export const revalidate = 3600

export async function GET() {
  try {
    const items = await getTickerItems()
    return NextResponse.json({ items })
  } catch (err) {
    console.error('[api/ticker] failed:', err)
    return NextResponse.json({ items: [] })
  }
}
