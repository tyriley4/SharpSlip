import type { LeaderGroup } from '@/data/leaders/types'
import { getLeagueLeaders, getMlbTeamsIndex, getTeamStats } from './api'
import { HITTER_CATEGORIES, PITCHER_API_CATEGORIES, PITCHER_CATEGORY_LABELS, TEAM_CATEGORIES } from './leaderCategories'
import { mapLeaders, mapTeamCategoryLeaders } from './mappers'
import { getQualityStartsLeaders } from './qualityStarts'

const HITTER_LABELS = HITTER_CATEGORIES.map((c) => c.label)

export async function buildMlbLeaders(limit = 15): Promise<LeaderGroup | null> {
  const teams = await getMlbTeamsIndex()
  if (!teams) return null

  const [hitterResults, pitcherResults, hittingTeamStats, pitchingTeamStats, qsLeaders] = await Promise.all([
    Promise.all(HITTER_CATEGORIES.map((c) => getLeagueLeaders(c.param, 'hitting', limit))),
    Promise.all(PITCHER_API_CATEGORIES.map((c) => getLeagueLeaders(c.param, 'pitching', limit))),
    getTeamStats('hitting'),
    getTeamStats('pitching'),
    getQualityStartsLeaders(teams, limit),
  ])

  const hitterRows: Record<string, ReturnType<typeof mapLeaders>> = {}
  HITTER_CATEGORIES.forEach((c, i) => {
    const leaders = hitterResults[i]
    if (leaders) hitterRows[c.label] = mapLeaders(leaders, teams)
  })

  const pitcherRows: Record<string, ReturnType<typeof mapLeaders>> = {}
  PITCHER_API_CATEGORIES.forEach((c, i) => {
    const leaders = pitcherResults[i]
    if (leaders) pitcherRows[c.label] = mapLeaders(leaders, teams)
  })
  pitcherRows.QS = qsLeaders

  const teamRows: Record<string, ReturnType<typeof mapTeamCategoryLeaders>> = {}
  for (const cat of TEAM_CATEGORIES) {
    const stats = cat.group === 'hitting' ? hittingTeamStats : pitchingTeamStats
    if (stats) {
      teamRows[cat.label] = mapTeamCategoryLeaders(stats, teams, cat.field, {
        perGame: cat.perGame,
        ascending: cat.ascending,
      })
    }
  }

  return {
    subs: ['Hitters', 'Pitchers', 'Teams'],
    cats: {
      Hitters: HITTER_LABELS,
      Pitchers: PITCHER_CATEGORY_LABELS,
      Teams: TEAM_CATEGORIES.map((c) => c.label),
    },
    rows: {
      Hitters: hitterRows,
      Pitchers: pitcherRows,
      Teams: teamRows,
    },
  }
}
