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

export interface NflGameFacts {
  season: number
  weeks: number
  players: Record<string, NflPlayerFacts>
  vsPosition: Record<string, VsPosition>
  depth: Record<string, DepthFacts | null>
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
  return { season, weeks: new Set(rows.map((r) => r.week)).size, players, vsPosition: buildVsPosition(rows), depth: { [away]: dAway, [home]: dHome } }
}
