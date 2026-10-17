import { findMlbPlayerIdBySlug } from '@/lib/mlb/playerLookup'
import { getMlbTeamsIndex } from '@/lib/mlb/teams'
import { cached } from '@/lib/net/ttlCache'
import { slugify } from '@/lib/players/slug'
import { mapWithConcurrency } from '@/lib/utils/concurrency'
import { loadMlbGameInfo, type MlbGameInfo } from './mlbGame'

/**
 * MLB data connections. Everything here comes from the MLB Stats API (statsapi.mlb.com): starter game logs including
 * postseason starts, splits, career lines against tonight's opponent; the announced lineup's platoon splits and career
 * numbers against tonight's starter; team form over the last 7 and 15 days; series status; and bullpen usage from the
 * boxscores of the series games already played. Nothing is invented: a fact is only produced when its call returned data.
 */

const API = 'https://statsapi.mlb.com/api/v1'

async function get<T>(url: string, revalidate = 21600): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate } })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

/** "6.2" innings means six and two thirds. */
const ip = (s: string | number | undefined) => {
  const [w, f] = String(s ?? '0').split('.')
  return Number(w) + Number(f ?? 0) / 3
}
const mdY = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`
const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * 86400000)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PitchSplit {
  ip: number
  era: number
  k9: number
  whip: number
  /** Walks and home runs per nine. */
  bb9: number
  hr9: number
  kPct: number
  bf: number
}

export interface StartLine {
  date: string
  opp: string
  ip: number
  h: number
  er: number
  ab: number
  bb: number
  k: number
  hr: number
  win: boolean
  home: boolean
  playoff: boolean
}

export interface StarterFacts {
  id: number
  name: string
  slug: string
  hand: 'L' | 'R' | null
  /** Newest first, regular season and postseason together. */
  starts: StartLine[]
  season: PitchSplit | null
  splits: Partial<Record<'vl' | 'vr' | 'h' | 'a' | 'd' | 'n', PitchSplit>>
  /** Career against tonight's opponent: the line opposing hitters have put up against him. */
  vsTeam: { games: number; pa: number; kPct: number; avg: number; ops: string } | null
  restDays: number | null
}

/** A hitter's average and OPS against one handedness this season. */
export interface HandLine {
  avg: number
  ops: string
  ab: number
  pa: number
}

export interface BatterFacts {
  id: number
  name: string
  side: 'L' | 'R' | 'S' | null
  vsHand: { pa: number; k: number; avg: number } | null
  /** Both splits, so a platoon edge is confirmed (or contradicted) by the hitter's own numbers. */
  splits: { vl: HandLine | null; vr: HandLine | null }
  /** Average over his last ten games against his season average. */
  form: { last10Avg: number | null; last10Ab: number; seasonAvg: number | null }
  vsPitcher: { pa: number; ab: number; h: number; k: number; hr: number } | null
}

export interface LineupFacts {
  team: string
  /** The starter this lineup faces tonight. */
  facing: { id: number; name: string; hand: 'L' | 'R' | null }
  batters: BatterFacts[]
  kPctVsHand: number | null
  paVsHand: number
  lefties: number
  righties: number
  switches: number
  /** Starters with at least five career plate appearances against the starter. */
  facedCount: number
  facedPa: number
  facedAvg: number | null
  facedKPct: number | null
}

export interface TeamRecent {
  days: number
  games: number
  runsPerGame: number
  avg: number
  kPct: number
}

/** One reliever's work in the last two days, with how much his role matters tonight. */
export interface UsedArm {
  name: string
  ip: number
  pitches: number
  /** 1 = yesterday, 2 = two days ago. */
  daysBefore: number
  role: 'closer' | 'setup' | 'middle' | 'long'
  saves: number
  holds: number
}

export interface BullpenFacts {
  team: string
  /** Every reliever who pitched in the last two days. */
  used: UsedArm[]
  /** Relief innings thrown in the team's games over the last two days. */
  lastTwoDaysInnings: number
  /** Games behind that figure. */
  games: number
  /** Relievers who threw yesterday. */
  usedYesterday: string[]
  /** Season relief ERA and innings (null until the split is published). */
  era: number | null
  ip: number
}

export interface SeriesFacts {
  description: string
  short: string
  result: string
  gameNumber: number
  totalGames: number
  leader: string | null
  leaderWins: number
  trailWins: number
  isOver: boolean
}

/** A team's hitting against left- and right-handed pitching this season (team-level, the stored stat behind the lineup view). */
export interface TeamHandSplits {
  vl: { kPct: number; avg: number; ops: string; pa: number } | null
  vr: { kPct: number; avg: number; ops: string; pa: number } | null
}

/** A hitter who is out tonight and was a real bat in the lineup (wRC+ above 110 over a meaningful sample). */
export interface KeyBatOut {
  name: string
  position: string
  wrcPlus: number
  pa: number
  designation: string
}

export interface MlbGameFacts {
  /** Impact bats missing from each team (hitters only; relievers and bench bats are never listed). */
  keyBatsOut: { away: KeyBatOut[]; home: KeyBatOut[] }
  teamVsHand: { away: TeamHandSplits; home: TeamHandSplits }
  series: SeriesFacts | null
  starters: { away: StarterFacts | null; home: StarterFacts | null }
  lineups: { away: LineupFacts | null; home: LineupFacts | null }
  bullpen: { away: BullpenFacts | null; home: BullpenFacts | null }
  recent: { away: { d7: TeamRecent | null; d15: TeamRecent | null }; home: { d7: TeamRecent | null; d15: TeamRecent | null } }
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

interface RawStat {
  inningsPitched?: string
  hits?: number
  earnedRuns?: number
  baseOnBalls?: number
  strikeOuts?: number
  battersFaced?: number
  gamesStarted?: number
  plateAppearances?: number
  atBats?: number
  homeRuns?: number
  avg?: string
  ops?: string
  runs?: number
}
interface RawSplit {
  date?: string
  isHome?: boolean
  isWin?: boolean
  season?: string
  split?: { code?: string }
  opponent?: { id: number }
  stat: RawStat
}
type StatsResp = { stats?: { splits?: RawSplit[] }[] }

const splitsOf = (r: StatsResp | null) => r?.stats?.[0]?.splits ?? []

function toSplit(s: RawStat): PitchSplit | null {
  const inn = ip(s.inningsPitched)
  if (inn <= 0) return null
  const bf = s.battersFaced ?? 0
  return { ip: inn, era: ((s.earnedRuns ?? 0) * 9) / inn, k9: ((s.strikeOuts ?? 0) * 9) / inn, whip: ((s.hits ?? 0) + (s.baseOnBalls ?? 0)) / inn, bb9: ((s.baseOnBalls ?? 0) * 9) / inn, hr9: ((s.homeRuns ?? 0) * 9) / inn, kPct: bf > 0 ? ((s.strikeOuts ?? 0) / bf) * 100 : 0, bf }
}

export async function loadStarterFacts(id: number, name: string, opponentTeamId: number, officialDate: string, year: number): Promise<StarterFacts> {
  return (
    (await cached(`edges:mlbstarter:${id}:${opponentTeamId}:${officialDate}`, 6 * 3600, async () => {
      const teams = await getMlbTeamsIndex().catch(() => null)
      const [person, reg, post, splits, season, vs] = await Promise.all([
        get<{ people?: { pitchHand?: { code?: string } }[] }>(`${API}/people/${id}?fields=people,id,pitchHand,code`),
        get<StatsResp>(`${API}/people/${id}/stats?stats=gameLog&group=pitching&season=${year}`),
        get<StatsResp>(`${API}/people/${id}/stats?stats=gameLog&group=pitching&season=${year}&gameType=P`),
        get<StatsResp>(`${API}/people/${id}/stats?stats=statSplits&group=pitching&sitCodes=vl,vr,h,a,d,n&season=${year}`),
        get<StatsResp>(`${API}/people/${id}/stats?stats=season&group=pitching&season=${year}`),
        get<StatsResp>(`${API}/people/${id}/stats?stats=vsTeam&group=pitching&opposingTeamId=${opponentTeamId}`),
      ])
      const h = person?.people?.[0]?.pitchHand?.code
      const toLine = (s: RawSplit, playoff: boolean): StartLine | null => {
        if ((s.stat.gamesStarted ?? 0) < 1) return null
        return { date: s.date ?? '', opp: teams?.get(s.opponent?.id ?? 0)?.abbr ?? '', ip: ip(s.stat.inningsPitched), h: s.stat.hits ?? 0, er: s.stat.earnedRuns ?? 0, ab: s.stat.atBats ?? 0, bb: s.stat.baseOnBalls ?? 0, k: s.stat.strikeOuts ?? 0, hr: s.stat.homeRuns ?? 0, win: !!s.isWin, home: !!s.isHome, playoff }
      }
      // Starts before tonight only: a game already under way must not feed its own evidence.
      const starts = [...splitsOf(reg).map((s) => toLine(s, false)), ...splitsOf(post).map((s) => toLine(s, true))].filter((x): x is StartLine => x !== null && x.date < officialDate).sort((a, b) => b.date.localeCompare(a.date))
      const sp: StarterFacts['splits'] = {}
      for (const s of splitsOf(splits)) {
        const code = s.split?.code as keyof StarterFacts['splits'] | undefined
        const v = toSplit(s.stat)
        if (code && v) sp[code] = v
      }
      const vsStat = splitsOf(vs)[0]?.stat as (RawStat & { gamesPlayed?: number; ops?: string }) | undefined
      const lastStart = starts.find((s) => s.date < officialDate)
      return {
        id,
        name,
        slug: slugify(name),
        hand: h === 'L' || h === 'R' ? h : null,
        starts,
        season: splitsOf(season)[0] ? toSplit(splitsOf(season)[0].stat) : null,
        splits: sp,
        vsTeam: vsStat && (vsStat.plateAppearances ?? 0) >= 20 ? { games: vsStat.gamesPlayed ?? 0, pa: vsStat.plateAppearances ?? 0, kPct: ((vsStat.strikeOuts ?? 0) / (vsStat.plateAppearances ?? 1)) * 100, avg: Number(vsStat.avg ?? 0), ops: vsStat.ops ?? '' } : null,
        restDays: lastStart ? Math.round((Date.parse(officialDate) - Date.parse(lastStart.date)) / 86400000) - 1 : null,
      } satisfies StarterFacts
    })) ?? { id, name, slug: slugify(name), hand: null, starts: [], season: null, splits: {}, vsTeam: null, restDays: null }
  )
}

export async function loadLineupFacts(team: string, batters: { id: number; name: string }[], facing: { id: number; name: string; hand: 'L' | 'R' | null }, year: number): Promise<LineupFacts | null> {
  if (batters.length < 8) return null
  return cached(`edges:mlblineup:${team}:${facing.id}:${batters.map((b) => b.id).join('-')}`, 6 * 3600, async () => {
    const sides = await get<{ people?: { id: number; batSide?: { code?: string } }[] }>(`${API}/people?personIds=${batters.map((b) => b.id).join(',')}&fields=people,id,batSide,code`)
    const sideOf = new Map((sides?.people ?? []).map((p) => [p.id, p.batSide?.code]))
    const rows = await mapWithConcurrency(batters, 5, async (b): Promise<BatterFacts> => {
      const [sp, vs, log] = await Promise.all([
        get<StatsResp>(`${API}/people/${b.id}/stats?stats=statSplits&group=hitting&sitCodes=vl,vr&season=${year}`),
        get<StatsResp>(`${API}/people/${b.id}/stats?stats=vsPlayer&group=hitting&opposingPlayerId=${facing.id}`),
        get<StatsResp>(`${API}/people/${b.id}/stats?stats=gameLog&group=hitting&season=${year}`),
      ])
      const handOf = (code: 'vl' | 'vr'): HandLine | null => {
        const x = splitsOf(sp).find((q) => q.split?.code === code)?.stat
        return x && (x.atBats ?? 0) > 0 ? { avg: Number(x.avg ?? 0), ops: x.ops ?? '', ab: x.atBats ?? 0, pa: x.plateAppearances ?? 0 } : null
      }
      const handCode = facing.hand === 'L' ? 'vl' : 'vr'
      const s = facing.hand ? splitsOf(sp).find((q) => q.split?.code === handCode)?.stat : undefined
      const games = splitsOf(log).sort((a, b2) => (b2.date ?? '').localeCompare(a.date ?? ''))
      const last10 = games.slice(0, 10)
      const l10Ab = last10.reduce((n, g) => n + (g.stat.atBats ?? 0), 0)
      const l10H = last10.reduce((n, g) => n + (g.stat.hits ?? 0), 0)
      const sAb = games.reduce((n, g) => n + (g.stat.atBats ?? 0), 0)
      const sH = games.reduce((n, g) => n + (g.stat.hits ?? 0), 0)
      const v = splitsOf(vs)[0]?.stat
      const c = sideOf.get(b.id)
      return {
        id: b.id,
        name: b.name,
        side: c === 'L' || c === 'R' || c === 'S' ? c : null,
        vsHand: s ? { pa: s.plateAppearances ?? 0, k: s.strikeOuts ?? 0, avg: Number(s.avg ?? 0) } : null,
        splits: { vl: handOf('vl'), vr: handOf('vr') },
        form: { last10Avg: l10Ab >= 15 ? l10H / l10Ab : null, last10Ab: l10Ab, seasonAvg: sAb >= 40 ? sH / sAb : null },
        vsPitcher: v ? { pa: v.plateAppearances ?? 0, ab: v.atBats ?? 0, h: v.hits ?? 0, k: v.strikeOuts ?? 0, hr: v.homeRuns ?? 0 } : null,
      }
    })
    // A switch hitter bats from the side opposite the pitcher's hand, so against a lefty he is a righty.
    const lefties = rows.filter((r) => r.side === 'L' || (r.side === 'S' && facing.hand === 'R')).length
    const switches = rows.filter((r) => r.side === 'S').length
    const righties = rows.filter((r) => r.side === 'R' || (r.side === 'S' && facing.hand === 'L')).length
    const pa = rows.reduce((n, r) => n + (r.vsHand?.pa ?? 0), 0)
    const k = rows.reduce((n, r) => n + (r.vsHand?.k ?? 0), 0)
    const faced = rows.filter((r) => (r.vsPitcher?.pa ?? 0) >= 5)
    const fPa = faced.reduce((n, r) => n + (r.vsPitcher?.pa ?? 0), 0)
    const fAb = faced.reduce((n, r) => n + (r.vsPitcher?.ab ?? 0), 0)
    const fH = faced.reduce((n, r) => n + (r.vsPitcher?.h ?? 0), 0)
    const fK = faced.reduce((n, r) => n + (r.vsPitcher?.k ?? 0), 0)
    return {
      team,
      facing,
      batters: rows,
      kPctVsHand: pa >= 150 ? (k / pa) * 100 : null,
      paVsHand: pa,
      lefties,
      righties,
      switches,
      facedCount: faced.length,
      facedPa: fPa,
      facedAvg: fAb > 0 ? fH / fAb : null,
      facedKPct: fPa > 0 ? (fK / fPa) * 100 : null,
    } satisfies LineupFacts
  })
}

export async function loadTeamHandSplits(teamId: number, year: number): Promise<TeamHandSplits> {
  return (
    (await cached(`edges:mlbteamhand:${teamId}:${year}`, 6 * 3600, async () => {
      const r = await get<StatsResp>(`${API}/teams/${teamId}/stats?stats=statSplits&group=hitting&sitCodes=vl,vr&season=${year}`)
      const pick = (code: string) => {
        const s = splitsOf(r).find((x) => x.split?.code === code)?.stat as (RawStat & { ops?: string }) | undefined
        const pa = s?.plateAppearances ?? 0
        return s && pa >= 100 ? { kPct: ((s.strikeOuts ?? 0) / pa) * 100, avg: Number(s.avg ?? 0), ops: s.ops ?? '', pa } : null
      }
      return { vl: pick('vl'), vr: pick('vr') } satisfies TeamHandSplits
    })) ?? { vl: null, vr: null }
  )
}

export async function loadTeamRecent(teamId: number, officialDate: string, days: number, year: number): Promise<TeamRecent | null> {
  return cached(`edges:mlbrecent:${teamId}:${officialDate}:${days}`, 3 * 3600, async () => {
    const r = await get<StatsResp>(`${API}/teams/${teamId}/stats?stats=byDateRange&group=hitting&startDate=${mdY(addDays(officialDate, -days))}&endDate=${mdY(addDays(officialDate, -1))}&season=${year}&gameType=R,D,L,W,F`, 3 * 3600)
    const s = splitsOf(r)[0]?.stat as (RawStat & { gamesPlayed?: number }) | undefined
    if (!s || !s.gamesPlayed) return null
    const pa = s.plateAppearances ?? 0
    return { days, games: s.gamesPlayed, runsPerGame: (s.runs ?? 0) / s.gamesPlayed, avg: Number(s.avg ?? 0), kPct: pa > 0 ? ((s.strikeOuts ?? 0) / pa) * 100 : 0 }
  })
}

interface Boxscore {
  teams?: Record<'away' | 'home', { team?: { id: number }; pitchers?: number[]; players?: Record<string, { person?: { id?: number; fullName?: string }; stats?: { pitching?: { inningsPitched?: string; numberOfPitches?: number } } }> }>
}

/** One team's relief use over the two days before tonight, from the boxscores of the games it played (final games never change). */
async function loadTeamBullpen(teamId: number, label: string, officialDate: string, year: number): Promise<BullpenFacts | null> {
  return cached(`edges:mlbpen2:${teamId}:${officialDate}`, 3600, async () => {
    const sched = await get<{ dates?: { games: { gamePk: number; officialDate: string; status: { abstractGameState: string } }[] }[] }>(
      `${API}/schedule?sportId=1&teamId=${teamId}&startDate=${addDays(officialDate, -2).toISOString().slice(0, 10)}&endDate=${addDays(officialDate, -1).toISOString().slice(0, 10)}&gameType=R,D,L,W,F`,
      1800
    )
    const games = (sched?.dates ?? []).flatMap((d) => d.games).filter((g) => g.status.abstractGameState === 'Final' && g.officialDate < officialDate)
    const [split] = await Promise.all([get<StatsResp>(`${API}/teams/${teamId}/stats?stats=statSplits&group=pitching&sitCodes=rp&season=${year}`)])
    const rp = splitsOf(split).find((x) => x.split?.code === 'rp')?.stat
    const rpIp = ip(rp?.inningsPitched)
    const era = rp && rpIp >= 20 ? ((rp.earnedRuns ?? 0) * 9) / rpIp : null
    const boxes = await mapWithConcurrency(games, 3, async (g) => ({ g, box: (await get<Boxscore>(`${API}/game/${g.gamePk}/boxscore`, 86400)) ?? (await get<Boxscore>(`${API}/game/${g.gamePk}/boxscore`, 0)) }))
    // A missing boxscore would understate the workload, so the whole read is skipped (and not cached) rather than half-reported.
    if (boxes.some((b) => !b.box)) return null
    let lastTwo = 0
    const yesterday = new Set<string>()
    const usedRaw: { id: number; name: string; ip: number; pitches: number; daysBefore: number }[] = []
    for (const { g, box } of boxes) {
      const side = box?.teams?.away?.team?.id === teamId ? 'away' : 'home'
      const t = box?.teams?.[side]
      if (!t?.pitchers) continue
      const daysBefore = Math.round((Date.parse(officialDate) - Date.parse(g.officialDate)) / 86400000)
      t.pitchers.slice(1).forEach((pid) => {
        const pl = t.players?.[`ID${pid}`]
        lastTwo += ip(pl?.stats?.pitching?.inningsPitched)
        if (daysBefore === 1 && pl?.person?.fullName) yesterday.add(pl.person.fullName)
        if (pl?.person?.id && pl.person.fullName) usedRaw.push({ id: pl.person.id, name: pl.person.fullName, ip: ip(pl.stats?.pitching?.inningsPitched), pitches: pl.stats?.pitching?.numberOfPitches ?? 0, daysBefore })
      })
    }
    // Role from this season's saves and holds: closers and setup men are the high-leverage arms; long men and mop-up arms are not.
    const used = await mapWithConcurrency(usedRaw, 4, async (u): Promise<UsedArm> => {
      const st = await cached(`edges:mlbarm:${u.id}:${year}`, 6 * 3600, async () => {
        const r = await get<StatsResp>(`${API}/people/${u.id}/stats?stats=season&group=pitching&season=${year}`)
        const x = splitsOf(r)[0]?.stat as (RawStat & { saves?: number; holds?: number; gamesPitched?: number }) | undefined
        return x ? { saves: x.saves ?? 0, holds: x.holds ?? 0, games: x.gamesPitched ?? 0, ip: ip(x.inningsPitched) } : null
      })
      const saves = st?.saves ?? 0
      const holds = st?.holds ?? 0
      const perApp = st && st.games > 0 ? st.ip / st.games : 1
      const role: UsedArm['role'] = saves >= 8 ? 'closer' : holds >= 8 || saves >= 3 ? 'setup' : u.ip >= 2 || perApp >= 1.6 ? 'long' : 'middle'
      return { name: u.name, ip: u.ip, pitches: u.pitches, daysBefore: u.daysBefore, role, saves, holds }
    })
    return { team: label, lastTwoDaysInnings: lastTwo, games: boxes.length, usedYesterday: Array.from(yesterday), used, era, ip: rpIp } satisfies BullpenFacts
  })
}

export async function loadBullpens(info: MlbGameInfo, away: string, home: string): Promise<{ away: BullpenFacts | null; home: BullpenFacts | null }> {
  const year = Number(info.officialDate.slice(0, 4)) || new Date().getUTCFullYear()
  const [a, h] = await Promise.all([loadTeamBullpen(info.teamIds.away, away, info.officialDate, year), loadTeamBullpen(info.teamIds.home, home, info.officialDate, year)])
  return { away: a, home: h }
}

const PITCHER_POSITIONS = new Set(['SP', 'RP', 'P', 'CL'])

/** For each hitter who is out or doubtful, his wRC+ this season; only those above 110 (with 100+ plate appearances) matter. */
async function loadKeyBatsOut(injuries: { team: string; player: string; position: string; designation: string }[], team: string, year: number): Promise<KeyBatOut[]> {
  const out = injuries.filter((i) => i.team === team && ['out', 'doubtful', 'ir'].includes(i.designation) && !PITCHER_POSITIONS.has(i.position.toUpperCase())).slice(0, 6)
  const rows = await mapWithConcurrency(out, 3, async (i): Promise<KeyBatOut | null> => {
    const found = await findMlbPlayerIdBySlug(slugify(i.player)).catch(() => null)
    if (!found) return null
    const r = await cached(`edges:mlbwrc:${found.id}:${year}`, 6 * 3600, async () => {
      const [sab, hit] = await Promise.all([get<{ stats?: { splits?: { stat: { wRcPlus?: number } }[] }[] }>(`${API}/people/${found.id}/stats?stats=sabermetrics&group=hitting&season=${year}`), get<StatsResp>(`${API}/people/${found.id}/stats?stats=season&group=hitting&season=${year}`)])
      const w = sab?.stats?.[0]?.splits?.[0]?.stat?.wRcPlus
      const pa = splitsOf(hit)[0]?.stat.plateAppearances ?? 0
      return w !== undefined ? { wrc: w, pa } : null
    })
    return r && r.wrc > 110 && r.pa >= 100 ? { name: found.fullName, position: i.position, wrcPlus: Math.round(r.wrc), pa: r.pa, designation: i.designation } : null
  })
  return rows.filter((x): x is KeyBatOut => x !== null)
}

export async function loadMlbGameFacts(info: MlbGameInfo | null, away: string, home: string, injuries: { team: string; player: string; position: string; designation: string }[] = []): Promise<MlbGameFacts | null> {
  if (!info) return null
  const year = Number(info.officialDate.slice(0, 4)) || new Date().getUTCFullYear()
  const { probables, teamIds, lineupPlayers } = info
  const [sAway, sHome] = await Promise.all([
    probables.away ? loadStarterFacts(probables.away.id, probables.away.name, teamIds.home, info.officialDate, year) : Promise.resolve(null),
    probables.home ? loadStarterFacts(probables.home.id, probables.home.name, teamIds.away, info.officialDate, year) : Promise.resolve(null),
  ])
  const [kbAway, kbHome] = await Promise.all([loadKeyBatsOut(injuries, away, year), loadKeyBatsOut(injuries, home, year)])
  const [lAway, lHome, pens, awayD7, awayD15, homeD7, homeD15, tAway, tHome] = await Promise.all([
    sHome ? loadLineupFacts(away, lineupPlayers.away, { id: sHome.id, name: sHome.name, hand: sHome.hand }, year) : Promise.resolve(null),
    sAway ? loadLineupFacts(home, lineupPlayers.home, { id: sAway.id, name: sAway.name, hand: sAway.hand }, year) : Promise.resolve(null),
    loadBullpens(info, away, home),
    loadTeamRecent(teamIds.away, info.officialDate, 7, year),
    loadTeamRecent(teamIds.away, info.officialDate, 15, year),
    loadTeamRecent(teamIds.home, info.officialDate, 7, year),
    loadTeamRecent(teamIds.home, info.officialDate, 15, year),
    loadTeamHandSplits(teamIds.away, year),
    loadTeamHandSplits(teamIds.home, year),
  ])
  const s = info.series
  const series: SeriesFacts | null = s
    ? { description: s.description, short: s.short, result: s.result, gameNumber: s.gameNumber, totalGames: s.totalGames, leader: s.leaderId === null ? null : s.leaderId === teamIds.away ? away : home, leaderWins: s.wins, trailWins: s.losses, isOver: s.isOver }
    : null
  return { keyBatsOut: { away: kbAway, home: kbHome }, teamVsHand: { away: tAway, home: tHome }, series, starters: { away: sAway, home: sHome }, lineups: { away: lAway, home: lHome }, bullpen: pens, recent: { away: { d7: awayD7, d15: awayD15 }, home: { d7: homeD7, d15: homeD15 } } }
}

export { loadMlbGameInfo }
