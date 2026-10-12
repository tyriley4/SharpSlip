import fs from 'node:fs'
import path from 'node:path'
import { getGameSummary, getTeamSchedule, type GameSummary } from '@/lib/espn/api'
import { cached } from '@/lib/net/ttlCache'

/**
 * College basketball box scores, one per team per finished game, built from ESPN game summaries and kept on
 * disk (last season's games never change, and this season's only grow). Everything the CBB breakdown,
 * team pages and player pages show is computed from these — real figures only.
 */

export const CBB_LEAGUE = 'mens-college-basketball' as const

export interface BbPlayerLine {
  id: string
  name: string
  min: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  to: number
  fgm: number
  fga: number
  tpm: number
  tpa: number
  ftm: number
  fta: number
  starter: boolean
}

export interface BbTeamTotals {
  fgm: number
  fga: number
  tpm: number
  tpa: number
  ftm: number
  fta: number
  reb: number
  oreb: number
  ast: number
  to: number
  stl: number
  blk: number
  pf: number
  paint: number
  fastBreak: number
  pointsOffTO: number
}

export interface BbGameBox {
  eventId: string
  date: string
  home: boolean
  neutral: boolean
  conferenceGame: boolean
  oppId: string
  oppAbbr: string
  oppName: string
  oppRank: number | null
  ourRank: number | null
  us: number
  them: number
  result: 'W' | 'L'
  team: BbTeamTotals
  opp: BbTeamTotals
  players: BbPlayerLine[]
  oppPlayers: BbPlayerLine[]
  /** DraftKings closing line recorded by ESPN, when there was one. */
  line: { homeSpread: number | null; total: number | null } | null
  postseason: boolean
}

