import { NFL_TEAM_DIVISIONS, NFL_TEAM_NAMES, normalizeNflAbbr } from '@/lib/nfl/divisions'
import { cityFromName, finalizeRows, formatPct, normalizeStreak } from './common'
import type { SportStandings, StandingsRow } from './types'

type Result = 'W' | 'L' | 'T'

interface Tally {
  w: number
  l: number
  t: number
  homeW: number
  homeL: number
  homeT: number
  awayW: number
  awayL: number
  awayT: number
  divW: number
  divL: number
  divT: number
  confW: number
  confL: number
  confT: number
  pf: number
  pa: number
  atsW: number
  atsL: number
  atsP: number
  ouO: number
  ouU: number
  ouP: number
  results: Result[]
  atsResults: ('W' | 'L' | 'P')[]
}

const blank = (): Tally => ({
  w: 0, l: 0, t: 0, homeW: 0, homeL: 0, homeT: 0, awayW: 0, awayL: 0, awayT: 0,
  divW: 0, divL: 0, divT: 0, confW: 0, confL: 0, confT: 0, pf: 0, pa: 0,
  atsW: 0, atsL: 0, atsP: 0, ouO: 0, ouU: 0, ouP: 0, results: [], atsResults: [],
})

const rec = (w: number, l: number, t: number) => (t > 0 ? `${w}-${l}-${t}` : `${w}-${l}`)
const signed = (n: number) => (n > 0 ? `+${n}` : String(n))
const conferenceOf = (abbr: string) => NFL_TEAM_DIVISIONS[abbr]?.slice(0, 3) ?? ''

function streakOf(results: Result[]): string {
  if (results.length === 0) return ''
  const last = results[results.length - 1]
  let n = 0
  for (let i = results.length - 1; i >= 0 && results[i] === last; i--) n++
  return `${last}${n}`
}

/** Builds NFL standings (incl. splits, point differential and ATS / O-U records) from a season's games.csv rows. */
export function buildNflStandings(schedule: Record<string, string>[]): SportStandings {
  const tallies = new Map<string, Tally>()
  for (const abbr of Object.keys(NFL_TEAM_DIVISIONS)) tallies.set(abbr, blank())

  const played = schedule
    .filter((r) => r.game_type === 'REG' && r.home_score !== '' && r.away_score !== '')
    .sort((a, b) => `${a.gameday}${a.gametime ?? ''}`.localeCompare(`${b.gameday}${b.gametime ?? ''}`))

  for (const g of played) {
    const home = normalizeNflAbbr(g.home_team)
    const away = normalizeNflAbbr(g.away_team)
    const th = tallies.get(home)
    const ta = tallies.get(away)
    if (!th || !ta) continue
    const hs = Number(g.home_score)
    const as = Number(g.away_score)
    const sameDiv = NFL_TEAM_DIVISIONS[home] === NFL_TEAM_DIVISIONS[away]
    const sameConf = conferenceOf(home) === conferenceOf(away)

    const apply = (t: Tally, side: 'home' | 'away', result: Result, pf: number, pa: number) => {
      const k = result.toLowerCase() as 'w' | 'l' | 't'
      t[k]++
      t[`${side}${result}` as 'homeW']++
      if (sameDiv) t[`div${result}` as 'divW']++
      if (sameConf) t[`conf${result}` as 'confW']++
      t.pf += pf
      t.pa += pa
      t.results.push(result)
    }
    const hr: Result = hs > as ? 'W' : hs < as ? 'L' : 'T'
    const ar: Result = hs > as ? 'L' : hs < as ? 'W' : 'T'
    apply(th, 'home', hr, hs, as)
    apply(ta, 'away', ar, as, hs)

    // nflverse spread_line: positive = home favored, so home covers when (margin − spread) > 0.
    if (g.spread_line !== '' && g.spread_line !== undefined) {
      const edge = hs - as - Number(g.spread_line)
      if (edge > 0) { th.atsW++; ta.atsL++; th.atsResults.push('W'); ta.atsResults.push('L') }
      else if (edge < 0) { th.atsL++; ta.atsW++; th.atsResults.push('L'); ta.atsResults.push('W') }
      else { th.atsP++; ta.atsP++; th.atsResults.push('P'); ta.atsResults.push('P') }
    }
    if (g.total_line !== '' && g.total_line !== undefined) {
      const diff = hs + as - Number(g.total_line)
      const key = diff > 0 ? 'ouO' : diff < 0 ? 'ouU' : 'ouP'
      th[key]++
      ta[key]++
    }
  }

  const rows: StandingsRow[] = []
  tallies.forEach((t, abbr) => {
    const name = NFL_TEAM_NAMES[abbr]
    if (!name) return
    const gp = t.w + t.l + t.t
    const pctNum = gp > 0 ? (t.w + t.t * 0.5) / gp : 0
    const last10 = t.results.slice(-10)
    const l10w = last10.filter((r) => r === 'W').length
    const l10l = last10.filter((r) => r === 'L').length
    const l10t = last10.length - l10w - l10l
    const hasAts = t.atsW + t.atsL + t.atsP > 0
    const last5 = t.results.slice(-5)
    const l5w = last5.filter((r) => r === 'W').length
    const l5l = last5.filter((r) => r === 'L').length
    const atsL5 = t.atsResults.slice(-5)
    const a5w = atsL5.filter((r) => r === 'W').length
    const a5l = atsL5.filter((r) => r === 'L').length
    const hasOu = t.ouO + t.ouU + t.ouP > 0
    rows.push({
      abbr,
      name,
      city: cityFromName(name),
      conference: conferenceOf(abbr),
      division: NFL_TEAM_DIVISIONS[abbr],
      divRank: 0,
      gp,
      w: t.w,
      l: t.l,
      t: t.t,
      pts: null,
      pct: formatPct(pctNum),
      pctNum,
      gb: '',
      home: rec(t.homeW, t.homeL, t.homeT),
      away: rec(t.awayW, t.awayL, t.awayT),
      last10: gp > 0 ? rec(l10w, l10l, l10t) : '—',
      last5: gp > 0 ? rec(l5w, l5l, last5.length - l5w - l5l) : '—',
      atsLast5: atsL5.length > 0 ? rec(a5w, a5l, atsL5.length - a5w - a5l) : null,
      streak: normalizeStreak(streakOf(t.results)),
      extras: [{ key: 'pd', label: 'PD', value: signed(t.pf - t.pa) }],
      subline: [
        { key: 'div', label: 'DIV', value: rec(t.divW, t.divL, t.divT) },
        { key: 'conf', label: 'CONF', value: rec(t.confW, t.confL, t.confT) },
      ],
      ats: hasAts ? rec(t.atsW, t.atsL, t.atsP) : null,
      ou: hasOu ? rec(t.ouO, t.ouU, t.ouP) : null,
    })
  })

  return {
    sport: 'nfl',
    conferences: [
      { id: 'AFC', label: 'American Football Conference', divisions: ['AFC East', 'AFC North', 'AFC South', 'AFC West'] },
      { id: 'NFC', label: 'National Football Conference', divisions: ['NFC East', 'NFC North', 'NFC South', 'NFC West'] },
    ],
    rows: finalizeRows(rows),
    totalGames: 17,
    unit: 1,
    tColumn: 'T',
    playoff: { kind: 'divWc', wildCards: 3 },
  }
}
