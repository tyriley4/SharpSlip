import { AppShell } from '@/components/layout/AppShell'
import { CareerVsTonight } from '@/components/players/CareerVsTonight'
import { MatchupSplits } from '@/components/players/MatchupSplits'
import { NbaPropBettingRecord } from '@/components/players/NbaPropBettingRecord'
import { NhlPropBettingRecord } from '@/components/players/NhlPropBettingRecord'
import { CfbPropCalculator, CfbSeasonStats } from '@/components/players/CfbPlayerExtras'
import { NflPropBettingRecord } from '@/components/players/NflPropBettingRecord'
import { PlayerComingSoon } from '@/components/players/PlayerComingSoon'
import { PlayerHeader } from '@/components/players/PlayerHeader'
import { PropBettingRecord } from '@/components/players/PropBettingRecord'
import { RecentFormTable } from '@/components/players/RecentFormTable'
import { getPlayerConviction } from '@/lib/edges/playerEdge'
import { TonightEdgeCard } from '@/components/players/TonightEdgeCard'
import { MLB_TEAM_COLORS } from '@/data/mlb/teamColors'
import { NBA_TEAM_COLORS } from '@/data/nba/teamColors'
import { NFL_TEAM_COLORS } from '@/data/nfl/teamColors'
import { NHL_TEAM_COLORS } from '@/data/nhl/teamColors'
import { buildNflPlayerProfile, type NflPlayerProfile } from '@/lib/nfl/playerProfile'
import { buildCbbPlayerProfile, findCbbPlayerBySlug, type CbbPlayerProfile } from '@/lib/cbb/playerProfile'
import { buildCfbPlayerProfile, findCfbPlayerBySlug, type CfbPlayerProfile } from '@/lib/cfb/playerProfile'
import { getBestProp, toTonightEdge } from '@/lib/mlb/bettingPlayerStats'
import { findMlbPlayerIdBySlug } from '@/lib/mlb/playerLookup'
import { buildLiveMlbPlayerRow } from '@/lib/mlb/playerProfile'
import { getBestNbaProp, toNbaTonightEdge } from '@/lib/nba/bettingPlayerStats'
import { findNbaPlayerIdBySlug } from '@/lib/nba/playerLookup'
import { buildLiveNbaPlayerRow } from '@/lib/nba/playerProfile'
import { getBestNhlProp, toNhlTonightEdge } from '@/lib/nhl/bettingPlayerStats'
import { findNhlPlayerIdBySlug } from '@/lib/nhl/playerLookup'
import { buildLiveNhlPlayerRow } from '@/lib/nhl/playerProfile'
import { findNflPlayerId } from '@/lib/props/careerLogs'
import { isNflBettingSub, type NflBettingSub } from '@/lib/nfl/bettingCategories'
import type { CareerParams } from '@/components/players/CareerCompare'
import { getPlayerBySlug } from '@/lib/players/getPlayer'
import type { PlayerRow } from '@/lib/players/types'

/** Best-effort live MLB fallback — any failure here should never take down the page. */
async function tryLiveMlbFallback(slug: string): Promise<PlayerRow | null> {
  try {
    const liveMatch = await findMlbPlayerIdBySlug(slug)
    if (!liveMatch) return null
    return await buildLiveMlbPlayerRow(liveMatch.id, slug)
  } catch (err) {
    console.error(`[PlayerPage] live MLB fallback failed for "${slug}":`, err)
    return null
  }
}

/** Best-effort live NBA fallback — any failure here should never take down the page. */
async function tryLiveNbaFallback(slug: string): Promise<PlayerRow | null> {
  try {
    const liveMatch = await findNbaPlayerIdBySlug(slug)
    if (!liveMatch) return null
    return await buildLiveNbaPlayerRow(liveMatch.id, slug)
  } catch (err) {
    console.error(`[PlayerPage] live NBA fallback failed for "${slug}":`, err)
    return null
  }
}

/** Best-effort live NHL fallback — any failure here should never take down the page. */
async function tryLiveNhlFallback(slug: string): Promise<PlayerRow | null> {
  try {
    const liveMatch = await findNhlPlayerIdBySlug(slug)
    if (!liveMatch) return null
    return await buildLiveNhlPlayerRow(liveMatch.id, slug)
  } catch (err) {
    console.error(`[PlayerPage] live NHL fallback failed for "${slug}":`, err)
    return null
  }
}

/** College football player from this season's box scores — any failure falls through to "coming soon". */
async function tryCfbProfile(slug: string, team?: string): Promise<CfbPlayerProfile | null> {
  try {
    const ref = findCfbPlayerBySlug(slug, team)
    return ref ? await buildCfbPlayerProfile(ref, slug) : null
  } catch (err) {
    console.error(`[PlayerPage] CFB profile failed for "${slug}":`, err)
    return null
  }
}

