import { getCfbTeamSeason } from '@/lib/cfb/engine'
import { atsRecord } from '@/lib/cfb/tabs'
import { getCollegeDirectory } from '@/lib/college/directory'
import { getRankings } from '@/lib/espn/api'
import { getLeagueData } from '@/lib/football/league'
import { sportMeta } from '@/lib/sport/meta'
import { mapWithConcurrency } from '@/lib/utils/concurrency'
import type { TickerItem } from './ticker'

const color = sportMeta('cfb').color
const item = (id: string, text: string, linkTo: string): TickerItem => ({ id, text, sport: 'cfb', type: 'trend', linkTo, sportColor: color })

/** Betting trends for ranked teams and 300-yard passers, from ESPN closing lines and box scores (real results only). */
export async function cfbTrendItems(): Promise<TickerItem[]> {
  const [polls, dir] = await Promise.all([getRankings('football', 'college-football').catch(() => null), getCollegeDirectory('cfb').catch(() => null)])
  const ap = polls?.find((p) => /AP Top 25/i.test(p.name))
  const out: TickerItem[] = []

  const teams = (ap?.ranks ?? []).slice(0, 25)
  const perTeam = await mapWithConcurrency(teams, 5, async (r): Promise<TickerItem[]> => {
    const t = dir?.byId.get(r.teamId)
    if (!t) return []
    const s = await getCfbTeamSeason(r.teamId, t.abbr).catch(() => null)
    if (!s || s.boxes.length < 4) return []
    const href = `/teams/cfb/${t.abbr}`
    const items: TickerItem[] = []

    const last7 = s.boxes.slice(-7)
    const ats = atsRecord(last7)
    if (ats.total >= 4 && ats.w >= ats.total - 1 && ats.w >= 4) items.push(item(`cfb-ats-${t.abbr}`, `#${r.rank} ${t.shortName} covered ${ats.w} of last ${ats.total}`, href))

    const withTotal = s.boxes.slice(-10).filter((b) => b.line && b.line.total !== null)
    if (withTotal.length >= 4) {
      const overs = withTotal.filter((b) => b.us + b.them > (b.line!.total as number)).length
      const unders = withTotal.filter((b) => b.us + b.them < (b.line!.total as number)).length
      if (overs >= withTotal.length - 1 && overs >= 4) items.push(item(`cfb-over-${t.abbr}`, `Over has hit in ${overs} of ${t.shortName}'s last ${withTotal.length}`, href))
      else if (unders >= withTotal.length - 1 && unders >= 4) items.push(item(`cfb-under-${t.abbr}`, `Under has hit in ${unders} of ${t.shortName}'s last ${withTotal.length}`, href))
    }
    return items
  })
  out.push(...perTeam.flatMap((x) => x ?? []))

  // Passers with a current run of big days.
  const rows = getLeagueData('college-football').rows
  const byPlayer = new Map<string, typeof rows>()
  for (const r of rows) if ((r.att ?? 0) >= 10) byPlayer.set(r.playerId, [...(byPlayer.get(r.playerId) ?? []), r])
  const qb: TickerItem[] = []
  byPlayer.forEach((games) => {
    const sorted = [...games].sort((a, b) => b.date.localeCompare(a.date))
    let best: { t: number; n: number } | null = null
    for (const t of [250, 300, 350]) {
      let n = 0
      for (const g of sorted) {
        if ((g.pyds ?? 0) >= t) n++
        else break
      }
      if (n >= 3 && (!best || n > best.n || (n === best.n && t > best.t))) best = { t, n }
    }
    if (best) qb.push(item(`cfb-qb-${sorted[0].playerId}`, `${sorted[0].name} ${best.t}+ Pass Yds in ${best.n} straight`, `/players/${sorted[0].name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}?team=${sorted[0].team}&sport=cfb`))
  })
  out.push(...qb.slice(0, 4))
  return out.slice(0, 10)
}
