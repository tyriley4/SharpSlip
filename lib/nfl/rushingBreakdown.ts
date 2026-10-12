import { getNFLAdvancedStats, getNFLPlayerStats, getNFLWeeklyPlayerStats } from './api'
import { hitRatesForThresholds, type NFLThresholdHitRate } from './bettingStats'
import { normalizeNflAbbr } from './divisions'
import { getNFLGameMatchup, getNFLTeamSkillPlayers, type NFLSkillPlayerStats } from './gameBreakdown'

function n(v: string | undefined): number {
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : 0
}

export const RUSH_YDS_THRESHOLDS = [29.5, 49.5, 59.5, 74.5, 89.5, 99.5]
export const RUSH_REC_THRESHOLDS = [1.5, 2.5, 3.5]

export interface NFLRushingAdvanced {
  efficiency: number | null
  expectedRushYards: number | null
  rushYardsOverExpected: number | null
}

export interface NFLRushPlayerCard {
  player: NFLSkillPlayerStats
  advanced: NFLRushingAdvanced | null
  betting: {
    rushYds: NFLThresholdHitRate[]
    anytimeTd: NFLThresholdHitRate[]
    receptions: NFLThresholdHitRate[]
  }
}

export interface NFLTeamRushSummary {
  att: number
  yds: number
  ypc: number
  tds: number
  rankByYds: number
}

export interface NFLRushingTabData {
  teamSummary: NFLTeamRushSummary | null
  players: NFLRushPlayerCard[]
}

async function getTeamRushRank(teamAbbr: string, season: number): Promise<{ summary: NFLTeamRushSummary | null }> {
  const rows = await getNFLPlayerStats(season)
  if (!rows) return { summary: null }

  const byTeam = new Map<string, { att: number; yds: number; tds: number }>()
  for (const r of rows) {
    const team = normalizeNflAbbr(r.recent_team)
    const cur = byTeam.get(team) ?? { att: 0, yds: 0, tds: 0 }
    cur.att += n(r.carries)
    cur.yds += n(r.rushing_yards)
    cur.tds += n(r.rushing_tds)
    byTeam.set(team, cur)
  }

  const ranked = Array.from(byTeam.entries()).sort((a, b) => b[1].yds - a[1].yds)
  const idx = ranked.findIndex(([t]) => t === teamAbbr)
  const team = byTeam.get(teamAbbr)
  if (!team || idx === -1) return { summary: null }

  return {
    summary: {
      att: team.att,
      yds: team.yds,
      ypc: team.att > 0 ? Math.round((team.yds / team.att) * 10) / 10 : 0,
      tds: team.tds,
      rankByYds: idx + 1,
    },
  }
}

export async function getNFLRushingTabData(gameId: string, team: 'away' | 'home'): Promise<NFLRushingTabData | null> {
  const matchup = await getNFLGameMatchup(gameId)
  if (!matchup) return null
  const teamAbbr = team === 'away' ? matchup.away.abbr : matchup.home.abbr

  const [{ summary }, rbPlayers, ngsRows, weekly] = await Promise.all([
    getTeamRushRank(teamAbbr, matchup.season),
    getNFLTeamSkillPlayers(teamAbbr, matchup.season, 'RB'),
    getNFLAdvancedStats('rushing', matchup.season),
    getNFLWeeklyPlayerStats(matchup.season),
  ])

  const players: NFLRushPlayerCard[] = rbPlayers.slice(0, 2).map((player) => {
    const ngsRow = ngsRows?.find((r) => r.player_display_name === player.name)
    const advanced: NFLRushingAdvanced | null = ngsRow
      ? {
          efficiency: Number(ngsRow.efficiency),
          expectedRushYards: ngsRow.expected_rush_yards ? Number(ngsRow.expected_rush_yards) : null,
          rushYardsOverExpected: ngsRow.rush_yards_over_expected ? Number(ngsRow.rush_yards_over_expected) : null,
        }
      : null

    const games = (weekly ?? []).filter((r) => r.player_id === player.playerId && (n(r.carries) > 0 || n(r.receptions) > 0))

    return {
      player,
      advanced,
      betting: {
        rushYds: hitRatesForThresholds(games, 'rushing_yards', RUSH_YDS_THRESHOLDS),
        anytimeTd: hitRatesForThresholds(
          games.map((g) => ({ ...g, anytime_td: String(n(g.rushing_tds) + n(g.receiving_tds)) })),
          'anytime_td',
          [0.5]
        ),
        receptions: hitRatesForThresholds(games, 'receptions', RUSH_REC_THRESHOLDS),
      },
    }
  })

  return { teamSummary: summary, players }
}
