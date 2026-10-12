import { getGameSummary } from '@/lib/espn/api'
import type { NFLLiveState } from '@/lib/nfl/liveBreakdown'
import { CFB_LEAGUE } from './engine'

const NOTE = 'Live scores come from ESPN in real time; team stats update as soon as ESPN posts each box score.'

/** Real-time state for a college football game (same shape the NFL Live tab renders). */
export async function getCfbLiveState(gameId: string): Promise<NFLLiveState> {
  const s = await getGameSummary('football', CFB_LEAGUE, gameId)
  const empty = (reason: string): NFLLiveState => ({
    available: false, reason, state: null, awayScore: null, homeScore: null, period: null, displayClock: null, statusDetail: null, network: null,
    possession: null, downDistance: null, isRedZone: false, lastPlay: null, venue: null, awayRecord: null, homeRecord: null, kickoff: null, updatedAt: new Date().toISOString(),
  })
  if (!s) return empty(`ESPN's live feed is temporarily unavailable. ${NOTE}`)
  const away = s.teams.find((t) => t.homeAway === 'away')
  const home = s.teams.find((t) => t.homeAway === 'home')
  if (!away || !home) return empty(NOTE)
  return {
    available: true,
    reason: NOTE,
    state: s.state,
    awayScore: s.state === 'pre' ? null : away.score,
    homeScore: s.state === 'pre' ? null : home.score,
    period: s.period || null,
    displayClock: s.clock,
    statusDetail: s.statusText,
    network: s.network,
    possession: s.situation?.possession ?? null,
    downDistance: s.situation?.downDistance ?? null,
    isRedZone: s.situation?.isRedZone ?? false,
    lastPlay: s.situation?.lastPlay ?? s.recentPlays[s.recentPlays.length - 1]?.text ?? null,
    venue: s.venue.name,
    awayRecord: away.record,
    homeRecord: home.record,
    kickoff: s.date,
    updatedAt: new Date().toISOString(),
  }
}
