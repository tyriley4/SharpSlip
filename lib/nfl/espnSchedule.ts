import { getScoreboard } from '@/lib/espn/api'

type Row = Record<string, string>

/**
 * Fills final scores into nflverse's schedule rows from ESPN's scoreboard, which posts a result the moment a game ends
 * (nflverse's schedule file trails by hours to days). Only games the schedule shows as unplayed are touched, and
 * only finished ESPN games are used; everything else on the row (lines, rest, roof …) stays nflverse's.
 */
export async function withEspnResults(rows: Row[], season: number): Promise<Row[]> {
  try {
    const open = rows.filter((r) => r.game_type === 'REG' && (r.home_score === '' || r.away_score === ''))
    if (open.length === 0) return rows
    const lastWeekWithOpen = Math.min(...open.map((r) => Number(r.week)))
    const weeks = Array.from(new Set(rows.filter((r) => r.game_type === 'REG' && Number(r.week) >= lastWeekWithOpen).map((r) => Number(r.week)))).filter((w) => w <= lastWeekWithOpen + 1)
    const boards = await Promise.all(weeks.map((w) => getScoreboard('football', 'nfl', undefined, { week: w, seasonType: 2, ttl: 120 }).catch(() => null)))
    const finals = new Map<string, { home: number; away: number; ot: boolean }>()
    for (const b of boards) {
      for (const g of b?.games ?? []) {
        if (g.state !== 'post' || g.home.score === null || g.away.score === null) continue
        finals.set(g.id, { home: g.home.score, away: g.away.score, ot: g.period > 4 })
      }
    }
    if (finals.size === 0) return rows
    return rows.map((r) => {
      if (r.game_type !== 'REG' || (r.home_score !== '' && r.away_score !== '')) return r
      if (String(season) !== r.season) return r
      const f = finals.get(r.espn)
      if (!f) return r
      return { ...r, home_score: String(f.home), away_score: String(f.away), result: String(f.home - f.away), total: String(f.home + f.away), overtime: f.ot ? '1' : r.overtime }
    })
  } catch (err) {
    console.error('[nfl/espnSchedule] failed', err)
    return rows
  }
}
