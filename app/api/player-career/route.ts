import { NextResponse } from 'next/server'
import { getCareerPayload, type CareerSport } from '@/lib/props/careerLogs'

export const maxDuration = 60

const SPORTS: CareerSport[] = ['mlb', 'nfl', 'nba', 'nhl']

/** GET /api/player-career?sport=&playerId=&group=&goalie=&scope=season|career returns flattened multi-season game logs (7-day cache). */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const sport = sp.get('sport') as CareerSport | null
  const playerId = sp.get('playerId') ?? ''
  if (!sport || !SPORTS.includes(sport) || !playerId) return NextResponse.json({ error: 'Missing sport or playerId' }, { status: 400 })
  const payload = await getCareerPayload({
    sport,
    playerId,
    group: sp.get('group') === 'pitching' ? 'pitching' : 'hitting',
    goalie: sp.get('goalie') === 'true',
    scope: sp.get('scope') === 'season' ? 'season' : 'career',
  })
  if (!payload) return NextResponse.json({ error: 'Career data unavailable' }, { status: 404 })
  return NextResponse.json(payload)
}
