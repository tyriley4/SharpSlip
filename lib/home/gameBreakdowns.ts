import { getRealGameBreakdown } from '@/lib/mlb/gameBreakdown'
import { getNFLAnalysisData } from '@/lib/nfl/gameBreakdown'
import { getNBAAnalysisData } from '@/lib/nba/gameBreakdown'
import { getNHLAnalysisData } from '@/lib/nhl/gameBreakdown'
import { getCbbAnalysis } from '@/lib/cbb/engine'
import { getCfbAnalysis } from '@/lib/cfb/engine'
import { dateOffset, getUnifiedGamesForDate, type UnifiedGame } from './schedule'
import { mapWithConcurrency, withTimeout } from '@/lib/utils/concurrency'
import type { Edge } from '@/data/breakdown/types'
import type { Sport } from '@/lib/sport/SportContext'

export interface GameEdges {
  game: UnifiedGame
  edges: Edge[]
}

type Fetched = { edges: Edge[] }

// Caps the number of games analyzed per sport per refresh, to bound latency/API load.
const MAX_GAMES_PER_SPORT = 6

async function collect(games: UnifiedGame[], fetcher: (id: string) => Promise<Fetched | null>, label: string): Promise<GameEdges[]> {
  const rows = await mapWithConcurrency(games.slice(0, MAX_GAMES_PER_SPORT), 3, async (g): Promise<GameEdges | null> => {
    try {
      const data = await fetcher(g.id)
      return data ? { game: g, edges: data.edges } : null
    } catch (err) {
      console.error(`[home/gameBreakdowns] ${label} game ${g.id} failed:`, err)
      return null
    }
  })
  return rows.filter((r): r is GameEdges => r !== null)
}

/**
 * Fetches every qualifying game's full edge list once per sport, shared by getTopEdgesToday,
 * getAllEdgesToday and getTopGamesToday so the home page doesn't re-fetch the same breakdowns
 * three times over.
 */
export async function getTodaysGameBreakdowns(): Promise<Record<Sport, GameEdges[]>> {
  const games = await getUnifiedGamesForDate(dateOffset(0))
  const bySport: Record<Sport, UnifiedGame[]> = { mlb: [], nfl: [], cfb: [], nba: [], cbb: [], nhl: [] }
  for (const g of games) bySport[g.sport].push(g)

  const bounded = (p: Promise<GameEdges[]>) => withTimeout(p, 20000, [] as GameEdges[])
  // College slates are long; analyse the ranked matchups first.
  const rankKey = (g: UnifiedGame) => Math.min(g.awayRank ?? 99, g.homeRank ?? 99)
  bySport.cfb.sort((a, b) => rankKey(a) - rankKey(b))
  bySport.cbb.sort((a, b) => rankKey(a) - rankKey(b))
  const [mlb, nfl, nba, nhl, cfb, cbb] = await Promise.all([
    bounded(
      collect(
        bySport.mlb,
        async (id) => {
          const d = await getRealGameBreakdown(Number(id))
          return d ? { edges: d.edges } : null
        },
        'MLB'
      )
    ),
    bounded(
      collect(
        bySport.nfl,
        async (id) => {
          const d = await getNFLAnalysisData(id)
          return d ? { edges: d.edges } : null
        },
        'NFL'
      )
    ),
    bounded(
      collect(
        bySport.nba,
        async (id) => {
          const d = await getNBAAnalysisData(id)
          return d ? { edges: d.edges } : null
        },
        'NBA'
      )
    ),
    bounded(
      collect(
        bySport.nhl,
        async (id) => {
          const d = await getNHLAnalysisData(id)
          return d ? { edges: d.edges } : null
        },
        'NHL'
      )
    ),
    bounded(
      collect(
        bySport.cfb,
        async (id) => {
          const d = await getCfbAnalysis(id)
          return d ? { edges: d.edges } : null
        },
        'CFB'
      )
    ),
    bounded(
      collect(
        bySport.cbb,
        async (id) => {
          const d = await getCbbAnalysis(id)
          return d ? { edges: d.edges } : null
        },
        'CBB'
      )
    ),
  ])
  return { mlb, nfl, cfb, nba, cbb, nhl }
}
