import { getTeamList } from '@/lib/espn/api'
import { fromEspnAbbr } from '@/lib/espn/teams'
import { normalizeNflAbbr } from '@/lib/nfl/divisions'
import { getNFLWeeklyPlayerStatsExact } from '@/lib/nfl/api'
import { fetchCsv } from '@/lib/nfl/fetchCsv'
import { cached } from '@/lib/net/ttlCache'
import { slugify } from '@/lib/players/slug'

/**
 * NFL data connections. Weekly player stats and snap counts come from nflverse (targets, target share, carries and the
 * opponent each week); the position-specific defensive numbers ("yards allowed to wide receivers") are built from those
 * same weekly rows by opponent; depth charts and their injury flags come from ESPN. Everything is real data or absent.
 */

const RELEASES = 'https://github.com/nflverse/nflverse-data/releases/download'
const num = (v: string | undefined) => {
  const n = Number(v)
  return v !== undefined && v !== '' && Number.isFinite(n) ? n : 0
}

export interface NflPlayerWeek {
  week: number
  opp: string
  targets: number
  rec: number
  recYds: number
  carries: number
  rushYds: number
  att: number
  comp: number
  passYds: number
  targetShare: number | null
  airYardsShare: number | null
  /** Yards after the catch and receiving air yards for the game. */
  yac: number
  airYards: number
  snapPct: number | null
}

export interface NflPlayerFacts {
  name: string
  team: string
  position: string
  /** Newest first. */
  games: NflPlayerWeek[]
}

interface PosAllowed {
  games: number
  recYdsPg: number
  recPg: number
  targetsPg: number
  rushYdsPg: number
  carriesPg: number
  passYdsPg: number
  compPct: number
  attPg: number
}

export type PosKey = 'WR' | 'TE' | 'RB' | 'QB'

export interface VsPosition {
  allowed: Record<PosKey, PosAllowed>
  /** Rank among all teams, 1 = allows the most. */
  rank: Record<PosKey, { recYds: number; rec: number; rushYds: number; ypc: number; passYds: number; compPct: number }>
  of: number
}

export interface OutStarter {
  name: string
  pos: string
  status: string
  /** How much his absence matters to the team, from the position (a quarterback counts far more than a safety). */
  weight: number
}

export interface DepthFacts {
  /** Starters (first on the depth chart at their spot) who are out, doubtful or on injured reserve. */
  outStarters: OutStarter[]
  cbs: { name: string; slot: 'CB1' | 'CB2' | 'CB3'; status: string | null }[]
  /** Offensive slots by player-name slug, e.g. wr1 -> "WR1". */
  slots: Record<string, string>
}

/** One game against a defense: what its opponent's skill players did (the quality of that opponent is joined later). */
export interface DefGame {
  week: number
  /** The offense that played this defense. */
  opp: string
  wr1Name: string
  wr1Yds: number
  wr1Rec: number
  wr1Targets: number
  teYds: number
  rbRush: number
  qbPass: number
}

/** A team's offense in one week: how it split passing and running, and what it gained either way. */
export interface TeamWeek {
  week: number
  opp: string
  att: number
  carries: number
  passYds: number
  rushYds: number
}

export interface NflGameFacts {
  season: number
  weeks: number
  players: Record<string, NflPlayerFacts>
  vsPosition: Record<string, VsPosition>
  depth: Record<string, DepthFacts | null>
  /** Every defense's games (for "against winning teams" splits) and its average WR1 yards allowed, ranked (1 = most). */
  defGames: Record<string, DefGame[]>
  wr1Allowed: Record<string, { yds: number; rank: number; of: number; games: number }>
  /** Pass share of plays by team over the season, ranked (1 = most pass-heavy), and each team's weeks (ascending). */
  teamStyle: Record<string, { passPct: number; plays: number; rank: number; of: number }>
  teamWeeks: Record<string, TeamWeek[]>
  /** Who started at quarterback each week (most attempts), and the team's main quarterback for the season. */
  qbStarters: Record<string, Record<number, { name: string; mainPlayed: boolean }>>
  qbMain: Record<string, string>
}