const num = (v: string | undefined): number => {
  const x = Number(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(x) ? x : 0
}
const made = (v: string | undefined): [number, number] => {
  const [a, b] = String(v ?? '0-0').split('-')
  return [num(a), num(b)]
}

function totals(stats: Record<string, string> | undefined): BbTeamTotals {
  const s = stats ?? {}
  const [fgm, fga] = made(s['fieldGoalsMade-fieldGoalsAttempted'])
  const [tpm, tpa] = made(s['threePointFieldGoalsMade-threePointFieldGoalsAttempted'])
  const [ftm, fta] = made(s['freeThrowsMade-freeThrowsAttempted'])
  return {
    fgm, fga, tpm, tpa, ftm, fta,
    reb: num(s.totalRebounds),
    oreb: num(s.offensiveRebounds),
    ast: num(s.assists),
    to: num(s.totalTurnovers ?? s.turnovers),
    stl: num(s.steals),
    blk: num(s.blocks),
    pf: num(s.fouls),
    paint: num(s.pointsInPaint),
    fastBreak: num(s.fastBreakPoints),
    pointsOffTO: num(s.turnoverPoints),
  }
}

function players(groups: GameSummary['players'][string] | undefined): BbPlayerLine[] {
  const out: BbPlayerLine[] = []
  for (const g of groups ?? []) {
    const L = g.labels
    const at = (label: string) => L.indexOf(label)
    for (const a of g.athletes) {
      const st = a.stats
      if (st.length === 0 || st[at('MIN')] === undefined) continue
      const [fgm, fga] = made(st[at('FG')])
      const [tpm, tpa] = made(st[at('3PT')])
      const [ftm, fta] = made(st[at('FT')])
      out.push({
        id: a.id,
        name: a.name,
        min: num(st[at('MIN')]),
        pts: num(st[at('PTS')]),
        reb: num(st[at('REB')]),
        ast: num(st[at('AST')]),
        stl: num(st[at('STL')]),
        blk: num(st[at('BLK')]),
        to: num(st[at('TO')]),
        fgm, fga, tpm, tpa, ftm, fta,
        starter: a.starter,
      })
    }
  }
  return out
}

export function toBbBox(s: GameSummary, teamId: string): BbGameBox | null {
  const us = s.teams.find((t) => t.id === teamId)
  const them = s.teams.find((t) => t.id !== teamId)
  if (!us || !them || us.score === null || them.score === null || s.state !== 'post') return null
  const mine = players(s.players[us.id])
  if (mine.length === 0) return null
  return {
    eventId: s.gameId,
    date: s.date ?? '',
    home: us.homeAway === 'home',
    neutral: s.neutralSite,
    conferenceGame: s.conferenceGame,
    oppId: them.id,
    oppAbbr: them.abbr,
    oppName: them.name,
    oppRank: them.rank,
    ourRank: us.rank,
    us: us.score,
    them: them.score,
    result: us.score > them.score ? 'W' : 'L',
    team: totals(s.teamStats[us.id]),
    opp: totals(s.teamStats[them.id]),
    players: mine,
    oppPlayers: players(s.players[them.id]),
    line: s.odds ? { homeSpread: s.odds.homeSpread, total: s.odds.total } : null,
    postseason: false,
  }
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const DIR = path.join(process.cwd(), '.data')
const FILE = path.join(DIR, 'box-mens-college-basketball.json')
const g = globalThis as unknown as { __sharpslipCbbBoxes?: Record<string, BbGameBox>; __sharpslipCbbTimer?: ReturnType<typeof setTimeout> }

function store(): Record<string, BbGameBox> {
  if (!g.__sharpslipCbbBoxes) {
    try {
      g.__sharpslipCbbBoxes = JSON.parse(fs.readFileSync(FILE, 'utf8')) as Record<string, BbGameBox>
    } catch {
      g.__sharpslipCbbBoxes = {}
    }
  }
  return g.__sharpslipCbbBoxes
}

function flushSoon() {
  if (g.__sharpslipCbbTimer) return
  g.__sharpslipCbbTimer = setTimeout(() => {
    g.__sharpslipCbbTimer = undefined
    try {
      fs.mkdirSync(DIR, { recursive: true })
      fs.writeFileSync(FILE, JSON.stringify(store()))
    } catch (err) {
      console.error('[cbb box] persist failed', (err as Error).message)
    }
  }, 2000)
}

async function pool<T>(items: T[], size: number, fn: (t: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn))
}

/**
 * A team's finished regular-season games for `season` (ESPN's season year: 2026 = 2025-26), oldest first.
 * Missing box scores are fetched six at a time and kept.
 */
export async function getCbbTeamBoxes(teamId: string, season?: number): Promise<BbGameBox[]> {
  const schedule = await getTeamSchedule('basketball', CBB_LEAGUE, teamId, season)
  if (!schedule) return []
  const finals = schedule.filter((x) => x.state === 'post' && (x.seasonType === null || x.seasonType === 2))
  const s = store()
  const missing = finals.filter((x) => !s[`${x.id}:${teamId}`])
  if (missing.length > 0) {
    console.log(`[cbb box] team ${teamId}: fetching ${missing.length} box score(s)`)
    await pool(missing, 6, async (x) => {
      const summary = await getGameSummary('basketball', CBB_LEAGUE, x.id)
      const box = summary ? toBbBox(summary, teamId) : null
      if (box) {
        s[`${x.id}:${teamId}`] = { ...box, date: x.date, neutral: x.neutralSite, conferenceGame: x.conferenceGame || box.conferenceGame, oppRank: box.oppRank ?? x.opponent.rank }
        flushSoon()
      }
    })
  }
  return finals.map((x) => s[`${x.id}:${teamId}`]).filter((b): b is BbGameBox => !!b)
}

export function cbbTeamBoxes(teamId: string, season?: number): Promise<BbGameBox[]> {
  return cached(`cbb:box:${teamId}:${season ?? 'cur'}`, 900, () => getCbbTeamBoxes(teamId, season)).then((v) => v ?? [])
}
