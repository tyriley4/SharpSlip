import Link from 'next/link'
import { BetCard } from '@/components/breakdown/BetCard'
import { Drawer } from '@/components/ui/Drawer'
import { useAccountData } from '@/lib/account/AccountDataContext'
import type { TodayBet } from '@/lib/edges/todaysBets'
import { filterBestBets } from '@/lib/home/bestBets'
import { sportMeta } from '@/lib/sport/meta'

/** Every graded bet from today matching the user preferences, organised by grade and then sport. */
export function BestBetsDrawer({ bets, onClose }: { bets: TodayBet[]; onClose: () => void }) {
  const { settings } = useAccountData()
  const { results, personalized, grades } = filterBestBets(bets, settings)

  const sections = grades
    .map((grade) => ({
      grade,
      sports: Array.from(new Set(results.filter((r) => r.bet.grade === grade).map((r) => r.bet.sport))).map((sport) => ({ sport, items: results.filter((r) => r.bet.grade === grade && r.bet.sport === sport) })),
    }))
    .filter((s) => s.sports.length > 0)

  return (
    <Drawer title="Best Bets for You" subtitle={`Grade ${grades.join(', ')} bets from today's games`} onClose={onClose}>
      {!personalized && (
        <div className="mb-3 rounded-xl border border-accent/25 bg-accent/[0.06] p-3 text-[11px] leading-relaxed text-text2">
          Set your preferences in{' '}
          <Link href="/account" className="font-semibold text-accent" onClick={onClose}>
            Account → Settings
          </Link>{' '}
          to choose your risk tolerance and bet types.
        </div>
      )}

      {sections.length === 0 ? (
        <div className="rounded-[14px] border border-border bg-card3 py-10 text-center text-xs text-muted">No graded bets match your preferences today — check back later or adjust your settings.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {sections.map(({ grade, sports }) => (
            <div key={grade} className="flex flex-col gap-3">
              <div className="text-[11px] font-extrabold tracking-[0.08em] text-muted">GRADE {grade}</div>
              {sports.map(({ sport, items }) => (
                <div key={sport} className="flex flex-col gap-2">
                  <div className="text-[10px] font-bold text-text2">
                    {sportMeta(sport).icon} {sportMeta(sport).label}
                  </div>
                  {items.map((r) => (
                    <div key={r.bet.id} className="flex flex-col gap-1">
                      <BetCard bet={r.bet} showMatchup />
                      <Link href={r.href} onClick={onClose} className="pl-1 text-[10px] font-semibold text-accent hover:underline">
                        View full breakdown →
                      </Link>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Drawer>
  )
}
