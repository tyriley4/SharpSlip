import type { Edge as LegacyEdge } from '@/data/breakdown/types'
import type { Sport } from '@/lib/sport/SportContext'
import type { EdgeCategory } from './types'
export { ANALYSIS_CATEGORIES } from './analysisCategories'
import { explainBet } from './explainBet'
import { getRecommendedBets, type BetCardData } from './recommended'

const ICON: Record<EdgeCategory, string> = { recent_form: '📈', hit_rate: '🎯', matchup: '🏈', situational: '⚠️', h2h: '🔄', context: '📊', role: '🧭' }

/** Bet-market label the Analysis filter pills use. */
export function analysisLabel(b: BetCardData): string {
  return b.section === 'prop' ? 'Player Props' : b.market
}

function toLegacy(b: BetCardData, id: number, away: string, home: string): LegacyEdge {
  const top = b.insights[0]
  const team = b.section === 'prop' ? b.player?.team || undefined : [away, home].find((t) => b.description.startsWith(t))
  const conf = Math.round(50 + b.convictionScore * 50)
  return {
    id,
    icon: top ? ICON[top.category] : '🎯',
    bet: b.description,
    team,
    type: analysisLabel(b).toLowerCase(),
    typeLabel: analysisLabel(b),
    grade: (b.grade === 'A' || b.grade === 'B' ? b.grade : 'C') as 'A' | 'B' | 'C',
    conf,
    supporting: b.insights.length,
    line: `${b.odds !== null ? `${b.odds > 0 ? '+' : ''}${b.odds} ${b.book ?? ''}`.trim() : 'Estimated line'}${b.historicalHitRate !== null ? ` · ${Math.round(b.historicalHitRate)}% historical` : ''}`,
    altPlay: b.impliedProbability !== null ? `Market implies ${Math.round(b.impliedProbability)}%` : 'No posted price',
    analysis: b.insights
      .slice(0, 2)
      .map((i) => i.description)
      .join('. '),
    bullets: b.insights.slice(0, 4).map((i) => i.description),
    explanation: explainBet(b) ?? undefined,
    market: b.odds !== null ? { oddsAmerican: b.odds, book: b.book ?? undefined, prob: b.impliedProbability ?? undefined, lineId: b.leg.lineId, matchup: b.matchup } : undefined,
  }
}

/**
 * The Analysis tab, home top-edges and /edges all read the same evidence as Recommended Bets: the graded bets
 * for the game, strongest first, one side per game-line market. Props are included only when already cached.
 */
export async function getAnalysisEdges(sport: Sport, gameId: string, away: string, home: string): Promise<LegacyEdge[]> {
  const rec = await getRecommendedBets(sport, gameId, away, home, 'cached')
  const graded = [...rec.gameLines, ...rec.props.flatMap((g) => g.players.flatMap((p) => p.bets))].filter((b) => b.grade && ['A', 'B', 'C'].includes(b.grade)).sort((a, b) => b.convictionScore - a.convictionScore)
  const seen = new Set<string>()
  const picked: BetCardData[] = []
  for (const b of graded) {
    if (b.section === 'game') {
      const key = b.market === 'Moneyline' ? 'ml' : b.market === 'Total' ? 'total' : 'spread'
      if (seen.has(key)) continue
      seen.add(key)
    }
    picked.push(b)
  }
  return picked.slice(0, 8).map((b, i) => toLegacy(b, i + 1, away, home))
}
