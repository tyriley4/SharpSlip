import { NBA_CURRENT_SEASON } from '@/lib/nba/divisions'
import { NHL_CURRENT_SEASON } from '@/lib/nhl/divisions'

/** How many seasons of game logs "Career" draws on. */
export const CAREER_SEASON_COUNT = 5

export const CAREER_NOTE = 'Career stats based on available historical data (last 5 seasons of game logs).'
export const CAREER_STAT_NOTE = 'Showing career averages and totals from the last 5 seasons of game logs.'

/** Career data changes slowly — 7 days. */
export const CAREER_REVALIDATE = 604800

/** MLB seasons, oldest first (so concatenated game logs stay chronological). */
export function mlbCareerSeasons(now: Date = new Date()): number[] {
  const year = now.getFullYear()
  return Array.from({ length: CAREER_SEASON_COUNT }, (_, i) => year - (CAREER_SEASON_COUNT - 1 - i))
}

/** NHL season ids (YYYYZZZZ), oldest first. */
export function nhlCareerSeasons(): number[] {
  const start = Math.floor(NHL_CURRENT_SEASON / 10000)
  return Array.from({ length: CAREER_SEASON_COUNT }, (_, i) => {
    const y = start - (CAREER_SEASON_COUNT - 1 - i)
    return y * 10000 + (y + 1)
  })
}

/** NBA season strings ("2024-25"), oldest first. */
export function nbaCareerSeasons(): string[] {
  const start = Number(NBA_CURRENT_SEASON.slice(0, 4))
  return Array.from({ length: CAREER_SEASON_COUNT }, (_, i) => {
    const y = start - (CAREER_SEASON_COUNT - 1 - i)
    return `${y}-${String(y + 1).slice(-2)}`
  })
}

/** NFL seasons, oldest first, ending at `latest`. */
export function nflCareerSeasons(latest: number): number[] {
  return Array.from({ length: CAREER_SEASON_COUNT }, (_, i) => latest - (CAREER_SEASON_COUNT - 1 - i))
}
