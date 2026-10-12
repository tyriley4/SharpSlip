import { getCollegeSlate } from '@/lib/college/slate'
import { getCollegeStandings } from '@/lib/college/standings'

export interface CbbHomeInfo {
  /** True until the first regular-season game is played. */
  preseason: boolean
  /** ISO time of the first scheduled game day, when known. */
  opens: string | null
  lastSeasonLabel: string | null
  pollName: string | null
  pollUpdated: string | null
  top: { rank: number; name: string; abbr: string; logo: string | null; color: string; record: string | null }[]
}

/** What the home page shows for college basketball while the season is still ahead: the tip-off date and the last published poll. */
export async function getCbbHomeInfo(): Promise<CbbHomeInfo> {
  const [slate, standings] = await Promise.all([getCollegeSlate('cbb').catch(() => null), getCollegeStandings('cbb').catch(() => null)])
  const poll = standings?.polls.find((p) => p.key === 'ap' && p.available) ?? null
  return {
    preseason: slate?.preseason ?? false,
    opens: slate?.seasonOpens ?? null,
    lastSeasonLabel: standings?.lastSeason ? standings.seasonLabel : null,
    pollName: poll?.name ?? null,
    pollUpdated: poll?.updated ?? null,
    top: (poll?.rows ?? []).slice(0, 5).map((r) => ({ rank: r.rank, name: r.name, abbr: r.abbr, logo: r.logo, color: r.color, record: r.record })),
  }
}
