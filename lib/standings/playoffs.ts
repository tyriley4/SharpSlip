import { compareRows } from './common'
import type { SportStandings, StandingsRow } from './types'

export type Tone = 'green' | 'amber' | 'red'

/** M = magic number to clinch, E = elimination number, clinched/elim = already decided. */
export interface MagicInfo {
  kind: 'M' | 'E' | 'clinched' | 'elim'
  n: number
}

export interface TeamStatus {
  label: string
  /** null → outside the picture and not on the bubble. */
  tone: Tone | null
  /** Positive = ahead of the cutoff, negative = behind; text such as "+1.5" / "2 GB". */
  gapText: string | null
  magic: MagicInfo | null
}

export interface PictureEntry {
  row: StandingsRow
  status: TeamStatus
}

export interface ConferencePicture {
  entries: PictureEntry[]
  /** Short description of the format, shown under the heading. */
  format: string
}

const MAX_MAGIC = 10

function score(r: StandingsRow, unit: 1 | 2): number {
  return unit === 2 ? r.pts ?? 0 : r.w + r.t * 0.5
}

function maxScore(r: StandingsRow, data: SportStandings): number {
  const remaining = Math.max(0, data.totalGames - r.gp)
  return score(r, data.unit) + remaining * data.unit
}

function rowValue(r: StandingsRow): number {
  return Number(r.extras.find((e) => e.key === 'row')?.value ?? 0) || 0
}

function sorter(data: SportStandings) {
  const byPoints = data.unit === 2
  return (a: StandingsRow, b: StandingsRow) => compareRows(a, b, { byPoints, tiebreak: rowValue })
}