/** College basketball player from ESPN game logs (last season's before tip-off). */
async function tryCbbProfile(slug: string, team?: string): Promise<CbbPlayerProfile | null> {
  try {
    const ref = await findCbbPlayerBySlug(slug, team)
    return ref ? await buildCbbPlayerProfile(ref, slug) : null
  } catch (err) {
    console.error(`[PlayerPage] CBB profile failed for "${slug}":`, err)
    return null
  }
}

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: { slug: string }
  searchParams: { team?: string; sport?: string }
}) {
  let player: PlayerRow | null = null
  let cfb: CfbPlayerProfile | null = null
  let cbb: CbbPlayerProfile | null = null
  let nflLive: NflPlayerProfile | null = null

  // Links from college pages carry ?sport=cfb so a college player isn't confused with a pro of the same name.
  if (searchParams.sport === 'cfb') cfb = await tryCfbProfile(params.slug, searchParams.team)
  if (searchParams.sport === 'cbb') cbb = await tryCbbProfile(params.slug, searchParams.team)

  try {
    if (cfb) player = cfb.row
    else if (cbb) player = cbb.row
    else player = await getPlayerBySlug(params.slug)
    if (!player) {
      player = await tryLiveMlbFallback(params.slug)
    }
    if (!player) {
      player = await tryLiveNbaFallback(params.slug)
    }
    if (!player) {
      player = await tryLiveNhlFallback(params.slug)
    }
    if (!player) {
      try {
        nflLive = await buildNflPlayerProfile(params.slug, searchParams.team)
      } catch (err) {
        console.error(`[PlayerPage] live NFL fallback failed for "${params.slug}":`, err)
      }
      player = nflLive?.row ?? null
    }
    if (!player) {
      cfb = await tryCfbProfile(params.slug, searchParams.team)
      player = cfb?.row ?? null
    }
    if (!player) {
      cbb = await tryCbbProfile(params.slug, searchParams.team)
      player = cbb?.row ?? null
    }
  } catch (err) {
    console.error(`[PlayerPage] failed to load "${params.slug}":`, err)
    player = null
  }

  if (!player) {
    return (
      <AppShell>
        <PlayerComingSoon slug={params.slug} team={searchParams.team} />
      </AppShell>
    )
  }

  const teamColor = cfb?.teamColor ?? cbb?.teamColor ??
    (player.sport === 'mlb'
      ? MLB_TEAM_COLORS
      : player.sport === 'nba'
        ? NBA_TEAM_COLORS
        : player.sport === 'nhl'
          ? NHL_TEAM_COLORS
          : NFL_TEAM_COLORS)[player.team] ?? '#4d9fff'

  let bettingPlayerId: number | null = null
  const bettingGroup: 'hitting' | 'pitching' = player.position === 'P' ? 'pitching' : 'hitting'
  const isNhlGoalie = player.sport === 'nhl' && player.position.toUpperCase() === 'G'

  if (player.sport === 'mlb') {
    try {
      const mlbMatch = await findMlbPlayerIdBySlug(params.slug)
      bettingPlayerId = mlbMatch?.id ?? null
      if (bettingPlayerId) {
        const best = await getBestProp(bettingPlayerId, bettingGroup)
        if (best) player.tonight_edge = toTonightEdge(best)
      }
    } catch (err) {
      console.error(`[PlayerPage] betting-stats lookup failed for "${params.slug}":`, err)
    }
  } else if (player.sport === 'nba') {
    try {
      const nbaMatch = await findNbaPlayerIdBySlug(params.slug)
      bettingPlayerId = nbaMatch?.id ?? null
      if (bettingPlayerId) {
        const best = await getBestNbaProp(bettingPlayerId)
        if (best) player.tonight_edge = toNbaTonightEdge(best)
      }
    } catch (err) {
      console.error(`[PlayerPage] NBA betting-stats lookup failed for "${params.slug}":`, err)
    }
  } else if (player.sport === 'nhl') {
    try {
      const nhlMatch = await findNhlPlayerIdBySlug(params.slug)
      bettingPlayerId = nhlMatch?.id ?? null
      if (bettingPlayerId) {
        const best = await getBestNhlProp(bettingPlayerId)
        if (best) player.tonight_edge = toNhlTonightEdge(best)
      }
    } catch (err) {
      console.error(`[PlayerPage] NHL betting-stats lookup failed for "${params.slug}":`, err)
    }
  }

  // NFL props: the ESPN id comes from this season's box-score rows, so the prop record can use ESPN game logs.
  let nflProp: { id: string; sub: NflBettingSub } | null = nflLive?.propSub ? { id: nflLive.espnId, sub: nflLive.propSub } : null
  if (player.sport === 'nfl' && !nflProp) {
    try {
      const found = await findNflPlayerId(params.slug, searchParams.team ?? player.team)
      if (found && isNflBettingSub(found.position)) nflProp = { id: found.id, sub: found.position }
    } catch (err) {
      console.error(`[PlayerPage] NFL prop lookup failed for "${params.slug}":`, err)
    }
  }

  const careerParams: CareerParams | undefined =
    player.sport === 'mlb' && bettingPlayerId !== null
      ? { sport: 'mlb', playerId: String(bettingPlayerId), group: bettingGroup }
      : player.sport === 'nba' && bettingPlayerId !== null
        ? { sport: 'nba', playerId: String(bettingPlayerId) }
        : player.sport === 'nhl' && bettingPlayerId !== null
          ? { sport: 'nhl', playerId: String(bettingPlayerId), goalie: isNhlGoalie }
          : nflProp
            ? { sport: 'nfl', playerId: nflProp.id }
            : undefined

  const te = player.tonight_edge
  if (te?.prop) {
    try {
      const c = await getPlayerConviction({ sport: player.sport, name: player.name, team: player.team, category: te.prop.category, thresholds: [te.prop.threshold], pitching: bettingGroup === 'pitching' })
      te.conviction = c.available && c.thresholds[0] ? { matchup: c.matchup, href: c.href, row: c.thresholds[0] } : { unavailable: c.reason ?? 'Analysis unavailable' }
    } catch (err) {
      console.error(`[PlayerPage] conviction lookup failed for "${params.slug}":`, err)
    }
  }

  const convictionPlayer = { name: player.name, team: player.team }
  const hasTonightEdge = Object.keys(player.tonight_edge ?? {}).length > 0
  const hasRecentForm = (player.recent_form ?? []).length > 0
  const hasPropRecords = bettingPlayerId !== null
  const hasMatchupSplits =
    (player.best_opponents ?? []).length > 0 ||
    (player.worst_opponents ?? []).length > 0 ||
    (player.best_venues ?? []).length > 0 ||
    (player.worst_venues ?? []).length > 0
  const hasCareerVsTonight = Object.keys(player.career_vs_opponents ?? {}).length > 0

  return (
    <AppShell>
      <div className="flex flex-col gap-3 px-3.5 pt-1 md:gap-4 md:px-0 md:pt-0">
        <PlayerHeader player={player} teamColor={teamColor} />

        {hasTonightEdge && <TonightEdgeCard edge={player.tonight_edge} career={careerParams} />}

        {cfb && <CfbSeasonStats stats={player.season_stats} games={cfb.games.length} />}
        {cbb && <CfbSeasonStats stats={player.season_stats} games={cbb.games.length} label={`${cbb.seasonLabel} SEASON`} />}

        {hasRecentForm && (
          <RecentFormTable games={player.recent_form} sport={player.sport} position={player.position} />
        )}

        {cbb && <CfbPropCalculator categories={cbb.categories} games={cbb.games} color={cbb.teamColor} league="cbb" caption={`Hit rates from the ${cbb.seasonLabel} game logs`} player={convictionPlayer} />}

        {nflProp && <NflPropBettingRecord playerId={nflProp.id} sub={nflProp.sub} player={convictionPlayer} />}

        {cfb && cfb.categories.length > 0 && <CfbPropCalculator categories={cfb.categories} games={cfb.games} color={cfb.teamColor} player={convictionPlayer} />}

        {hasPropRecords && bettingPlayerId !== null && player.sport === 'nba' && (
          <NbaPropBettingRecord playerId={bettingPlayerId} player={convictionPlayer} />
        )}

        {hasPropRecords && bettingPlayerId !== null && player.sport === 'nhl' && (
          <NhlPropBettingRecord playerId={bettingPlayerId} isGoalie={isNhlGoalie} player={convictionPlayer} />
        )}

        {hasPropRecords && bettingPlayerId !== null && player.sport === 'mlb' && (
          <PropBettingRecord playerId={bettingPlayerId} group={bettingGroup} player={convictionPlayer} />
        )}

        {hasMatchupSplits && (
          <MatchupSplits
            bestOpponents={player.best_opponents ?? []}
            worstOpponents={player.worst_opponents ?? []}
            bestVenues={player.best_venues ?? []}
            worstVenues={player.worst_venues ?? []}
          />
        )}

        {hasCareerVsTonight && <CareerVsTonight data={player.career_vs_opponents} />}
      </div>
    </AppShell>
  )
}
