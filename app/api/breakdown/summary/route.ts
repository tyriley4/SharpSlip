import { NextResponse } from 'next/server'
import { getSummaryTabData } from '@/lib/mlb/summaryBreakdown'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gamePk = Number(searchParams.get('gamePk'))

  if (Number.isNaN(gamePk)) {
    return NextResponse.json({ error: 'Missing gamePk' }, { status: 400 })
  }

  try {
    const data = await getSummaryTabData(gamePk)
    if (!data) return NextResponse.json({ error: 'Summary unavailable' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/breakdown/summary] failed:', err)
    return NextResponse.json({ error: 'Summary temporarily unavailable' }, { status: 500 })
  }
}
