import { ESPN_REF, getRankings, getStandings, type RankingPoll, type StandingsGroup } from '@/lib/espn/api'
import { cached } from '@/lib/net/ttlCache'
import { conferenceShort, getCollegeDirectory, POWER_CONFERENCES, type CollegeSport } from './directory'

export interface CollegeStandRow {
  rank: number
  teamId: string
  abbr: string
  name: string
  logo: string | null
  color: string
  w: number
  l: number
  pct: number
  confW: number
  confL: number
  confPct: number
  home: string
  away: string
  streak: string
  pf: number | null
  pa: number | null
  /** Current AP rank when the team is in the Top 25. */
  apRank: number | null
}

export interface CollegeConferenceTable {
  name: string
  abbr: string
  power: boolean
  groups: { title: string | null; rows: CollegeStandRow[] }[]
}

export interface PollView {
  key: 'cfp' | 'ap' | 'coaches'
  name: string
  /** False when the poll doesn't exist yet (the CFP committee's first release is in November). */
  available: boolean
  note: string | null
  week: number | null
  updated: string | null
  rows: {
    rank: number
    previous: number | null
    movement: number | null
    teamId: string
    abbr: string
    name: string
    logo: string | null
    color: string
    record: string | null
    conferenceAbbr: string
    points: number | null
    firstPlaceVotes: number | null
  }[]
}

export interface CollegeStandingsData {
  sport: CollegeSport
  /** ESPN season year the tables come from (2026 = the 2025-26 basketball season, the 2026 football season). */
  season: number
  seasonLabel: string
  /** True when the current season hasn't produced results yet and these are last season's final standings. */
  lastSeason: boolean
  conferences: CollegeConferenceTable[]
  polls: PollView[]
}

const parse = (rec: string | undefined): [number, number] => {
  const m = /^(\d+)-(\d+)/.exec(rec ?? '')
  return m ? [Number(m[1]), Number(m[2])] : [0, 0]
}

const noGames = (groups: StandingsGroup[]) => groups.every((g) => g.entries.every((e) => (e.nums.wins ?? 0) + (e.nums.losses ?? 0) === 0))

async function build(sport: CollegeSport): Promise<CollegeStandingsData | null> {
  const { sport: es, league } = ESPN_REF[sport]
  let groups = await getStandings(es, league)
  if (!groups) return null
  let lastSeason = false
  const board = await getRankings(es, league).catch(() => null)
  let season = new Date().getUTCFullYear()
  if (sport === 'cbb') {
    // Basketball seasons are named by the year they end in (2027 = 2026-27). Standings with games in them mean the season is under way;
    // before that (every team 0-0, or no table yet) show the previous season's final standings and say so.
    const now = new Date()
    const current = now.getUTCMonth() >= 6 ? now.getUTCFullYear() + 1 : now.getUTCFullYear()
    const cur = await getStandings(es, league, current).catch(() => null)
    if (cur && !noGames(cur)) {
      groups = cur
      season = current
    } else {
      const prev = await getStandings(es, league, current - 1).catch(() => null)
      if (prev && !noGames(prev)) {
        groups = prev
        lastSeason = true
        season = current - 1
      } else {
        season = current
      }
    }
  }
  const dir = await getCollegeDirectory(sport)
  const polls = board ?? []
  const ap = polls.find((p) => /AP Top 25/i.test(p.name))
  const apRank = new Map((ap?.ranks ?? []).map((r) => [r.teamId, r.rank]))

  const byConf = new Map<string, CollegeConferenceTable>()
  for (const g of groups) {
    let conf = byConf.get(g.conference)
    if (!conf) {
      conf = { name: g.conference, abbr: conferenceShort(g.conference, g.conferenceAbbr), power: POWER_CONFERENCES.includes(g.conference), groups: [] }
      byConf.set(g.conference, conf)
    }
    const rows: CollegeStandRow[] = g.entries.map((e, i) => {
      const [w, l] = parse(e.records.total)
      const [cw, cl] = parse(e.records.vsconf)
      const t = dir?.byId.get(e.teamId)
      return {
        rank: i + 1,
        teamId: e.teamId,
        abbr: t?.abbr ?? e.abbr,
        name: t?.shortName ?? e.shortName,
        logo: t?.logo ?? e.logo,
        color: t?.color ?? '#4d9fff',
        w,
        l,
        pct: w + l > 0 ? w / (w + l) : 0,
        confW: cw,
        confL: cl,
        confPct: cw + cl > 0 ? cw / (cw + cl) : 0,
        home: e.records.homerecord ?? '—',
        away: e.records.awayrecord ?? '—',
        streak: e.streak,
        pf: e.nums.pointsFor ?? null,
        pa: e.nums.pointsAgainst ?? null,
        apRank: apRank.get(e.teamId) ?? null,
      }
    })
    // Conference standings order by conference record, then overall.
    rows.sort((a, b) => b.confPct - a.confPct || b.confW - a.confW || b.pct - a.pct || b.w - a.w)
    rows.forEach((r, i) => (r.rank = i + 1))
    conf.groups.push({ title: g.division, rows })
  }
  const order = (c: CollegeConferenceTable) => (c.power ? POWER_CONFERENCES.indexOf(c.name) : 10 + (c.name.includes('Independent') ? 50 : 0))
  const conferences = Array.from(byConf.values()).sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name))

  const toPoll = (key: PollView['key'], p: RankingPoll | undefined, fallbackName: string, missingNote: string | null): PollView => ({
    key,
    name: p?.shortName && p.shortName !== p.name ? p.shortName : (p?.name ?? fallbackName),
    available: !!p,
    note: p ? null : missingNote,
    week: p?.week ?? null,
    updated: p?.updated ?? null,
    rows: (p?.ranks ?? []).map((r) => {
      const t = dir?.byId.get(r.teamId)
      return {
        rank: r.rank,
        previous: r.previous,
        movement: r.movement,
        teamId: r.teamId,
        abbr: t?.abbr ?? r.abbr,
        name: t?.shortName ?? r.name,
        logo: t?.logo ?? r.logo,
        color: t?.color ?? '#4d9fff',
        record: r.record,
        conferenceAbbr: t?.conferenceAbbr ?? '',
        points: r.points,
        firstPlaceVotes: r.firstPlaceVotes,
      }
    }),
  })

  const cfp = polls.find((p) => /College Football Playoff|CFP/i.test(p.name))
  const coaches = polls.find((p) => /Coaches/i.test(p.name))
  const pollViews: PollView[] =
    sport === 'cfb'
      ? [
          toPoll('cfp', cfp, 'College Football Playoff', 'The College Football Playoff committee releases its first rankings in early November, then every Tuesday.'),
          toPoll('ap', ap, 'AP Top 25', null),
          toPoll('coaches', coaches, 'Coaches Poll', null),
        ]
      : [toPoll('ap', ap, 'AP Top 25', null), toPoll('coaches', coaches, 'Coaches Poll', null)]

  return {
    sport,
    season,
    seasonLabel: sport === 'cfb' ? `${season}` : `${season - 1}-${String(season).slice(2)}`,
    lastSeason,
    conferences,
    polls: pollViews,
  }
}

export async function getCollegeStandings(sport: CollegeSport): Promise<CollegeStandingsData | null> {
  return cached(`college:standings:v3:${sport}`, 1800, () => build(sport))
}
