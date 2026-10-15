import { getTeamList } from '@/lib/espn/api'
import { fromEspnAbbr } from '@/lib/espn/teams'
import { normalizeNflAbbr } from '@/lib/nfl/divisions'
import { getNFLWeeklyPlayerStatsExact } from '@/lib/nfl/api'
import { fetchCsv } from '@/lib/nfl/fetchCsv'
import { cached } from '@/lib/net/ttlCache'
import { getTeamLinedGames } from '@/lib/odds/history'
import { slugify } from '@/lib/players/slug'
import { q } from '../evidenceFramework'
import type { ModuleInput } from '../modules/shared'
import { scriptOf } from '../modules/shared'
import type { Edge, GameContext, ModuleOutput } from '../types'

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
const f1 = (n: number) => n.toFixed(1)
const pctText = (r: number) => `${Math.round(r * 100)}%`
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
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
  overs: { away: { over: number; of: number } | null; home: { over: number; of: number } | null }
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

async function overRecord(abbr: string, season: number): Promise<{ over: number; of: number } | null> {
  const lined = await getTeamLinedGames('nfl', abbr, season, 8).catch(() => null)
  const last = (lined ?? []).filter((g) => g.line?.total != null).slice(-8)
  if (last.length < 3) return null
  return { over: last.filter((g) => g.awayScore + g.homeScore > (g.line!.total as number)).length, of: last.length }
}

