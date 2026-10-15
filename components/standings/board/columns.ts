import type { SportStandings, StandingsRow } from '@/lib/standings/types'

export type ColumnTier = 'base' | 'md' | 'lg'

export const TIER_CLASS: Record<ColumnTier, string> = { base: 'flex', md: 'hidden md:flex', lg: 'hidden lg:flex' }

export interface StandingsColumn {
  key: string
  label: string
  /** base: always; md: tablet (≥768px, when the app shell goes full-width) and up; lg: desktop (≥1024px) only. */
  tier: ColumnTier
  width: number
  value: (r: StandingsRow) => string
  /** Visually emphasised (sport-specific headline stat). */
  prominent?: boolean
  kind?: 'streak' | 'win' | 'loss'
}

const PROMINENT: Record<string, string[]> = {
  mlb: ['rd'],
  nfl: ['pd'],
  nba: ['home', 'away'],
  nhl: ['pctp'],
}

const EXTRA_WIDTH: Record<string, number> = { rd: 48, era: 44, pd: 50, conf: 54, row: 42, diff: 48, pctp: 46 }

/** Always-visible columns first, then the tablet/desktop-only ones. */
export function columnsFor(data: SportStandings): StandingsColumn[] {
  const nhl = data.sport === 'nhl'
  const prominent = PROMINENT[data.sport] ?? []
  const cols: StandingsColumn[] = [
    { key: 'w', label: 'W', tier: 'base', width: 28, value: (r) => String(r.w), kind: 'win' },
    { key: 'l', label: 'L', tier: 'base', width: 28, value: (r) => String(r.l), kind: 'loss' },
  ]
  if (data.tColumn) cols.push({ key: 't', label: data.tColumn, tier: 'base', width: data.tColumn === 'OTL' ? 38 : 30, value: (r) => String(r.t) })
  if (nhl) {
    cols.push({ key: 'pts', label: 'PTS', tier: 'base', width: 42, value: (r) => String(r.pts ?? 0), prominent: true })
  } else {
    cols.push({ key: 'pct', label: 'PCT', tier: 'base', width: 42, value: (r) => r.pct })
    cols.push({ key: 'gb', label: 'GB', tier: 'base', width: 34, value: (r) => r.gb })
  }

  cols.push(
    { key: 'home', label: 'HOME', tier: 'md', width: 56, value: (r) => r.home, prominent: prominent.includes('home') },
    { key: 'away', label: 'AWAY', tier: 'md', width: 56, value: (r) => r.away, prominent: prominent.includes('away') },
    ...(data.rows.some((r) => r.last5) ? [{ key: 'l5', label: 'L5', tier: 'md' as const, width: 44, value: (r: StandingsRow) => r.last5 ?? '—' }] : []),
    { key: 'l10', label: 'L10', tier: 'md', width: 48, value: (r) => r.last10 },
    { key: 'streak', label: 'STREAK', tier: 'md', width: 58, value: (r) => r.streak, kind: 'streak' }
  )

  // Sport-specific extras (RD, ERA, PD, CONF, P%, ROW, DIFF…); skip any column the source left empty.
  const sample = data.rows[0]
  let extraIndex = 0
  for (const ex of sample?.extras ?? []) {
    const key = ex.key
    const has = data.rows.some((r) => {
      const v = r.extras.find((e) => e.key === key)?.value
      return v !== undefined && v !== '' && v !== '—'
    })
    if (!has) continue
    cols.push({
      key,
      label: ex.label,
      tier: extraIndex++ === 0 ? 'md' : 'lg',
      width: EXTRA_WIDTH[key] ?? 52,
      value: (r) => r.extras.find((e) => e.key === key)?.value || '—',
      prominent: prominent.includes(key),
    })
  }
  return cols
}

const STAR = 24

export interface GridTemplates {
  base: string
  md: string
  lg: string
}

export function gridTemplates(cols: StandingsColumn[]): GridTemplates {
  const px = (list: StandingsColumn[]) => list.map((c) => `${c.width}px`).join(' ')
  const upTo = (tiers: ColumnTier[]) => `minmax(0,1fr) ${px(cols.filter((c) => tiers.includes(c.tier)))} ${STAR}px`
  return { base: upTo(['base']), md: upTo(['base', 'md']), lg: upTo(['base', 'md', 'lg']) }
}
