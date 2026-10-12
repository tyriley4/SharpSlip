import { readableTeamColor } from '@/components/leaders/board/theme'
import Link from 'next/link'
import { TrackOnMount } from '@/components/analytics/TrackOnMount'
import { Sidebar } from '@/components/layout/Sidebar'
import { TeamLink } from '@/components/teams/TeamLink'
import type { Sport } from '@/lib/sport/SportContext'

export interface BreakdownTab {
  id: string
  icon: string
}

export function BreakdownShell({
  sport,
  backHref,
  awayAbbr,
  homeAbbr,
  awayColor,
  homeColor,
  awayRank,
  homeRank,
  statusLine,
  badge,
  rightTop,
  rightBottom,
  tabs,
  activeTab,
  onChangeTab,
  children,
}: {
  /** When provided, the team abbreviations in the header link to their team pages. */
  sport?: Sport
  backHref: string
  awayAbbr: string
  homeAbbr: string
  awayColor: string
  homeColor: string
  /** College rankings, shown as a small "#3" before the abbreviation. */
  awayRank?: number | null
  homeRank?: number | null
  statusLine: string
  badge?: { text: string; tone: 'live' | 'final' }
  rightTop: string
  rightBottom: string
  tabs: BreakdownTab[]
  activeTab: string
  onChangeTab: (id: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] bg-background">
      <TrackOnMount event="game_breakdown_opened" gameFromPath properties={{ ...(sport ? { sport } : {}), teamHome: homeAbbr, teamAway: awayAbbr }} />
      <Sidebar />
      <div className="flex h-screen min-w-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-border bg-card p-3.5 md:px-8 md:pt-6">
          <div className="mb-2 flex items-center gap-3 md:mb-4 md:gap-4">
            <Link
              href={backHref}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-border bg-card3 text-base text-text2 transition-colors hover:border-border2 hover:text-text md:h-9 md:w-9"
            >
              ←
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 md:gap-2.5">
                <span className="text-[15px] font-black md:text-[26px]" style={{ color: readableTeamColor(awayColor) }}>
                  {awayRank ? <span className="mr-1 align-middle text-[9px] font-extrabold text-muted md:text-sm">#{awayRank}</span> : null}
                  {sport ? (
                    <TeamLink sport={sport} abbr={awayAbbr} className="hover:underline">
                      {awayAbbr}
                    </TeamLink>
                  ) : (
                    awayAbbr
                  )}
                </span>
                <span className="text-[11px] text-muted md:text-sm">@</span>
                <span className="text-[15px] font-black md:text-[26px]" style={{ color: readableTeamColor(homeColor) }}>
                  {homeRank ? <span className="mr-1 align-middle text-[9px] font-extrabold text-muted md:text-sm">#{homeRank}</span> : null}
                  {sport ? (
                    <TeamLink sport={sport} abbr={homeAbbr} className="hover:underline">
                      {homeAbbr}
                    </TeamLink>
                  ) : (
                    homeAbbr
                  )}
                </span>
                {badge && (
                  <span
                    className={`ml-1 shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold tracking-[0.08em] md:text-[10px] ${
                      badge.tone === 'live'
                        ? 'animate-pulse bg-negative/20 text-negative'
                        : 'bg-card3 text-muted'
                    }`}
                  >
                    {badge.text}
                  </span>
                )}
                <span className="ml-1 truncate text-[10px] text-muted md:ml-2 md:text-sm">{statusLine}</span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-extrabold text-text2 md:text-xl md:font-black md:text-text">{rightTop}</div>
              <div className="text-[9px] text-muted md:mt-0.5 md:text-[11px]">{rightBottom}</div>
            </div>
          </div>
          <div className="flex gap-0 overflow-x-auto border-t border-border pt-2 [scrollbar-width:none] md:gap-1.5 md:pt-3 [&::-webkit-scrollbar]:hidden">
            {tabs.map((t) => {
              const active = activeTab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => onChangeTab(t.id)}
                  className={`flex shrink-0 items-center gap-1 whitespace-nowrap border-b-2 px-2.5 py-1 text-[11px] transition-colors md:rounded-t-lg md:px-4 md:py-2 md:text-[13px] ${
                    active
                      ? 'border-accent font-bold text-text md:bg-card3'
                      : 'border-transparent font-medium text-muted hover:text-text2 md:hover:bg-card3/60'
                  }`}
                >
                  <span className="text-xs">{t.icon}</span>
                  <span>{t.id}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto pb-6 md:pb-10">{children}</div>
      </div>
    </div>
  )
}