export async function loadNflGameFacts(away: string, home: string, season: number): Promise<NflGameFacts | null> {
  const [rows, snaps, dAway, dHome, oAway, oHome] = await Promise.all([getNFLWeeklyPlayerStatsExact(season), loadSnaps(season), loadDepth(away), loadDepth(home), overRecord(away, season), overRecord(home, season)])
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
  return { season, weeks: new Set(rows.map((r) => r.week)).size, players, vsPosition: buildVsPosition(rows), depth: { [away]: dAway, [home]: dHome }, overs: { away: oAway, home: oHome } }
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

function playerOf(game: GameContext, o: ModuleInput['outcome']): NflPlayerFacts | null {
  const facts = game.facts.nfl
  if (!facts || !o.player) return null
  return facts.players[`${slugify(o.player.name)}|${o.player.team}`] ?? null
}

/** WR, TE and RB receiving props: target share, snaps, the position-specific defense and the cornerback situation. */
export function getReceiverEvidence({ outcome: o, game }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  if (o.type !== 'player_prop' || (o.category !== 'Receiving Yards' && o.category !== 'Receptions') || !o.player || !o.opponent) return { edges, conflicts }
  const facts = game.facts.nfl
  const p = playerOf(game, o)
  if (!facts || !p) return { edges, conflicts }
  const over = o.direction !== 'under'
  const pos = (p.position === 'FB' || p.position === 'HB' ? 'RB' : p.position) as PosKey
  const rec = p.games.slice(0, 4)

  // 1. Target share over the last four games (targets as a share of the team's targets), against the season.
  const shares = rec.map((g) => g.targetShare).filter((v): v is number => v !== null)
  const seasonShares = p.games.map((g) => g.targetShare).filter((v): v is number => v !== null)
  if (shares.length >= 4) {
    const s4 = mean(shares)
    const season = mean(seasonShares)
    const floor = pos === 'WR' ? 0.2 : 0.15
    const tg = mean(rec.map((g) => g.targets))
    if (over && s4 >= floor) {
      edges.push({
        description: `Commands a ${pctText(s4)} target share over the last ${shares.length} games (${f1(tg)} targets per game; ${pctText(season)} across the season)${s4 - season >= 0.03 ? ' — the share is climbing' : ''}`,
        category: 'role',
        horizon: 'last7',
        layer: 'opportunity',
        relevanceScore: Math.min(1, 0.5 + (s4 - floor) * 3 + (s4 - season >= 0.03 ? 0.1 : 0)),
        supportingData: `Targets by game: ${rec.map((g) => g.targets).join(', ')} (most recent first)`,
        weight: 0.2,
        ageDays: 7,
        quality: q(3, 3, 3, 1),
        sample: shares.length,
        metrics: { rate: s4, avg: tg, n: shares.length },
      })
    } else if (over && s4 <= floor - 0.07) conflicts++
    else if (!over && s4 <= floor - 0.06) edges.push({ description: `Target share has slipped to ${pctText(s4)} over the last ${shares.length} games (${pctText(season)} for the season)`, category: 'role', horizon: 'last7', layer: 'opportunity', relevanceScore: 0.6, supportingData: 'Fewer looks lowers the ceiling', weight: 0.14, ageDays: 7, quality: q(3, 3, 3, 1), sample: shares.length })
  }

  // 1b. Deep-target role: air-yards share and how the yardage is made (air yards per target, yards after catch per catch).
  const ays = rec.map((g) => g.airYardsShare).filter((v): v is number => v !== null)
  if (ays.length >= 4 && o.category === 'Receiving Yards') {
    const a4 = mean(ays)
    const tg = rec.reduce((n, g) => n + g.targets, 0)
    const air = rec.reduce((n, g) => n + g.airYards, 0)
    const yac = rec.reduce((n, g) => n + g.yac, 0)
    const catches = rec.reduce((n, g) => n + g.rec, 0)
    if (over && a4 >= 0.28) edges.push({ description: `Holds a ${pctText(a4)} share of his team's air yards over the last ${ays.length} games${tg > 0 ? ` (${f1(air / tg)} air yards per target${catches > 0 ? `, ${f1(yac / catches)} yards after the catch per reception` : ''})` : ''} — a downfield role that drives receiving yards`, category: 'role', horizon: 'last7', layer: 'opportunity', relevanceScore: Math.min(1, 0.5 + (a4 - 0.28) * 2), supportingData: 'nflverse weekly receiving data', weight: 0.12, ageDays: 7, quality: q(3, 3, 3, 1), sample: ays.length, metrics: { rate: a4, n: ays.length } })
    else if (over && a4 <= 0.12) conflicts++
  }

  // 2. Snap share over the last three games.
  const snaps = p.games.slice(0, 3).map((g) => g.snapPct).filter((v): v is number => v !== null)
  if (snaps.length >= 3) {
    const s = mean(snaps)
    if (over && s >= 0.75) edges.push({ description: `Played ${pctText(s)} of offensive snaps over the last ${snaps.length} games — an every-down role`, category: 'role', horizon: 'last7', layer: 'opportunity', relevanceScore: Math.min(1, 0.5 + (s - 0.75) * 2), supportingData: `Snap share by game: ${p.games.slice(0, 3).map((g) => (g.snapPct === null ? '—' : pctText(g.snapPct))).join(', ')}`, weight: 0.12, ageDays: 7, quality: q(3, 3, 3, 1), sample: snaps.length, metrics: { rate: s, n: snaps.length } })
    else if (over && s <= 0.5) conflicts++
  }

  // 3. The position-specific defense: yards and catches allowed to this position, not the whole secondary.
  const v = facts.vsPosition[o.opponent]
  if (v && (pos === 'WR' || pos === 'TE' || pos === 'RB')) {
    const al = v.allowed[pos]
    const rk = v.rank[pos]
    const yards = o.category === 'Receiving Yards'
    const rank = yards ? (pos === 'RB' ? 0 : rk.recYds) : rk.rec
    const value = yards ? al.recYdsPg : al.recPg
    if (rank > 0 && value > 0) {
      const soft = rank <= 10
      const tough = rank > v.of - 10
      const label = pos === 'RB' ? 'running backs' : pos === 'TE' ? 'tight ends' : 'wide receivers'
      if ((over && soft) || (!over && tough)) {
        edges.push({
          description: `${o.opponent} has allowed ${f1(value)} ${yards ? 'receiving yards' : 'receptions'} per game to ${label} — ${ordinal(soft ? rank : v.of - rank + 1)}-${soft ? 'most' : 'fewest'} in the NFL (${al.games} games)`,
          category: 'matchup',
          horizon: 'tonight',
          layer: 'opportunity',
          relevanceScore: Math.min(1, 0.55 + (soft ? 10 - rank : rank - (v.of - 10)) / 20),
          supportingData: `Built from every ${label.slice(0, -1)} stat line against ${o.opponent} this season`,
          weight: 0.22,
          quality: q(3, 3, 2, al.games >= 5 ? 2 : 1),
          sample: al.games,
          metrics: { avg: value, n: al.games },
        })
      } else if ((over && tough) || (!over && soft)) conflicts++
    }
  }

  // 4. The cornerback situation from the depth chart and injury designations.
  const depth = game.facts.nfl?.depth[o.opponent]
  if (depth && over && pos !== 'RB') {
    const hurt = depth.cbs.filter((c) => c.status && /out|doubtful|injured reserve/i.test(c.status))
    const limited = depth.cbs.filter((c) => c.status && /questionable|day-to-day|probable/i.test(c.status))
    const slot = facts.depth[o.player.team]?.slots[slugify(o.player.name)]
    const who = slot ? `${o.player.name} (${slot})` : o.player.name
    if (hurt.length > 0) {
      edges.push({
        description: `${o.opponent}'s starting cornerback${hurt.length > 1 ? 's' : ''} ${hurt.map((c) => `${c.name} (${c.slot}, ${/doubtful/i.test(c.status ?? '') ? 'doubtful' : 'out'})`).join(' and ')} ${hurt.length > 1 ? 'are' : 'is'} on the injury report${limited.length ? `, with ${limited.map((c) => `${c.name} (${c.slot}) listed ${c.status?.toLowerCase()}`).join(' and ')}` : ''} — a thinner outside group for ${who}`,
        category: 'situational',
        horizon: 'tonight',
        layer: 'situational',
        relevanceScore: Math.min(1, 0.6 + 0.15 * hurt.length),
        supportingData: 'ESPN depth chart and injury report',
        weight: 0.16,
        ageDays: 0,
        quality: q(3, 3, 3, 1),
      })
    } else if (limited.length > 0) {
      edges.push({ description: `${o.opponent}'s starting cornerback ${limited.map((c) => `${c.name} (${c.slot})`).join(' and ')} ${limited.length > 1 ? 'are' : 'is'} listed ${limited[0].status?.toLowerCase()} — his snaps and coverage are in question for ${who}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevanceScore: 0.5, supportingData: 'ESPN depth chart and injury report', weight: 0.08, ageDays: 0, quality: q(3, 3, 3, 1) })
    }
  }
  return { edges, conflicts }
}

/** RB rushing props: snap share, carries share, and the run defense against running backs specifically. */
export function getRBRushingEvidence({ outcome: o, game }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  if (o.type !== 'player_prop' || o.category !== 'Rush Yards' || !o.player || !o.opponent) return { edges, conflicts }
  const facts = game.facts.nfl
  const p = playerOf(game, o)
  if (!facts || !p) return { edges, conflicts }
  const over = o.direction !== 'under'

  const snaps = p.games.slice(0, 3).map((g) => g.snapPct).filter((v): v is number => v !== null)
  if (snaps.length >= 3) {
    const s = mean(snaps)
    if (over && s >= 0.6) edges.push({ description: `Playing ${pctText(s)} of offensive snaps over the last ${snaps.length} games — ${s >= 0.7 ? 'the clear lead back' : 'a primary role in the backfield'}`, category: 'role', horizon: 'last7', layer: 'opportunity', relevanceScore: Math.min(1, 0.5 + (s - 0.55) * 1.6), supportingData: `Snap share by game: ${p.games.slice(0, 3).map((g) => (g.snapPct === null ? '—' : pctText(g.snapPct))).join(', ')}`, weight: 0.2, ageDays: 7, quality: q(3, 3, 3, 1), sample: snaps.length, metrics: { rate: s, n: snaps.length } })
    else if (over && s <= 0.45) conflicts++
    else if (!over && s <= 0.45) edges.push({ description: `Playing only ${pctText(s)} of offensive snaps over the last ${snaps.length} games — a committee role`, category: 'role', horizon: 'last7', layer: 'opportunity', relevanceScore: 0.6, supportingData: 'Snap share by game', weight: 0.16, ageDays: 7, quality: q(3, 3, 3, 1), sample: snaps.length })
  }

  // Carries and the share of the team's carries over the last four games.
  const last4 = p.games.slice(0, 4)
  if (last4.length >= 3) {
    const carries = mean(last4.map((g) => g.carries))
    const share = (() => {
      let mine = 0
      let team = 0
      for (const g of last4) {
        mine += g.carries
        for (const other of Object.values(facts.players)) {
          if (other.team !== p.team) continue
          const og = other.games.find((x) => x.week === g.week)
          if (og && other.position !== 'QB') team += og.carries
        }
      }
      return team > 0 ? mine / team : null
    })()
    if (over && carries >= 12) edges.push({ description: `Averaging ${f1(carries)} carries over the last ${last4.length} games${share !== null ? ` — ${pctText(share)} of the team's designed running back workload` : ''}`, category: 'role', horizon: 'last7', layer: 'opportunity', relevanceScore: Math.min(1, 0.5 + (carries - 12) / 12), supportingData: `Carries by game: ${last4.map((g) => g.carries).join(', ')} (most recent first)`, weight: 0.14, ageDays: 7, quality: q(3, 3, 3, 1), sample: last4.length, metrics: { avg: carries, rate: share ?? undefined, n: last4.length } })
  }

  const v = facts.vsPosition[o.opponent]
  if (v) {
    const al = v.allowed.RB
    const ypc = al.carriesPg > 0 ? al.rushYdsPg / al.carriesPg : 0
    const rank = v.rank.RB.rushYds
    const soft = rank <= 10
    const tough = rank > v.of - 10
    if (rank > 0 && ((over && soft) || (!over && tough))) {
      edges.push({ description: `${o.opponent} has allowed ${f1(al.rushYdsPg)} rushing yards per game to running backs (${ypc.toFixed(1)} per carry) — ${ordinal(soft ? rank : v.of - rank + 1)}-${soft ? 'most' : 'fewest'} in the NFL`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevanceScore: Math.min(1, 0.55 + (soft ? 10 - rank : rank - (v.of - 10)) / 20), supportingData: `${al.games} games, running back stat lines only`, weight: 0.22, quality: q(3, 3, 2, al.games >= 5 ? 2 : 1), sample: al.games, metrics: { avg: al.rushYdsPg, n: al.games } })
    } else if (rank > 0 && ((over && tough) || (!over && soft))) conflicts++
  }
  return { edges, conflicts }
}

/** QB passing props: the defense against quarterbacks specifically, and recent pass volume. */
export function getQBEvidence({ outcome: o, game }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  if (o.type !== 'player_prop' || !['Pass Yards', 'Completions', 'TD Passes'].includes(o.category ?? '') || !o.player || !o.opponent) return { edges, conflicts }
  const facts = game.facts.nfl
  const p = playerOf(game, o)
  if (!facts) return { edges, conflicts }
  const over = o.direction !== 'under'
  const v = facts.vsPosition[o.opponent]
  if (v) {
    const al = v.allowed.QB
    const rank = v.rank.QB.passYds
    const soft = rank <= 10
    const tough = rank > v.of - 10
    if (rank > 0 && ((over && soft) || (!over && tough))) {
      edges.push({ description: `${o.opponent} has allowed ${f1(al.passYdsPg)} passing yards per game to quarterbacks on a ${pctText(al.compPct)} completion rate — ${ordinal(soft ? rank : v.of - rank + 1)}-${soft ? 'most' : 'fewest'} yards in the NFL (${ordinal(v.rank.QB.compPct)}-most completions allowed)`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevanceScore: Math.min(1, 0.55 + (soft ? 10 - rank : rank - (v.of - 10)) / 20), supportingData: `${al.games} games, quarterback stat lines only`, weight: 0.22, quality: q(3, 3, 2, al.games >= 5 ? 2 : 1), sample: al.games, metrics: { avg: al.passYdsPg, rate: al.compPct, n: al.games } })
    } else if (rank > 0 && ((over && tough) || (!over && soft))) conflicts++
  }
  if (p) {
    const last4 = p.games.slice(0, 4).filter((g) => g.att > 0)
    if (last4.length >= 3) {
      const att = mean(last4.map((g) => g.att))
      if (over && att >= 36) edges.push({ description: `Averaging ${f1(att)} pass attempts over the last ${last4.length} games (${f1(mean(last4.map((g) => g.passYds)))} yards per game)`, category: 'role', horizon: 'last7', layer: 'opportunity', relevanceScore: Math.min(1, 0.5 + (att - 36) / 14), supportingData: `Attempts by game: ${last4.map((g) => g.att).join(', ')} (most recent first)`, weight: 0.12, ageDays: 7, quality: q(3, 3, 3, 1), sample: last4.length, metrics: { avg: att, n: last4.length } })
    }
  }
  return { edges, conflicts }
}

/** Moneyline and spread: starters on either side who are out, from the depth charts and their injury designations. */
export function getNflTeamEvidence({ outcome: o, game }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  if ((o.type !== 'moneyline' && o.type !== 'spread') || !o.team) return { edges, conflicts }
  const facts = game.facts.nfl
  const mine = facts?.depth[o.team.abbr]
  const theirs = facts?.depth[o.team.opponent]
  if (!mine || !theirs) return { edges, conflicts }
  const sum = (xs: OutStarter[]) => xs.reduce((n, x) => n + x.weight, 0)
  const gap = sum(theirs.outStarters) - sum(mine.outStarters)
  const list = (xs: OutStarter[]) => xs.slice(0, 4).map((x) => `${x.name} (${x.pos})`).join(', ')
  if (gap >= 2 && theirs.outStarters.length > 0) {
    edges.push({
      description: `${o.team.opponent} is without ${list(theirs.outStarters)} while ${mine.outStarters.length ? `${o.team.abbr} is missing ${list(mine.outStarters)}` : `${o.team.abbr} has no starters ruled out`}`,
      category: 'situational',
      horizon: 'tonight',
      layer: 'situational',
      relevanceScore: Math.min(1, 0.5 + gap / 6),
      supportingData: 'ESPN depth charts and injury report',
      weight: 0.14,
      ageDays: 0,
      quality: q(3, 3, 3, 1),
    })
  } else if (gap <= -2) conflicts++
  return { edges, conflicts }
}

/** Game totals: both teams' recent scoring, the spread's implied game flow and the over record. */
export function getGameTotalEvidence({ outcome: o, game }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  if (o.type !== 'total' || o.threshold === undefined) return { edges, conflicts }
  const over = o.direction !== 'under'
  const rec = (abbr: string) => (game.results[abbr] ?? []).slice(0, 7)
  const a = rec(game.away)
  const h = rec(game.home)
  if (a.length >= 3 && h.length >= 3) {
    const aFor = mean(a.map((g) => g.us))
    const aAg = mean(a.map((g) => g.them))
    const hFor = mean(h.map((g) => g.us))
    const hAg = mean(h.map((g) => g.them))
    const projected = (aFor + hAg) / 2 + (hFor + aAg) / 2
    const gap = projected - o.threshold
    if ((over && gap >= 2.5) || (!over && gap <= -2.5)) {
      edges.push({ description: `Over their last ${Math.min(a.length, h.length)} games ${game.away} scores ${f1(aFor)} and allows ${f1(aAg)}, while ${game.home} scores ${f1(hFor)} and allows ${f1(hAg)} — the two profiles project to ${f1(projected)} combined points against a line of ${o.threshold}`, category: 'recent_form', horizon: 'last7', layer: 'statistical', relevanceScore: Math.min(1, 0.45 + Math.abs(gap) / 14), supportingData: 'Recent scoring for and against, both teams', weight: 0.16, ageDays: 7, quality: q(3, 3, 3, 1), sample: Math.min(a.length, h.length) })
    } else if ((over && gap <= -2.5) || (!over && gap >= 2.5)) conflicts++
  }
  const { margin } = scriptOf(game, game.home)
  if (margin !== null) {
    const spread = Math.abs(margin)
    if (!over && spread >= 10) edges.push({ description: `A ${spread.toFixed(1)}-point spread points to a one-sided game — the leader tends to run the clock, which trims the total`, category: 'role', horizon: 'tonight', layer: 'opportunity', relevanceScore: 0.55, supportingData: 'Spread-implied game flow', weight: 0.06, ageDays: 0, quality: q(2, 2, 3, 1) })
    else if (over && spread <= 3 && o.threshold >= 46) edges.push({ description: `A ${spread.toFixed(1)}-point spread signals a close game — both offenses stay aggressive for longer, which favors scoring`, category: 'role', horizon: 'tonight', layer: 'opportunity', relevanceScore: 0.5, supportingData: 'Spread-implied game flow', weight: 0.06, ageDays: 0, quality: q(2, 2, 3, 1) })
  }
  const oa = game.facts.nfl?.overs.away
  const oh = game.facts.nfl?.overs.home
  if (oa && oh) {
    const rate = (oa.over + oh.over) / (oa.of + oh.of)
    if ((over && rate >= 0.65) || (!over && rate <= 0.35)) {
      const n = over ? oa.over + oh.over : oa.of + oh.of - oa.over - oh.over
      edges.push({ description: `The ${over ? 'over' : 'under'} has hit in ${n} of the last ${oa.of + oh.of} games for these two teams combined`, category: 'recent_form', horizon: 'last15', layer: 'statistical', relevanceScore: Math.min(1, 0.4 + Math.abs(rate - 0.5) * 1.6), supportingData: "Against each game's closing total", weight: 0.1, ageDays: 7, quality: q(3, 2, 3, 1), sample: oa.of + oh.of })
    }
  }
  return { edges, conflicts }
}
