import { NextResponse } from 'next/server'
import { getPlayerConviction } from '@/lib/edges/playerEdge'
import type { Sport } from '@/lib/sport/SportContext'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SPORTS: Sport[] = ['mlb', 'nfl', 'cfb', 'nba', 'cbb', 'nhl']

/** GET /api/player-conviction?sport=nba&name=...&team=LAL&category=Points&thresholds=15,20,25 - conviction per prop threshold vs tonight's game. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const sport = sp.get('sport') as Sport | null
  const name = sp.get('name')
  const team = sp.get('team')
  const category = sp.get('category')
  const thresholds = (sp.get('thresholds') ?? '')
    .split(',')
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .slice(0, 20)
  if (!sport || !SPORTS.includes(sport) || !name || !team || !category || thresholds.length === 0) {
    return NextResponse.json({ error: 'sport, name, team, category and thresholds are required' }, { status: 400 })
  }
  return NextResponse.json(await getPlayerConviction({ sport, name, team, category, thresholds, pitching: sp.get('pitching') === '1' }))
}