function fmtGap(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/** Number of playoff berths used for magic/elimination math (conference-wide, ignoring division seeding). */
function cutoff(data: SportStandings, confTeams: number): number {
  const p = data.playoff
  if (p.kind === 'seeds') return p.direct + p.playIn
  if (p.kind === 'nhl') return Math.min(confTeams, 6 + p.wildCards)
  return Math.min(confTeams, data.conferences[0].divisions.length + p.wildCards)
}

/** Simplified (tiebreaker-free) magic / elimination numbers for one team. */
function magicFor(t: StandingsRow, others: StandingsRow[], k: number, qualified: boolean, data: SportStandings): MagicInfo | null {
  if (data.totalGames - t.gp < 0) return null
  const unit = data.unit
  if (qualified) {
    // Clinched once no more than k-1 other teams can still finish above t's current total.
    const byMax = others.map((o) => maxScore(o, data)).sort((a, b) => b - a)
    const threshold = byMax[k - 1] ?? -Infinity
    const m = threshold - score(t, unit) + 1
    if (m <= 0) return { kind: 'clinched', n: 0 }
    return m <= MAX_MAGIC ? { kind: 'M', n: m } : null
  }
  const byNow = others.map((o) => score(o, unit)).sort((a, b) => b - a)
  const bar = byNow[k - 1] ?? -Infinity
  const e = maxScore(t, data) - bar + 1
  if (e <= 0) return { kind: 'elim', n: 0 }
  return e <= MAX_MAGIC ? { kind: 'E', n: e } : null
}

interface Slot {
  row: StandingsRow
  label: string
  tone: Tone | null
  qualified: boolean
}

function confGapText(ahead: number, out: boolean, data: SportStandings): string {
  const unit = data.unit === 2 ? ' pts' : ''
  if (out) return `${fmtGap(Math.abs(ahead))}${unit} GB`
  return `+${fmtGap(ahead)}${unit}`
}

/** Playoff slots for one conference, in picture order. */
function slotsForConference(data: SportStandings, confId: string): { slots: Slot[]; gapRef: Map<string, StandingsRow> } {
  const conf = data.conferences.find((c) => c.id === confId)
  const rows = data.rows.filter((r) => conf?.divisions.includes(r.division))
  const cmp = sorter(data)
  const p = data.playoff
  const slots: Slot[] = []
  const gapRef = new Map<string, StandingsRow>()

  if (p.kind === 'seeds') {
    const sorted = rows.slice().sort(cmp)
    sorted.forEach((row, i) => {
      if (i < p.direct) slots.push({ row, label: `#${i + 1}`, tone: 'green', qualified: true })
      else if (i < p.direct + p.playIn) slots.push({ row, label: 'PLAY-IN', tone: 'amber', qualified: true })
      else slots.push({ row, label: i === p.direct + p.playIn ? 'OUT' : '', tone: i === p.direct + p.playIn ? 'red' : null, qualified: false })
    })
    // Bubble gap: relative to the last play-in spot.
    const edge = sorted[p.direct + p.playIn - 1]
    const firstOut = sorted[p.direct + p.playIn]
    for (let i = p.direct + p.playIn - 1; i < Math.min(sorted.length, p.direct + p.playIn + 2); i++) {
      const ref = i < p.direct + p.playIn ? firstOut : edge
      if (ref) gapRef.set(sorted[i].abbr, ref)
    }
    return { slots, gapRef }
  }

  let divWinners: StandingsRow[]
  let rest: StandingsRow[]
  let wcCount: number
  if (p.kind === 'nhl') {
    const winners: StandingsRow[] = []
    const others: StandingsRow[] = []
    for (const r of rows) (r.divRank <= 3 ? winners : others).push(r)
    divWinners = winners.sort(cmp)
    rest = others.sort(cmp)
    wcCount = p.wildCards
  } else {
    const winners: StandingsRow[] = []
    const others: StandingsRow[] = []
    for (const r of rows) (r.divRank === 1 ? winners : others).push(r)
    divWinners = winners.sort(cmp)
    rest = others.sort(cmp)
    wcCount = p.wildCards
  }

  divWinners.forEach((row) => slots.push({ row, label: 'DIV', tone: 'green', qualified: true }))
  rest.forEach((row, i) => {
    if (i < wcCount) slots.push({ row, label: `WC${i + 1}`, tone: 'amber', qualified: true })
    else slots.push({ row, label: i === wcCount ? 'OUT' : '', tone: i === wcCount ? 'red' : null, qualified: false })
  })

  const lastWc = rest[wcCount - 1]
  const firstOut = rest[wcCount]
  // Bubble gap: the last wild card vs the first team out, out teams vs the last wild card.
  rest.slice(Math.max(0, wcCount - 1), wcCount + 2).forEach((row) => {
    const ref = row === lastWc ? firstOut : lastWc
    if (ref) gapRef.set(row.abbr, ref)
  })
  return { slots, gapRef }
}

function gapBetween(a: StandingsRow, ref: StandingsRow, data: SportStandings): number {
  // Positive when `a` is ahead of `ref`.
  if (data.unit === 2) return (a.pts ?? 0) - (ref.pts ?? 0)
  return (a.w - ref.w + (ref.l - a.l)) / 2
}

/** Playoff status for every team in the sport, keyed by abbreviation. */
export function computeStatuses(data: SportStandings): Map<string, TeamStatus> {
  const out = new Map<string, TeamStatus>()
  // Before the first game every team is 0-0 — any ordering would be arbitrary, so show no picture.
  if (data.rows.every((r) => r.gp === 0)) return out
  for (const conf of data.conferences) {
    const { slots, gapRef } = slotsForConference(data, conf.id)
    const confRows = slots.map((s) => s.row)
    const k = cutoff(data, confRows.length)
    for (const slot of slots) {
      const ref = gapRef.get(slot.row.abbr)
      let gapText: string | null = null
      if (ref) {
        const diff = gapBetween(slot.row, ref, data)
        const isOut = !slot.qualified
        gapText = confGapText(isOut ? -Math.abs(diff) : Math.abs(diff), isOut, data)
      }
      out.set(slot.row.abbr, {
        label: slot.label,
        tone: slot.tone,
        gapText,
        magic: magicFor(
          slot.row,
          confRows.filter((r) => r.abbr !== slot.row.abbr),
          k,
          slot.qualified,
          data
        ),
      })
    }
  }
  return out
}

/** Ordered picture for one conference: qualifiers followed by the bubble (wild-card chasers). */
export function computePicture(data: SportStandings, confId: string, statuses: Map<string, TeamStatus>): ConferencePicture {
  const { slots } = slotsForConference(data, confId)
  const entries = slots
    .filter((s) => s.tone !== null && statuses.has(s.row.abbr))
    .map((s) => ({ row: s.row, status: statuses.get(s.row.abbr)! }))
  const p = data.playoff
  const format =
    p.kind === 'seeds'
      ? `Seeds 1–${p.direct} qualify directly · seeds ${p.direct + 1}–${p.direct + p.playIn} enter the play-in`
      : p.kind === 'nhl'
        ? `Top 3 in each division + ${p.wildCards} wild cards`
        : `Division winners + ${p.wildCards} wild cards`
  return { entries, format }
}
