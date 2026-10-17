import { cached } from '@/lib/net/ttlCache'

/** How one MLB hitter has done against tonight's starter and against that starter's handedness. */
export interface HitterMatchup {
  pitcher: string
  hand: 'L' | 'R' | null
  /** Career against this exact pitcher. */
  vs: { atBats: number; plateAppearances: number; hits: number; homeRuns: number; strikeOuts: number; avg: number } | null
  /** This season against left- or right-handed pitching. */
  platoon: { hand: 'L' | 'R'; atBats: number; hits: number; homeRuns: number; avg: number; ops: string } | null
  /** The other handedness, so the platoon edge is checked against the hitter's own split. */
  opposite: { atBats: number; avg: number; ops: string } | null
  /** Average over the last ten games against the season average (at-bats behind each). */
  form: { last10Avg: number | null; last10Ab: number; seasonAvg: number | null }
}

interface Split {
  split?: { code?: string }
  stat: { atBats?: number; plateAppearances?: number; hits?: number; homeRuns?: number; strikeOuts?: number; avg?: string; ops?: string }
}

const get = async <T>(url: string): Promise<T | null> => {
  try {
    const res = await fetch(url, { next: { revalidate: 21600 } })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

export async function loadHitterMatchup(playerId: string, pitcherId: number, pitcherName: string, season: number): Promise<HitterMatchup | null> {
  return cached(`edges:mlbmatch:${playerId}:${pitcherId}:${season}`, 21600, async () => {
    const [hand, vs, platoon, log] = await Promise.all([
      get<{ people?: { pitchHand?: { code?: string } }[] }>(`https://statsapi.mlb.com/api/v1/people/${pitcherId}?fields=people,id,pitchHand,code`),
      get<{ stats?: { splits?: Split[] }[] }>(`https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=vsPlayer&group=hitting&opposingPlayerId=${pitcherId}`),
      get<{ stats?: { splits?: Split[] }[] }>(`https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=statSplits&group=hitting&sitCodes=vl,vr&season=${season}`),
      get<{ stats?: { splits?: { date?: string; stat: { atBats?: number; hits?: number } }[] }[] }>(`https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=gameLog&group=hitting&season=${season}`),
    ])
    const games = [...(log?.stats?.[0]?.splits ?? [])].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    const l10 = games.slice(0, 10)
    const l10Ab = l10.reduce((n, g) => n + (g.stat.atBats ?? 0), 0)
    const sAb = games.reduce((n, g) => n + (g.stat.atBats ?? 0), 0)
    const sH = games.reduce((n, g) => n + (g.stat.hits ?? 0), 0)
    const h = hand?.people?.[0]?.pitchHand?.code
    const pitchHand = h === 'L' || h === 'R' ? h : null
    const v = vs?.stats?.[0]?.splits?.[0]?.stat
    const pSplit = platoon?.stats?.[0]?.splits?.find((s) => s.split?.code === (pitchHand === 'L' ? 'vl' : 'vr'))?.stat
    const oSplit = platoon?.stats?.[0]?.splits?.find((s) => s.split?.code === (pitchHand === 'L' ? 'vr' : 'vl'))?.stat
    return {
      pitcher: pitcherName,
      hand: pitchHand,
      vs: v ? { atBats: v.atBats ?? 0, plateAppearances: v.plateAppearances ?? 0, hits: v.hits ?? 0, homeRuns: v.homeRuns ?? 0, strikeOuts: v.strikeOuts ?? 0, avg: Number(v.avg ?? 0) } : null,
      platoon: pSplit && pitchHand ? { hand: pitchHand, atBats: pSplit.atBats ?? 0, hits: pSplit.hits ?? 0, homeRuns: pSplit.homeRuns ?? 0, avg: Number(pSplit.avg ?? 0), ops: pSplit.ops ?? '' } : null,
      opposite: oSplit && pitchHand ? { atBats: oSplit.atBats ?? 0, avg: Number(oSplit.avg ?? 0), ops: oSplit.ops ?? '' } : null,
      form: { last10Avg: l10Ab >= 15 ? l10.reduce((n, g) => n + (g.stat.hits ?? 0), 0) / l10Ab : null, last10Ab: l10Ab, seasonAvg: sAb >= 40 ? sH / sAb : null },
    } satisfies HitterMatchup
  })
}