type Row = Record<string, string>

async function loadSnaps(season: number): Promise<Map<string, number>> {
  const rows = (await fetchCsv(`${RELEASES}/snap_counts/snap_counts_${season}.csv`, 21600, `nfl-snaps-${season}`).catch(() => null)) ?? []
  const out = new Map<string, number>()
  for (const r of rows) out.set(`${slugify(r.player)}|${normalizeNflAbbr(r.team)}|${r.week}`, num(r.offense_pct))
  return out
}

function buildVsPosition(rows: Row[]): Record<string, VsPosition> {
  type Acc = { weeks: Set<string>; byPos: Record<PosKey, { recYds: number; rec: number; targets: number; rushYds: number; carries: number; passYds: number; comp: number; att: number }> }
  const blank = () => ({ recYds: 0, rec: 0, targets: 0, rushYds: 0, carries: 0, passYds: 0, comp: 0, att: 0 })
  const acc = new Map<string, Acc>()
  for (const r of rows) {
    const pos = (r.position === 'FB' || r.position === 'HB' ? 'RB' : r.position) as PosKey
    if (!['WR', 'TE', 'RB', 'QB'].includes(pos)) continue
    const def = normalizeNflAbbr(r.opponent_team)
    if (!def) continue
    const a = acc.get(def) ?? { weeks: new Set<string>(), byPos: { WR: blank(), TE: blank(), RB: blank(), QB: blank() } }
    a.weeks.add(r.week)
    const b = a.byPos[pos]
    b.recYds += num(r.receiving_yards)
    b.rec += num(r.receptions)
    b.targets += num(r.targets)
    b.rushYds += num(r.rushing_yards)
    b.carries += num(r.carries)
    b.passYds += num(r.passing_yards)
    b.comp += num(r.completions)
    b.att += num(r.attempts)
    acc.set(def, a)
  }
  const teams = Array.from(acc.entries()).filter(([, a]) => a.weeks.size >= 2)
  const rankOf = (value: (a: Acc) => number) => {
    const sorted = [...teams].sort((x, y) => value(y[1]) - value(x[1]))
    return new Map(sorted.map(([abbr], i) => [abbr, i + 1]))
  }
  const rk = {
    wrYds: rankOf((a) => a.byPos.WR.recYds / a.weeks.size),
    teYds: rankOf((a) => a.byPos.TE.recYds / a.weeks.size),
    rbYds: rankOf((a) => a.byPos.RB.rushYds / a.weeks.size),
    rbRec: rankOf((a) => a.byPos.RB.rec / a.weeks.size),
    ypc: rankOf((a) => (a.byPos.RB.carries > 0 ? a.byPos.RB.rushYds / a.byPos.RB.carries : 0)),
    qbYds: rankOf((a) => a.byPos.QB.passYds / a.weeks.size),
    qbComp: rankOf((a) => (a.byPos.QB.att > 0 ? a.byPos.QB.comp / a.byPos.QB.att : 0)),
    wrRec: rankOf((a) => a.byPos.WR.rec / a.weeks.size),
    teRec: rankOf((a) => a.byPos.TE.rec / a.weeks.size),
  }
  const out: Record<string, VsPosition> = {}
  for (const [abbr, a] of teams) {
    const g = a.weeks.size
    const mk = (p: PosKey): PosAllowed => {
      const b = a.byPos[p]
      return { games: g, recYdsPg: b.recYds / g, recPg: b.rec / g, targetsPg: b.targets / g, rushYdsPg: b.rushYds / g, carriesPg: b.carries / g, passYdsPg: b.passYds / g, compPct: b.att > 0 ? b.comp / b.att : 0, attPg: b.att / g }
    }
    // Ranks are keyed by the stat each position's prop depends on; WR/TE receptions share the `rec` slot by position.
    out[abbr] = {
      allowed: { WR: mk('WR'), TE: mk('TE'), RB: mk('RB'), QB: mk('QB') },
      rank: {
        WR: { recYds: rk.wrYds.get(abbr) ?? 0, rec: rk.wrRec.get(abbr) ?? 0, rushYds: 0, ypc: 0, passYds: 0, compPct: 0 },
        TE: { recYds: rk.teYds.get(abbr) ?? 0, rec: rk.teRec.get(abbr) ?? 0, rushYds: 0, ypc: 0, passYds: 0, compPct: 0 },
        RB: { recYds: 0, rec: rk.rbRec.get(abbr) ?? 0, rushYds: rk.rbYds.get(abbr) ?? 0, ypc: rk.ypc.get(abbr) ?? 0, passYds: 0, compPct: 0 },
        QB: { recYds: 0, rec: 0, rushYds: 0, ypc: 0, passYds: rk.qbYds.get(abbr) ?? 0, compPct: rk.qbComp.get(abbr) ?? 0 },
      },
      of: teams.length,
    }
  }
  return out
}

