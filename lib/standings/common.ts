import type { StandingsRow } from './types'

const MULTI_WORD_NICKNAMES = ['Red Sox', 'White Sox', 'Blue Jays', 'Trail Blazers', 'Maple Leafs', 'Golden Knights', 'Blue Jackets', 'Red Wings']

/** "Boston Red Sox" → "Boston"; single-word names (e.g. "Athletics") are returned as-is. */
export function cityFromName(name: string): string {
  for (const nick of MULTI_WORD_NICKNAMES) {
    if (name.endsWith(nick)) return name.slice(0, -nick.length).trim()
  }
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? parts.slice(0, -1).join(' ') : name
}

/** Normalises provider streak formats ("W3", "W 3", "OT1", "L 2") to "W3" / "L2" / "OTL1". */
export function normalizeStreak(raw: string | undefined | null): string {
  if (!raw) return ''
  const m = /^\s*(OTL|OT|W|L|T)\s*(\d+)\s*$/i.exec(raw)
  if (!m) return ''
  const code = m[1].toUpperCase()
  return `${code === 'OT' ? 'OTL' : code}${m[2]}`
}

export function formatPct(pct: number): string {
  return pct.toFixed(3).replace(/^0/, '')
}

interface FinalizeOptions {
  /** NHL: rank by points (then ROW) instead of win percentage. */
  byPoints?: boolean
  /** Tiebreak value for points sports (ROW). */
  tiebreak?: (r: StandingsRow) => number
}

export function sortKey(r: StandingsRow, byPoints?: boolean, tiebreak?: (r: StandingsRow) => number): number[] {
  return byPoints ? [r.pts ?? 0, tiebreak?.(r) ?? 0, r.pctNum] : [r.pctNum, r.w]
}

function compareKeys(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return b[i] - a[i]
  }
  return 0
}

export function compareRows(a: StandingsRow, b: StandingsRow, opts: FinalizeOptions = {}): number {
  return compareKeys(sortKey(a, opts.byPoints, opts.tiebreak), sortKey(b, opts.byPoints, opts.tiebreak))
}

function gamesBack(leader: StandingsRow, r: StandingsRow): string {
  const gb = (leader.w - r.w + (r.l - leader.l)) / 2
  if (gb <= 0) return '—'
  return gb.toFixed(1).replace(/\.0$/, '')
}

/** Sorts each division, assigns divisional rank, and fills games-behind (win-based sports). */
export function finalizeRows(rows: StandingsRow[], opts: FinalizeOptions = {}): StandingsRow[] {
  const byDivision = new Map<string, StandingsRow[]>()
  for (const r of rows) {
    const list = byDivision.get(r.division) ?? []
    list.push(r)
    byDivision.set(r.division, list)
  }
  const out: StandingsRow[] = []
  for (const list of Array.from(byDivision.values())) {
    list.sort((a, b) => compareRows(a, b, opts))
    list.forEach((r, i) => {
      r.divRank = i + 1
      r.gb = opts.byPoints ? '' : gamesBack(list[0], r)
      out.push(r)
    })
  }
  return out
}
