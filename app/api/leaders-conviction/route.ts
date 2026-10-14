import { NextResponse } from 'next/server'
import { getPlayerConviction } from '@/lib/edges/playerEdge'
import type { Sport } from '@/lib/sport/SportContext'
import { mapWithConcurrency } from '@/lib/utils/concurrency'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SPORTS: Sport[] = ['mlb', 'nfl', 'cfb', 'nba', 'cbb', 'nhl']
const MAX_PLAYERS = 20

/**
 * GET /api/leaders-conviction?sport=nba&category=Points&threshold=24.5&players=Name~LAL,Name~BOS
 * Conviction for each player's prop against their team's game today; players with no game or no history come back null.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const sport = sp.get('sport') as Sport | null
  const category = sp.get('category')
  const threshold = Number(sp.get('threshold'))
  const players = (sp.get('players') ?? '')
    .split(',')
    .map((p) => p.split('~'))
    .filter((p) => p.length === 2 && p[0] && p[1])
    .slice(0, MAX_PLAYERS)
  if (!sport || !SPORTS.includes(sport) || !category || !Number.isFinite(threshold) || players.length === 0) {
    return NextResponse.json({ error: 'sport, category, threshold and players are required' }, { status: 400 })
  }
  const pitching = sp.get('pitching') === '1'
  const results: Record<string, { grade: string | null; convictionScore: number; isSharpFind: boolean; matchup?: string } | null> = {}
  await mapWithConcurrency(players, 4, async ([name, team]) => {
    const c = await getPlayerConviction({ sport, name, team, category, thresholds: [threshold], pitching })
    const row = c.available ? c.thresholds[0] : undefined
    results[`${name}|${team}`] = row ? { grade: row.grade, convictionScore: row.convictionScore, isSharpFind: row.isSharpFind, matchup: c.matchup } : null
  })
  return NextResponse.json({ results })
}
