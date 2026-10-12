import fs from 'node:fs'
import path from 'node:path'
import type { Sport } from '@/lib/sport/SportContext'
import type { CreditState, GameOdds } from './types'

/**
 * Tiny JSON persistence for two things that must outlive a dev-server restart:
 *  - The Odds API credit counter (so a restart can't make us forget we're nearly out of credits).
 *  - The line archive: the last pre-game line seen for every game, which is the only source of real
 *    historical spreads/totals available on free tiers (ESPN drops odds from finished games).
 * Failures to read/write are non-fatal — the app just behaves as if there's no history yet.
 */

const DIR = path.join(process.cwd(), '.data')
const STATE_FILE = path.join(DIR, 'odds-state.json')
const ARCHIVE_FILE = path.join(DIR, 'line-archive.json')

function monthKey(d = new Date()): string {
  return d.toISOString().slice(0, 7)
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T
  } catch {
    return null
  }
}

function writeJson(file: string, data: unknown) {
  try {
    fs.mkdirSync(DIR, { recursive: true })
    fs.writeFileSync(file, JSON.stringify(data))
  } catch (err) {
    console.error('[odds-store] write failed', (err as Error).message)
  }
}

// ---------------------------------------------------------------------------
// Credits
// ---------------------------------------------------------------------------

const g = globalThis as unknown as { __sharpslipCredits?: CreditState; __sharpslipArchive?: Archive }

function freshCredits(): CreditState {
  return { remaining: null, used: null, lastCost: null, exhausted: false, updatedAt: null, month: monthKey() }
}

export function getCredits(): CreditState {
  if (!g.__sharpslipCredits) g.__sharpslipCredits = readJson<CreditState>(STATE_FILE) ?? freshCredits()
  // Credits reset monthly on The Odds API; forget last month's "exhausted" flag.
  if (g.__sharpslipCredits.month !== monthKey()) g.__sharpslipCredits = freshCredits()
  return g.__sharpslipCredits
}

export function saveCredits(patch: Partial<CreditState>): CreditState {
  const next = { ...getCredits(), ...patch, updatedAt: new Date().toISOString(), month: monthKey() }
  g.__sharpslipCredits = next
  writeJson(STATE_FILE, next)
  return next
}

// ---------------------------------------------------------------------------
// Line archive
// ---------------------------------------------------------------------------

export interface ArchivedLine {
  sport: Sport
  away: string
  home: string
  /** Scheduled start, ISO. */
  commence: string
  /** Home team's spread (negative = home favored). */
  homeSpread: number | null
  homeSpreadPrice: number | null
  awaySpreadPrice: number | null
  total: number | null
  overPrice: number | null
  underPrice: number | null
  homeMl: number | null
  awayMl: number | null
  book: string
  source: string
  capturedAt: string
}

type Archive = Record<string, ArchivedLine>

function archive(): Archive {
  if (!g.__sharpslipArchive) g.__sharpslipArchive = readJson<Archive>(ARCHIVE_FILE) ?? {}
  return g.__sharpslipArchive
}

function keyFor(l: Pick<ArchivedLine, 'sport' | 'away' | 'home' | 'commence'>): string {
  return `${l.sport}|${l.commence.slice(0, 10)}|${l.away}|${l.home}`
}

let flushTimer: ReturnType<typeof setTimeout> | null = null
function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    writeJson(ARCHIVE_FILE, archive())
  }, 1500)
}

/** Records the current pre-game line for each game. Later snapshots before tip-off overwrite earlier ones, so the stored line converges on the closing line. */
export function recordLines(lines: ArchivedLine[]) {
  const a = archive()
  let changed = false
  for (const l of lines) {
    if (!l.commence || Date.parse(l.commence) <= Date.now()) continue // never overwrite with in-play numbers
    if (l.homeSpread === null && l.total === null && l.homeMl === null) continue
    const k = keyFor(l)
    const prev = a[k]
    if (prev && prev.capturedAt >= l.capturedAt) continue
    a[k] = l
    changed = true
  }
  if (changed) scheduleFlush()
}

export function archiveFromGameOdds(o: GameOdds): ArchivedLine | null {
  if (!o.commenceTime) return null
  const hs = o.spread.home
  const as = o.spread.away
  return {
    sport: o.sport,
    away: o.away,
    home: o.home,
    commence: o.commenceTime,
    homeSpread: hs?.point ?? null,
    homeSpreadPrice: hs?.price ?? null,
    awaySpreadPrice: as?.price ?? null,
    total: o.total.line,
    overPrice: o.total.over?.price ?? null,
    underPrice: o.total.under?.price ?? null,
    homeMl: o.moneyline.home?.price ?? null,
    awayMl: o.moneyline.away?.price ?? null,
    book: o.book,
    source: o.source,
    capturedAt: o.fetchedAt,
  }
}

export function archivedLinesFor(sport: Sport): ArchivedLine[] {
  return Object.values(archive()).filter((l) => l.sport === sport)
}

/** Looks up the archived closing line for a game between two teams on (or one day either side of) a date. */
export function lookupArchivedLine(sport: Sport, away: string, home: string, dateISO: string): ArchivedLine | null {
  const target = Date.parse(dateISO.slice(0, 10))
  if (!Number.isFinite(target)) return null
  let best: ArchivedLine | null = null
  let bestGap = Infinity
  for (const l of archivedLinesFor(sport)) {
    if (l.away !== away || l.home !== home) continue
    const gap = Math.abs(Date.parse(l.commence.slice(0, 10)) - target)
    if (gap <= 86400000 && gap < bestGap) {
      best = l
      bestGap = gap
    }
  }
  return best
}

export function archiveSize(): number {
  return Object.keys(archive()).length
}
