import { NextResponse } from 'next/server'
import { dateOffset, getUnifiedGamesForDate } from '@/lib/home/schedule'
import { cached } from '@/lib/net/ttlCache'
import type { Sport } from '@/lib/sport/SportContext'

export const dynamic = 'force-dynamic'

const SPORTS: Sport[] = ['mlb', 'nfl', 'cfb', 'nba', 'cbb', 'nhl']

/** GET /api/teams-today?sport=mlb: abbreviations of the teams with a game today (Eastern date) that has not finished. */
export async function GET(req: Request) {
  const sport = new URL(req.url).searchParams.get('sport') as Sport | null
  if (!sport || !SPORTS.includes(sport)) return NextResponse.json({ error: 'sport is required' }, { status: 400 })
  const games = (await cached('edges:todays-games', 600, () => getUnifiedGamesForDate(dateOffset(0)))) ?? []
  const teams = new Set<string>()
  for (const g of games) {
    if (g.sport !== sport || g.status === 'Final') continue
    teams.add(g.away.abbr)
    teams.add(g.home.abbr)
  }
  return NextResponse.json({ teams: Array.from(teams) })
}
