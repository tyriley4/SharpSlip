import { injuriesFor, scoreboardFor, type EspnInjury, type InjuryDesignation } from '@/lib/espn/api'
import type { Sport } from '@/lib/sport/SportContext'

export type InjuryStatus = InjuryDesignation

export interface Injury {
  player: string
  team: string
  sport: Sport
  position: string
  status: InjuryStatus
  /** Body part / injury type, e.g. "Knee". */
  injury: string
  /** One-line betting read for this designation. */
  impact: string
  /** ESPN's own note, when it has a short one. */
  comment: string | null
  returnDate: string | null
  /** ISO time ESPN last updated the designation. */
  updated: string | null
  /** True when the player's team has a game on today's slate. */
  teamPlaysToday: boolean
}

const SEVERITY: Record<InjuryStatus, number> = { out: 0, doubtful: 1, questionable: 2, gtd: 3, probable: 4, ir: 5 }

/** Positions whose absence moves lines the most (lower = more important). */
const POSITION_WEIGHT: Record<Sport, Record<string, number>> = {
  nfl: { QB: 0, RB: 1, WR: 1, TE: 2, OT: 3, LT: 3, RT: 3, OL: 3, DE: 3, DT: 3, LB: 3, CB: 3, S: 3, K: 4, P: 5 },
  mlb: { SP: 0, RP: 2, C: 1, SS: 1, CF: 1 },
  cfb: { QB: 0, RB: 1, WR: 1, TE: 2, OT: 3, OL: 3, DE: 3, DT: 3, LB: 3, CB: 3, S: 3, K: 4, P: 5 },
  nba: {},
  cbb: {},
  nhl: { G: 0, C: 1, LW: 2, RW: 2, D: 2 },
}

function impactFor(i: EspnInjury): string {
  const pos = i.position
  if (i.sport === 'nfl' && pos === 'QB') return i.designation === 'out' || i.designation === 'ir' ? 'Starting QB out — moves passing props and the team total toward the backup.' : 'Starting QB on the report — check his status before locking in passing props or the total.'
  if (i.sport === 'nhl' && pos === 'G') return 'Goalie on the report — shifts save props, the team total and the moneyline.'
  if (i.sport === 'mlb' && pos === 'SP') return 'Starting pitcher on the report — watch for a pitcher change before betting the game or his props.'
  switch (i.designation) {
    case 'out':
    case 'ir':
      return 'Ruled out — expect lineup and usage changes for teammates; check their props and the team total.'
    case 'doubtful':
      return 'Unlikely to play — treat as out when shopping props.'
    case 'questionable':
      return 'Game-time decision — wait for the final designation before locking in his props.'
    case 'gtd':
      return 'Day-to-day — confirm he is in the lineup before betting his props.'
    case 'probable':
      return 'Expected to play — worth a final lineup check pregame.'
  }
}

function toInjury(i: EspnInjury, playingToday: Set<string>): Injury {
  return {
    player: i.player,
    team: i.team,
    sport: i.sport,
    position: i.position,
    status: i.designation,
    injury: i.injury || 'Undisclosed',
    impact: impactFor(i),
    comment: i.comment && i.comment.length <= 160 && i.comment.toLowerCase() !== i.rawStatus.toLowerCase() ? i.comment : null,
    returnDate: i.returnDate,
    updated: i.updated,
    teamPlaysToday: playingToday.has(`${i.sport}:${i.team}`),
  }
}

/**
 * Real injury designations from ESPN across all four sports. Season-long IL stints are left out of the
 * home feed (they don't move tonight's lines); players on teams with a game today and the more
 * line-moving positions come first.
 */
export async function getHomeInjuries(options: { perSport?: number } = {}): Promise<Injury[]> {
  const perSport = options.perSport ?? 8
  const sports: Sport[] = ['nfl', 'cfb', 'mlb', 'nba', 'cbb', 'nhl']

  const [lists, boards] = await Promise.all([
    Promise.all(sports.map((s) => injuriesFor(s).catch(() => null))),
    Promise.all(sports.map((s) => scoreboardFor(s, { ttl: 300 }).catch(() => null))),
  ])

  const playingToday = new Set<string>()
  const todayEt = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  sports.forEach((sport, idx) => {
    for (const g of boards[idx]?.games ?? []) {
      // NFL's scoreboard spans the week; for the others it is already today's slate.
      const gameDay = new Date(g.date).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
      if ((sport === 'nfl' || sport === 'cfb') && gameDay !== todayEt) continue
      if (g.state === 'post' && sport !== 'nfl' && sport !== 'cfb') continue
      playingToday.add(`${sport}:${g.home.abbr}`)
      playingToday.add(`${sport}:${g.away.abbr}`)
    }
  })

  const out: Injury[] = []
  sports.forEach((sport, idx) => {
    const list = lists[idx]
    if (!list) return
    const candidates = list
      .filter((i) => i.designation !== 'ir' && i.designation !== 'probable')
      // Daily sports: only teams that play today matter. NFL injuries matter all week.
      .filter((i) => sport === 'nfl' || sport === 'cfb' || playingToday.has(`${sport}:${i.team}`))
      .map((i) => toInjury(i, playingToday))
    // Blend of how firm the designation is, how much the position moves lines, and whether the team plays today.
    const w = POSITION_WEIGHT[sport]
    const score = (i: Injury) => SEVERITY[i.status] * 1.5 + (w[i.position] ?? 6) - (i.teamPlaysToday ? 2 : 0)
    candidates.sort((a, b) => score(a) - score(b) || (b.updated ?? '').localeCompare(a.updated ?? ''))
    out.push(...candidates.slice(0, perSport))
  })
  return out
}
