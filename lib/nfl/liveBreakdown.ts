import { findGame, getNFLLiveScores } from '@/lib/espn/api'

export interface NFLLiveState {
  available: boolean
  reason: string
  /** pre = not started, in = in progress, post = final. Null when ESPN doesn't list the game. */
  state: 'pre' | 'in' | 'post' | null
  awayScore: number | null
  homeScore: number | null
  period: number | null
  displayClock: string | null
  statusDetail: string | null
  /** TV network broadcasting the game. */
  network: string | null
  /** Abbreviation of the team with the ball (in-progress games). */
  possession: string | null
  /** e.g. "2nd & 7 at DEN 32". */
  downDistance: string | null
  isRedZone: boolean
  lastPlay: string | null
  venue: string | null
  awayRecord: string | null
  homeRecord: string | null
  /** ISO kickoff time, for games that haven't started. */
  kickoff: string | null
  updatedAt: string
}

const NFLVERSE_NOTE = 'Live scores come from ESPN in real time. nflverse (season stats, drives, prop tracking) updates within about an hour of the final whistle.'

function empty(reason: string): NFLLiveState {
  return {
    available: false,
    reason,
    state: null,
    awayScore: null,
    homeScore: null,
    period: null,
    displayClock: null,
    statusDetail: null,
    network: null,
    possession: null,
    downDistance: null,
    isRedZone: false,
    lastPlay: null,
    venue: null,
    awayRecord: null,
    homeRecord: null,
    kickoff: null,
    updatedAt: new Date().toISOString(),
  }
}

/** Real-time game state from ESPN's scoreboard (30s cache). Never throws. */
export async function getNFLLiveState(awayAbbr: string, homeAbbr: string): Promise<NFLLiveState> {
  try {
    const board = await getNFLLiveScores()
    if (!board) return empty(`ESPN's live feed is temporarily unavailable. ${NFLVERSE_NOTE}`)
    const game = findGame(board.games, awayAbbr, homeAbbr)
    if (!game) return empty(`ESPN doesn't list this game on this week's scoreboard yet. ${NFLVERSE_NOTE}`)
    console.log(`[nfl-live] ${awayAbbr}@${homeAbbr} state=${game.state} via ESPN (${board.origin})`)
    return {
      available: true,
      reason: NFLVERSE_NOTE,
      state: game.state,
      awayScore: game.state === 'pre' ? null : game.away.score,
      homeScore: game.state === 'pre' ? null : game.home.score,
      period: game.period || null,
      displayClock: game.clock,
      statusDetail: game.statusText,
      network: game.network,
      possession: game.situation?.possession ?? null,
      downDistance: game.situation?.downDistance ?? null,
      isRedZone: game.situation?.isRedZone ?? false,
      lastPlay: game.situation?.lastPlay ?? null,
      venue: game.venue,
      awayRecord: game.away.record,
      homeRecord: game.home.record,
      kickoff: game.date,
      updatedAt: new Date().toISOString(),
    }
  } catch (err) {
    console.error('[getNFLLiveState] failed:', err)
    return empty(NFLVERSE_NOTE)
  }
}
