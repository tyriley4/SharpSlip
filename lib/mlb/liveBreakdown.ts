import { getGameBoxScoreDetail, getGameFeedLive, type RawBoxscorePlayer } from './api'

export interface CurrentPitcherLine {
  id: number
  name: string
  ip: string
  h: number
  er: number
  k: number
  bb: number
}

export interface CurrentBatterLine {
  id: number
  name: string
  seasonAvg: string
  todayAtBats: number
  todayHits: number
  todaySummary: string
}

export interface PropTrackerRow {
  name: string
  team: 'away' | 'home'
  hits: number
  atBats: number
  note: string
}

export interface LiveGameState {
  awayScore: number
  homeScore: number
  inning: number
  inningState: string
  outs: number
  balls: number
  strikes: number
  currentPitcher: CurrentPitcherLine | null
  currentBatter: CurrentBatterLine | null
  lastPlays: string[]
  propTracker: PropTrackerRow[]
}

function findBoxscorePlayer(players: Record<string, RawBoxscorePlayer>, id: number): RawBoxscorePlayer | undefined {
  return players[`ID${id}`]
}

export async function getLiveGameState(gamePk: number): Promise<LiveGameState | null> {
  const [feed, box] = await Promise.all([getGameFeedLive(gamePk, 30), getGameBoxScoreDetail(gamePk, 30)])
  if (!feed) return null

  const ld = feed.liveData
  const linescore = ld.linescore

  let currentPitcher: CurrentPitcherLine | null = null
  const pitcherRef = linescore?.defense?.pitcher
  if (pitcherRef && box) {
    const allPlayers = { ...box.teams.away.players, ...box.teams.home.players }
    const p = findBoxscorePlayer(allPlayers, pitcherRef.id)
    const pitching = p?.stats.pitching
    if (pitching) {
      currentPitcher = {
        id: pitcherRef.id,
        name: pitcherRef.fullName,
        ip: String(pitching.inningsPitched ?? '0'),
        h: Number(pitching.hits ?? 0),
        er: Number(pitching.earnedRuns ?? 0),
        k: Number(pitching.strikeOuts ?? 0),
        bb: Number(pitching.baseOnBalls ?? 0),
      }
    }
  }

  let currentBatter: CurrentBatterLine | null = null
  const batterRef = linescore?.offense?.batter
  if (batterRef && box) {
    const allPlayers = { ...box.teams.away.players, ...box.teams.home.players }
    const p = findBoxscorePlayer(allPlayers, batterRef.id)
    if (p) {
      const today = p.stats.batting ?? {}
      const season = p.seasonStats.batting ?? {}
      const h = Number(today.hits ?? 0)
      const ab = Number(today.atBats ?? 0)
      currentBatter = {
        id: batterRef.id,
        name: batterRef.fullName,
        seasonAvg: String(season.avg ?? '—'),
        todayAtBats: ab,
        todayHits: h,
        todaySummary: ab > 0 ? `${h}-${ab} today` : 'First at-bat',
      }
    }
  }

  const allPlays = ld.plays?.allPlays ?? []
  const lastPlays = allPlays
    .filter((p) => p.about?.isComplete && p.result?.description)
    .slice(-5)
    .reverse()
    .map((p) => p.result!.description!)

  const propTracker: PropTrackerRow[] = []
  if (box) {
    for (const side of ['away', 'home'] as const) {
      const team = box.teams[side]
      for (const id of team.battingOrder ?? []) {
        const p = team.players[`ID${id}`]
        if (!p) continue
        const bat = p.stats.batting ?? {}
        const h = Number(bat.hits ?? 0)
        const ab = Number(bat.atBats ?? 0)
        if (ab === 0) continue
        const note = h >= 1 ? `${h} hit${h !== 1 ? 's' : ''} in ${ab} AB — cleared 1+ hits` : `0 hits in ${ab} AB — needs 1 for 1+ hits`
        propTracker.push({ name: p.person.fullName, team: side, hits: h, atBats: ab, note })
      }
    }
  }

  return {
    awayScore: ld.linescore?.teams?.away?.runs ?? 0,
    homeScore: ld.linescore?.teams?.home?.runs ?? 0,
    inning: linescore?.currentInning ?? 1,
    inningState: linescore?.inningState ?? '',
    outs: linescore?.outs ?? 0,
    balls: linescore?.balls ?? 0,
    strikes: linescore?.strikes ?? 0,
    currentPitcher,
    currentBatter,
    lastPlays,
    propTracker,
  }
}
