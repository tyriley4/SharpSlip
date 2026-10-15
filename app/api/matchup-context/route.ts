import { NextResponse } from 'next/server'
import { getMatchupContext } from '@/lib/research/matchupContext'
import type { Sport } from '@/lib/sport/SportContext'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SPORTS: Sport[] = ['mlb', 'nfl', 'cfb', 'nba', 'cbb', 'nhl']

/** GET /api/matchup-context?sport=nfl&team=DEN&opponent=SEA - head to head, current form, changes since the last meeting. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const sport = sp.get('sport') as Sport | null
  const team = sp.get('team')
  const opponent = sp.get('opponent')
  if (!sport || !SPORTS.includes(sport) || !team || !opponent) return NextResponse.json({ error: 'sport, team and opponent are required' }, { status: 400 })
  const data = await getMatchupContext(sport, team, opponent)
  return data ? NextResponse.json(data) : NextResponse.json({ error: 'No results on file for these teams' }, { status: 404 })
}
