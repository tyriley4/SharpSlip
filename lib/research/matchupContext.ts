import { currentSeasonYear, teamRecords } from '@/lib/edges/data/gameContext'
import { ESPN_REF, getInjuries } from '@/lib/espn/api'
import { cached } from '@/lib/net/ttlCache'
import type { Sport } from '@/lib/sport/SportContext'

/**
 * The four-part "vs This Opponent" picture for two teams: every recent meeting, how each side has played lately regardless
 * of opponent, what has changed since they last met, and how those fit together. Real results and the live injury report;
 * nothing here is estimated.
 */

export interface MeetingRow {
  season: number
  date: string
  home: boolean
  us: number
  them: number
  playoff?: boolean
}

export interface FormRow {
  date: string
  opp: string
  home: boolean
  us: number
  them: number
}

export interface MatchupContext {
  team: string
  opponent: string
  meetings: MeetingRow[]
  form: { team: FormRow[]; opponent: FormRow[] }
  changes: {
    lastMeeting: string | null
    /** Points scored and allowed per game over the five games before the last meeting, and over the latest five. */
    team: { before: { pf: number; pa: number } | null; now: { pf: number; pa: number } }
    opponent: { before: { pf: number; pa: number } | null; now: { pf: number; pa: number } }
    injuries: { team: string[]; opponent: string[] }
  }
  convergence: string
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
const f1 = (n: number) => n.toFixed(1)

export async function getMatchupContext(sport: Sport, team: string, opponent: string): Promise<MatchupContext | null> {
  return cached(`research:matchup:${sport}:${team}:${opponent}`, 3600, async () => {
    const cur = currentSeasonYear(sport)
    const [a, b] = await Promise.all([teamRecords(sport, team, [cur, cur - 1, cur - 2]), teamRecords(sport, opponent, [cur, cur - 1, cur - 2])])
    if (a.length === 0 || b.length === 0) return null
    const meetings = a.filter((g) => g.opp === opponent).map((g): MeetingRow => ({ season: g.season, date: g.date.slice(0, 10), home: g.home, us: g.us, them: g.them, playoff: g.playoff }))
    const row = (g: (typeof a)[number]): FormRow => ({ date: g.date.slice(0, 10), opp: g.opp, home: g.home, us: g.us, them: g.them })
    const formA = a.slice(0, 5).map(row)
    const formB = b.slice(0, 5).map(row)
    const nowA = { pf: mean(formA.map((g) => g.us)), pa: mean(formA.map((g) => g.them)) }
    const nowB = { pf: mean(formB.map((g) => g.us)), pa: mean(formB.map((g) => g.them)) }
    const last = meetings[0]?.date ?? null
    const before = (list: typeof a) => {
      if (!last) return null
      const prior = list.filter((g) => g.date.slice(0, 10) < last).slice(0, 5)
      return prior.length >= 3 ? { pf: mean(prior.map((g) => g.us)), pa: mean(prior.map((g) => g.them)) } : null
    }
    const ref = ESPN_REF[sport]
    const inj = await getInjuries(ref.sport, ref.league).catch(() => null)
    const out = (abbr: string) =>
      (inj ?? [])
        .filter((i) => i.team === abbr && ['out', 'doubtful', 'ir'].includes(i.designation))
        .slice(0, 6)
        .map((i) => `${i.player} (${i.position}, ${i.designation === 'ir' ? 'IR' : i.designation})`)

    // Convergence: the head-to-head record set against how each side is playing now.
    const last3 = meetings.slice(0, 3)
    const w = last3.filter((g) => g.us > g.them).length
    const wins = (f: FormRow[]) => f.filter((g) => g.us > g.them).length
    const histEdge = last3.length >= 2 ? (w / last3.length > 0.5 ? team : w / last3.length < 0.5 ? opponent : null) : null
    const formEdge = wins(formA) > wins(formB) ? team : wins(formA) < wins(formB) ? opponent : null
    let convergence: string
    if (last3.length === 1) convergence = `Only one meeting in the last three seasons (${team} ${last3[0].us > last3[0].them ? 'won' : 'lost'} ${last3[0].us}-${last3[0].them} on ${last3[0].date}), so tonight leans on current form: ${team} has won ${wins(formA)} of its last 5 and ${opponent} ${wins(formB)} of its last 5.`
    else if (last3.length === 0) convergence = `These teams have no meeting in the last three seasons, so tonight rests on current form: ${team} has won ${wins(formA)} of its last 5 and ${opponent} ${wins(formB)} of its last 5.`
    else if (histEdge && formEdge && histEdge === formEdge) convergence = `History and current form agree: ${histEdge} leads the recent meetings (${histEdge === team ? w : last3.length - w} of the last ${last3.length}) and has the better last five (${histEdge === team ? wins(formA) : wins(formB)} wins to ${histEdge === team ? wins(formB) : wins(formA)}).`
    else if (histEdge && formEdge && histEdge !== formEdge) convergence = `The history favors ${histEdge}, but ${formEdge} has played better lately (${formEdge === team ? wins(formA) : wins(formB)} wins in its last 5 against ${formEdge === team ? wins(formB) : wins(formA)}) — the matchup has shifted since they last met.`
    else convergence = `The recent meetings are ${histEdge ? `tilted toward ${histEdge}` : 'even'} and both sides' last-five records are close, so neither history nor form separates them.`

    return { team, opponent, meetings, form: { team: formA, opponent: formB }, changes: { lastMeeting: last, team: { before: before(a), now: nowA }, opponent: { before: before(b), now: nowB }, injuries: { team: out(team), opponent: out(opponent) } }, convergence } satisfies MatchupContext
  })
}

export { f1 as fmt1 }