interface DepthResp {
  depthchart?: { positions?: Record<string, { athletes?: { displayName: string; injuries?: { status?: string; type?: { description?: string } }[] }[] }> }[]
}

async function loadDepth(abbr: string): Promise<DepthFacts | null> {
  return cached(`edges:nfldepth:${abbr}`, 3600, async () => {
    const list = await getTeamList('football', 'nfl').catch(() => null)
    const id = list?.find((t) => fromEspnAbbr('nfl', t.abbr) === abbr)?.id
    if (!id) return null
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${id}/depthcharts`, { next: { revalidate: 3600 } })
      if (!res.ok) return null
      const data = (await res.json()) as DepthResp
      const charts = data.depthchart ?? []
      const defense = charts.find((c) => c.positions?.lcb || c.positions?.rcb)
      const offense = charts.find((c) => c.positions?.wr1 || c.positions?.qb)
      const status = (a: { injuries?: { status?: string }[] }) => a.injuries?.[0]?.status ?? null
      const starters = (['lcb', 'rcb', 'nb'] as const).flatMap((k) => (defense?.positions?.[k]?.athletes ?? []).slice(0, 1).map((a) => ({ name: a.displayName, status: status(a) })))
      const cbs = starters.map((s, i) => ({ ...s, slot: (['CB1', 'CB2', 'CB3'] as const)[i] }))
      const slots: Record<string, string> = {}
      for (const k of ['wr1', 'wr2', 'wr3', 'te', 'rb', 'qb']) {
        const a = offense?.positions?.[k]?.athletes?.[0]
        if (a) slots[slugify(a.displayName)] = k.toUpperCase()
      }
      const POS: Record<string, { label: string; weight: number }> = {
        qb: { label: 'QB', weight: 3 },
        rb: { label: 'RB', weight: 1 },
        wr1: { label: 'WR1', weight: 1 },
        wr2: { label: 'WR2', weight: 0.6 },
        te: { label: 'TE', weight: 0.6 },
        lt: { label: 'LT', weight: 1 },
        lde: { label: 'DE', weight: 0.8 },
        rde: { label: 'DE', weight: 0.8 },
        nt: { label: 'DT', weight: 0.6 },
        lilb: { label: 'LB', weight: 0.7 },
        rilb: { label: 'LB', weight: 0.7 },
        wlb: { label: 'LB', weight: 0.7 },
        lcb: { label: 'CB', weight: 1.2 },
        rcb: { label: 'CB', weight: 1.2 },
        ss: { label: 'S', weight: 0.9 },
        fs: { label: 'S', weight: 0.9 },
      }
      const outStarters: OutStarter[] = []
      for (const chart of [offense, defense]) {
        for (const [k, info] of Object.entries(POS)) {
          const a = chart?.positions?.[k]?.athletes?.[0]
          const st = a ? status(a) : null
          if (a && st && /^(out|doubtful|injured reserve)/i.test(st)) outStarters.push({ name: a.displayName, pos: info.label, status: st.toLowerCase(), weight: info.weight })
        }
      }
      return { cbs, slots, outStarters } satisfies DepthFacts
    } catch {
      return null
    }
  })
}

/** Per-defense game list and WR1 yards allowed, from the same weekly rows. WR1 is the opposing receiver with the most targets that week. */
function buildDefenseGames(rows: Row[]): { defGames: Record<string, DefGame[]>; wr1Allowed: NflGameFacts['wr1Allowed'] } {
  type Cell = { def: string; opp: string; week: number; wr: { name: string; yds: number; rec: number; targets: number } | null; teYds: number; rbRush: number; qbPass: number }
  const cells = new Map<string, Cell>()
  for (const r of rows) {
    const def = normalizeNflAbbr(r.opponent_team)
    const opp = normalizeNflAbbr(r.team)
    if (!def || !opp) continue
    const pos = r.position === 'FB' || r.position === 'HB' ? 'RB' : r.position
    const key = `${def}|${opp}|${r.week}`
    const c = cells.get(key) ?? { def, opp, week: Number(r.week), wr: null, teYds: 0, rbRush: 0, qbPass: 0 }
    if (pos === 'WR' && (!c.wr || num(r.targets) > c.wr.targets)) c.wr = { name: r.player_display_name, yds: num(r.receiving_yards), rec: num(r.receptions), targets: num(r.targets) }
    if (pos === 'TE') c.teYds += num(r.receiving_yards)
    if (pos === 'RB') c.rbRush += num(r.rushing_yards)
    if (pos === 'QB') c.qbPass += num(r.passing_yards)
    cells.set(key, c)
  }
  const defGames: Record<string, DefGame[]> = {}
  for (const c of Array.from(cells.values())) {
    ;(defGames[c.def] ??= []).push({ week: c.week, opp: c.opp, wr1Name: c.wr?.name ?? '', wr1Yds: c.wr?.yds ?? 0, wr1Rec: c.wr?.rec ?? 0, wr1Targets: c.wr?.targets ?? 0, teYds: c.teYds, rbRush: c.rbRush, qbPass: c.qbPass })
  }
  const avg = Object.entries(defGames).filter(([, g]) => g.length >= 2).map(([def, g]) => ({ def, yds: g.reduce((n, x) => n + x.wr1Yds, 0) / g.length, games: g.length }))
  avg.sort((a, b) => b.yds - a.yds)
  const wr1Allowed: NflGameFacts['wr1Allowed'] = {}
  avg.forEach((a, i) => (wr1Allowed[a.def] = { yds: a.yds, rank: i + 1, of: avg.length, games: a.games }))
  return { defGames, wr1Allowed }
}

/** Team pass share by week and season, and who started at quarterback each week. */
function buildTeamFacts(rows: Row[]): Pick<NflGameFacts, 'teamStyle' | 'teamWeeks' | 'qbStarters' | 'qbMain'> {
  const weeks = new Map<string, Map<number, TeamWeek>>()
  const qbAtt = new Map<string, Map<string, number>>()
  const qbWeek = new Map<string, Map<number, { name: string; att: number }[]>>()
  for (const r of rows) {
    const team = normalizeNflAbbr(r.team)
    const week = Number(r.week)
    if (!team) continue
    const tw = weeks.get(team) ?? new Map<number, TeamWeek>()
    const cur = tw.get(week) ?? { week, opp: normalizeNflAbbr(r.opponent_team), att: 0, carries: 0, passYds: 0, rushYds: 0 }
    cur.att += num(r.attempts)
    cur.carries += num(r.carries)
    cur.passYds += num(r.passing_yards)
    cur.rushYds += num(r.rushing_yards)
    tw.set(week, cur)
    weeks.set(team, tw)
    if (r.position === 'QB' && num(r.attempts) > 0) {
      const a = qbAtt.get(team) ?? new Map<string, number>()
      a.set(r.player_display_name, (a.get(r.player_display_name) ?? 0) + num(r.attempts))
      qbAtt.set(team, a)
      const w = qbWeek.get(team) ?? new Map<number, { name: string; att: number }[]>()
      w.set(week, [...(w.get(week) ?? []), { name: r.player_display_name, att: num(r.attempts) }])
      qbWeek.set(team, w)
    }
  }
  const teamWeeks: Record<string, TeamWeek[]> = {}
  const style: { team: string; passPct: number; plays: number }[] = []
  weeks.forEach((tw, team) => {
    const list = Array.from(tw.values()).sort((a, b) => a.week - b.week)
    teamWeeks[team] = list
    const att = list.reduce((n, x) => n + x.att, 0)
    const car = list.reduce((n, x) => n + x.carries, 0)
    if (att + car > 0) style.push({ team, passPct: att / (att + car), plays: att + car })
  })
  style.sort((a, b) => b.passPct - a.passPct)
  const teamStyle: NflGameFacts['teamStyle'] = {}
  style.forEach((x, i) => (teamStyle[x.team] = { passPct: x.passPct, plays: x.plays, rank: i + 1, of: style.length }))
  const qbMain: Record<string, string> = {}
  qbAtt.forEach((a, team) => {
    qbMain[team] = Array.from(a.entries()).sort((x, y) => y[1] - x[1])[0][0]
  })
  const qbStarters: NflGameFacts['qbStarters'] = {}
  qbWeek.forEach((w, team) => {
    qbStarters[team] = {}
    w.forEach((list, week) => {
      const top = [...list].sort((x, y) => y.att - x.att)[0]
      qbStarters[team][week] = { name: top.name, mainPlayed: top.name === qbMain[team] }
    })
  })
  return { teamStyle, teamWeeks, qbStarters, qbMain }
}

export async function loadNflGameFacts(away: string, home: string, season: number): Promise<NflGameFacts | null> {
  const [rows, snaps, dAway, dHome] = await Promise.all([getNFLWeeklyPlayerStatsExact(season), loadSnaps(season), loadDepth(away), loadDepth(home)])
  if (!rows || rows.length === 0) return null
  const teamRows = new Map<string, Row[]>()
  for (const r of rows) {
    const t = normalizeNflAbbr(r.team)
    if (t === away || t === home) teamRows.set(t, [...(teamRows.get(t) ?? []), r])
  }
  // Team totals per week, for shares the file does not give directly.
  const players: Record<string, NflPlayerFacts> = {}
  for (const [team, list] of Array.from(teamRows.entries())) {
    const byKey = new Map<string, Row[]>()
    for (const r of list) byKey.set(slugify(r.player_display_name), [...(byKey.get(slugify(r.player_display_name)) ?? []), r])
    for (const [slug, rs] of Array.from(byKey.entries())) {
      const games = rs
        .sort((a, b) => Number(b.week) - Number(a.week))
        .map((r): NflPlayerWeek => ({
          week: Number(r.week),
          opp: normalizeNflAbbr(r.opponent_team),
          targets: num(r.targets),
          rec: num(r.receptions),
          recYds: num(r.receiving_yards),
          carries: num(r.carries),
          rushYds: num(r.rushing_yards),
          att: num(r.attempts),
          comp: num(r.completions),
          passYds: num(r.passing_yards),
          targetShare: r.target_share !== undefined && r.target_share !== '' ? num(r.target_share) : null,
          airYardsShare: r.air_yards_share !== undefined && r.air_yards_share !== '' ? num(r.air_yards_share) : null,
          yac: num(r.receiving_yards_after_catch),
          airYards: num(r.receiving_air_yards),
          snapPct: snaps.get(`${slug}|${team}|${r.week}`) ?? null,
        }))
      players[`${slug}|${team}`] = { name: rs[0].player_display_name, team, position: rs[0].position, games }
    }
  }
  return { season, weeks: new Set(rows.map((r) => r.week)).size, players, vsPosition: buildVsPosition(rows), depth: { [away]: dAway, [home]: dHome }, ...buildDefenseGames(rows), ...buildTeamFacts(rows) }
}
