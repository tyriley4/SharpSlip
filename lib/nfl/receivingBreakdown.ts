import { getNFLAdvancedStats, getNFLPlayerStats, getNFLWeeklyPlayerStats } from './api'
import { hitRatesForThresholds, type NFLThresholdHitRate } from './bettingStats'
import { normalizeNflAbbr } from './divisions'
import { getNFLGameMatchup, getNFLTeamSkillPlayers, type NFLSkillPlayerStats } from './gameBreakdown'

function n(v: string | undefined): number {
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : 0
}

export const REC_YDS_THRESHOLDS = [19.5, 29.5, 39.5, 49.5, 59.5, 74.5, 89.5]
export const REC_THRESHOLDS = [0.5, 1.5, 2.5, 3.5, 4.5]

export interface NFLReceivingAdvanced {
  airYardsShare: number | null
  avgSeparation: number | null
  avgYac: number | null
  avgCushion: number | null
}

export interface NFLReceivingPlayerCard {
  player: NFLSkillPlayerStats
  advanced: NFLReceivingAdvanced | null
  betting: {
    recYds: NFLThresholdHitRate[]
    receptions: NFLThresholdHitRate[]
    anytimeTd: NFLThresholdHitRate[]
  }
}

export interface NFLTeamReceivingSummary {
  targets: number
  rec: number
  yds: number
  rankByTargets: number
}

export interface NFLReceivingTabData {
  teamSummary: NFLTeamReceivingSummary | null
  players: NFLReceivingPlayerCard[]
}

async function getTeamReceivingRank(teamAbbr: string, season: number): Promise<NFLTeamReceivingSummary | null> {
  const rows = await getNFLPlayerStats(season)
  if (!rows) return null

  const byTeam = new Map<string, { targets: number; rec: number; yds: number }>()
  for (const r of rows) {
    const team = normalizeNflAbbr(r.recent_team)
    const cur = byTeam.get(team) ?? { targets: 0, rec: 0, yds: 0 }
    cur.targets += n(r.targets)
    cur.rec += n(r.receptions)
    cur.yds += n(r.receiving_yards)
    byTeam.set(team, cur)
  }

  const ranked = Array.from(byTeam.entries()).sort((a, b) => b[1].targets - a[1].targets)
  const idx = ranked.findIndex(([t]) => t === teamAbbr)
  const team = byTeam.get(teamAbbr)
  if (!team || idx === -1) return null

  return { targets: team.targets, rec: team.rec, yds: team.yds, rankByTargets: idx + 1 }
}

async function getTopReceivingBack(teamAbbr: string, season: number): Promise<NFLSkillPlayerStats | null> {
  const rows = await getNFLPlayerStats(season)
  if (!rows) return null
  const rb = rows
    .filter((r) => normalizeNflAbbr(r.recent_team) === teamAbbr && r.position === 'RB' && n(r.targets) >= 10)
    .sort((a, b) => n(b.receiving_yards) - n(a.receiving_yards))[0]
  if (!rb) return null
  return {
    playerId: rb.player_id,
    name: rb.player_display_name || rb.player_name,
    position: rb.position,
    team: teamAbbr,
    season: {
      att: n(rb.carries),
      rushYds: n(rb.rushing_yards),
      rushTd: n(rb.rushing_tds),
      ypc: n(rb.carries) > 0 ? Math.round((n(rb.rushing_yards) / n(rb.carries)) * 10) / 10 : 0,
      targets: n(rb.targets),
      rec: n(rb.receptions),
      recYds: n(rb.receiving_yards),
      recTd: n(rb.receiving_tds),
      targetShare: Math.round(n(rb.target_share) * 1000) / 10,
      airYardsShare: Math.round(n(rb.air_yards_share) * 1000) / 10,
    },
    last5: [],
  }
}

function buildBetting(games: Record<string, string>[]): NFLReceivingPlayerCard['betting'] {
  return {
    recYds: hitRatesForThresholds(games, 'receiving_yards', REC_YDS_THRESHOLDS),
    receptions: hitRatesForThresholds(games, 'receptions', REC_THRESHOLDS),
    anytimeTd: hitRatesForThresholds(
      games.map((g) => ({ ...g, anytime_td: String(n(g.rushing_tds) + n(g.receiving_tds)) })),
      'anytime_td',
      [0.5]
    ),
  }
}

export async function getNFLReceivingTabData(gameId: string, team: 'away' | 'home'): Promise<NFLReceivingTabData | null> {
  const matchup = await getNFLGameMatchup(gameId)
  if (!matchup) return null
  const teamAbbr = team === 'away' ? matchup.away.abbr : matchup.home.abbr

  const [teamSummary, wrPlayers, tePlayers, rbRec, ngsRows, weekly] = await Promise.all([
    getTeamReceivingRank(teamAbbr, matchup.season),
    getNFLTeamSkillPlayers(teamAbbr, matchup.season, 'WR'),
    getNFLTeamSkillPlayers(teamAbbr, matchup.season, 'TE'),
    getTopReceivingBack(teamAbbr, matchup.season),
    getNFLAdvancedStats('receiving', matchup.season),
    getNFLWeeklyPlayerStats(matchup.season),
  ])

  const candidates: NFLSkillPlayerStats[] = [...wrPlayers.slice(0, 2), ...tePlayers.slice(0, 1), ...(rbRec ? [rbRec] : [])]

  const players: NFLReceivingPlayerCard[] = candidates.map((player) => {
    const ngsRow = ngsRows?.find((r) => r.player_display_name === player.name)
    const advanced: NFLReceivingAdvanced | null = ngsRow
      ? {
          airYardsShare: Number(ngsRow.percent_share_of_intended_air_yards),
          avgSeparation: Number(ngsRow.avg_separation),
          avgYac: Number(ngsRow.avg_yac),
          avgCushion: Number(ngsRow.avg_cushion),
        }
      : null

    const games = (weekly ?? []).filter((r) => r.player_id === player.playerId && n(r.targets) > 0)

    return { player, advanced, betting: buildBetting(games) }
  })

  return { teamSummary, players }
}
