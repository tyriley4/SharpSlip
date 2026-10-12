import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { TeamPageClient } from '@/components/teams/page/TeamPageClient'
import { TeamCircle } from '@/components/standings/board/TeamRow'
import { MLB_TEAM_COLORS } from '@/data/mlb/teamColors'
import { NBA_TEAM_COLORS } from '@/data/nba/teamColors'
import { NFL_TEAM_COLORS } from '@/data/nfl/teamColors'
import { NHL_TEAM_COLORS } from '@/data/nhl/teamColors'
import { findCollegeTeam } from '@/lib/college/directory'
import { getMlbTeamsIndex } from '@/lib/mlb/teams'
import { NBA_TEAM_NAMES } from '@/lib/nba/divisions'
import { NFL_TEAM_NAMES } from '@/lib/nfl/divisions'
import { NHL_TEAM_NAMES } from '@/lib/nhl/divisions'
import { SPORT_META } from '@/lib/sport/meta'
import type { Sport } from '@/lib/sport/SportContext'
import { getTeamPage } from '@/lib/teams/page'

export const revalidate = 3600

const COLORS: Record<Sport, Record<string, string>> = { mlb: MLB_TEAM_COLORS, nfl: NFL_TEAM_COLORS, cfb: {}, nba: NBA_TEAM_COLORS, cbb: {}, nhl: NHL_TEAM_COLORS }

async function teamName(sport: Sport, abbr: string): Promise<string | null> {
  if (sport === 'nfl') return NFL_TEAM_NAMES[abbr] ?? null
  if (sport === 'nba') return NBA_TEAM_NAMES[abbr] ?? null
  if (sport === 'nhl') return NHL_TEAM_NAMES[abbr] ?? null
  if (sport === 'cfb' || sport === 'cbb') return (await findCollegeTeam(sport, abbr))?.name ?? null
  const index = await getMlbTeamsIndex()
  for (const t of Array.from(index?.values() ?? [])) if (t.abbr === abbr) return t.name
  return MLB_TEAM_COLORS[abbr] ? abbr : null
}

export default async function TeamPage({ params }: { params: { sport: string; abbr: string } }) {
  const sportMeta = SPORT_META[params.sport as Sport]
  if (!sportMeta) notFound()
  const sport = sportMeta.id
  const abbr = decodeURIComponent(params.abbr).toUpperCase()

  const data = await getTeamPage(sport, abbr)
  if (data) return <TeamPageClient data={data} />

  // The team exists but its data couldn't be loaded: say so instead of showing a blank or broken page.
  const name = await teamName(sport, abbr)
  if (!name) notFound()
  const college = sport === 'cfb' || sport === 'cbb' ? await findCollegeTeam(sport, abbr) : null
  const color = college?.color ?? COLORS[sport][abbr] ?? '#3B9EFF'

  return (
    <AppShell>
      <div className="px-3.5 pt-3 md:px-0 md:pt-0">
        <div className="rounded-2xl border border-border p-6 text-center md:p-10" style={{ background: `linear-gradient(135deg, ${color}1F 0%, #111318 65%)`, borderLeft: `3px solid ${color}` }}>
          <div className="mb-4 flex justify-center">
            <TeamCircle abbr={abbr} color={color} size={64} />
          </div>
          <div className="text-xl font-black text-text">{name}</div>
          <div className="mt-1 text-[11px] font-bold tracking-wide text-muted">
            {sportMeta.icon} {sportMeta.label}
          </div>
          <div className="mt-5 text-sm font-extrabold text-text">Team data is temporarily unavailable</div>
          <p className="mx-auto mt-1.5 max-w-[340px] text-xs leading-relaxed text-muted">We couldn&apos;t reach the {sportMeta.label} data source just now. Try again in a moment.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/standings" className="rounded-full border border-accent/40 bg-accent/15 px-4 py-2 text-[11px] font-bold text-accent hover:bg-accent/25">
              View standings
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
