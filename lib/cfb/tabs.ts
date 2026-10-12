import { getNFLWeather } from '@/lib/nfl/stadiumBreakdown'
import { getTeamInfo, getTeamSchedule, getTeamRoster } from '@/lib/espn/api'
import type { TeamGameBox } from '@/lib/football/box'
import { hitRatesForThresholds } from '@/lib/nfl/bettingStats'
import type { NFLDefenseTeamStats, NFLQBStats, NFLTopDefender } from '@/lib/nfl/gameBreakdown'
import type { NFLDefenseBetting, NFLDefenseLastGameRow, NFLDefenseRanks, NFLDefenseTabData, NFLKeyMatchup } from '@/lib/nfl/defenseBreakdown'
import type { NFLPassingTabQB, NFLQBBetting } from '@/lib/nfl/passingBreakdown'
import type { NFLReceivingPlayerCard, NFLReceivingTabData } from '@/lib/nfl/receivingBreakdown'
import type { NFLRushPlayerCard, NFLRushingTabData } from '@/lib/nfl/rushingBreakdown'
import type { NFLBettingLine, NFLLastGameRow, NFLSummaryTabData, NFLTeamBettingSummary, NFLTeamSummaryCard } from '@/lib/nfl/summaryBreakdown'
import type { NFLTrend } from '@/lib/nfl/trendsEngine'
import { impactNotes, type ImpactNote } from '@/lib/weather/api'
import type { NFLWeatherInfo } from '@/lib/nfl/stadiumBreakdown'
import {
  CFB_LEAGUE,
  getCfbMatchup,
  getCfbNationalRanks,
  getCfbTeamSeason,
  ncaaRating,
  pickStarterQB,
  qbSeason,
  r1,
  STADIUM_CAPACITY,
  teamSkillPlayers,
  type CfbMatchup,
  type CfbTeamSeason,
} from './engine'

const n = (v: string | undefined): number => {
  const x = Number(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(x) ? x : 0
}
const pct1 = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0)

export const CFB_PASS_YDS_THRESHOLDS = [199.5, 224.5, 249.5, 274.5, 299.5]
export const CFB_PASS_TD_THRESHOLDS = [0.5, 1.5, 2.5]
export const CFB_INT_THRESHOLDS = [0.5, 1.5]
export const CFB_COMP_THRESHOLDS = [14.5, 19.5, 24.5]
export const CFB_RUSH_YDS_THRESHOLDS = [49.5, 74.5, 99.5, 124.5]
export const CFB_RUSH_REC_THRESHOLDS = [1.5, 2.5, 3.5]
export const CFB_REC_YDS_THRESHOLDS = [29.5, 49.5, 74.5, 99.5]
export const CFB_REC_THRESHOLDS = [1.5, 2.5, 3.5, 4.5]

interface Side {
  matchup: CfbMatchup
  teamId: string
  abbr: string
  oppId: string
  oppAbbr: string
  season: CfbTeamSeason
}

async function side(gameId: string, team: 'away' | 'home'): Promise<Side | null> {
  const matchup = await getCfbMatchup(gameId)
  if (!matchup) return null
  const me = team === 'away' ? matchup.away : matchup.home
  const opp = team === 'away' ? matchup.home : matchup.away
  const season = await getCfbTeamSeason(me.id, me.abbr, matchup.season)
  return { matchup, teamId: me.id, abbr: me.abbr, oppId: opp.id, oppAbbr: opp.abbr, season }
}

type Row = Record<string, string>

const asRows = (boxes: TeamGameBox[], f: (b: TeamGameBox) => Row | null): Row[] => boxes.map(f).filter((r): r is Row => r !== null)

// ---------------------------------------------------------------------------
// Passing
// ---------------------------------------------------------------------------

export async function getCfbPassingTabData(gameId: string, team: 'away' | 'home'): Promise<NFLPassingTabQB | null> {
  const s = await side(gameId, team)
  if (!s) return null
  const q = pickStarterQB(s.season.boxes)
  const stats: NFLQBStats | null = q ? qbSeason(s.season.boxes, q.id, s.abbr) : null
  if (!stats) return { stats: null, advanced: null, betting: null, homeAway: { home: null, away: null } }

  const rows = asRows(s.season.boxes, (b) => {
    const p = b.passing.find((x) => x.id === stats.playerId)
    return p && p.att > 0 ? { completions: String(p.comp), passing_yards: String(p.yds), passing_tds: String(p.td), interceptions: String(p.int) } : null
  })
  const betting: NFLQBBetting = {
    passYds: hitRatesForThresholds(rows, 'passing_yards', CFB_PASS_YDS_THRESHOLDS),
    tds: hitRatesForThresholds(rows, 'passing_tds', CFB_PASS_TD_THRESHOLDS),
    ints: hitRatesForThresholds(rows, 'interceptions', CFB_INT_THRESHOLDS),
    completions: hitRatesForThresholds(rows, 'completions', CFB_COMP_THRESHOLDS),
    gamesPlayed: rows.length,
  }
  const split = (home: boolean) => {
    const g = s.season.boxes.filter((b) => b.home === home && b.passing.some((x) => x.id === stats.playerId && x.att > 0))
    if (g.length === 0) return null
    const yds = g.reduce((t, b) => t + (b.passing.find((x) => x.id === stats.playerId)?.yds ?? 0), 0) / g.length
    return { yds: r1(yds), rating: null }
  }
  return { stats, advanced: null, betting, homeAway: { home: split(true), away: split(false) } }
}

// ---------------------------------------------------------------------------
// Rushing / receiving
// ---------------------------------------------------------------------------

function anytimeTdRows(boxes: TeamGameBox[], id: string): Row[] {
  return asRows(boxes, (b) => {
    const ru = b.rushing.find((x) => x.id === id)
    const re = b.receiving.find((x) => x.id === id)
    return ru || re ? { anytime_td: String((ru?.td ?? 0) + (re?.td ?? 0)) } : null
  })
}

export async function getCfbRushingTabData(gameId: string, team: 'away' | 'home'): Promise<NFLRushingTabData | null> {
  const s = await side(gameId, team)
  if (!s) return null
  const [rbs, ranks] = await Promise.all([teamSkillPlayers(s.season.boxes, s.teamId, s.abbr, 'RB'), getCfbNationalRanks(s.teamId)])
  const att = s.season.boxes.reduce((t, b) => t + b.rushing.reduce((a, r) => a + r.car, 0), 0)
  const yds = s.season.boxes.reduce((t, b) => t + b.rushing.reduce((a, r) => a + r.yds, 0), 0)
  const tds = s.season.boxes.reduce((t, b) => t + b.rushing.reduce((a, r) => a + r.td, 0), 0)

  const cards: NFLRushPlayerCard[] = rbs.slice(0, 2).map((player) => ({ player, advanced: null, betting: rushBetting(s.season.boxes, player.playerId) }))

  // The quarterback's legs matter in college: include him when he carries enough.
  const qb = pickStarterQB(s.season.boxes)
  if (qb) {
    const car = s.season.boxes.reduce((t, b) => t + (b.rushing.find((r) => r.id === qb.id)?.car ?? 0), 0)
    if (car >= 15) {
      const qbStats = qbSeason(s.season.boxes, qb.id, s.abbr)
      const rushYds = s.season.boxes.reduce((t, b) => t + (b.rushing.find((r) => r.id === qb.id)?.yds ?? 0), 0)
      const rushTd = s.season.boxes.reduce((t, b) => t + (b.rushing.find((r) => r.id === qb.id)?.td ?? 0), 0)
      cards.push({
        player: {
          playerId: qb.id,
          name: qb.name,
          position: 'QB',
          team: s.abbr,
          season: { att: car, rushYds, rushTd, ypc: car > 0 ? r1(rushYds / car) : 0, targets: 0, rec: 0, recYds: 0, recTd: 0, targetShare: 0, airYardsShare: 0 },
          last5: [...s.season.boxes].reverse().slice(0, 5).map((b) => {
            const r = b.rushing.find((x) => x.id === qb.id)
            return { week: b.week ?? 0, opp: b.oppAbbr, att: r?.car ?? 0, rushYds: r?.yds ?? 0, rushTd: r?.td ?? 0, targets: 0, rec: 0, recYds: 0, recTd: 0 }
          }),
        },
        advanced: null,
        betting: rushBetting(s.season.boxes, qb.id),
      })
      void qbStats
    }
  }

  return { teamSummary: att > 0 ? { att, yds, ypc: r1(yds / att), tds, rankByYds: ranks?.rushYpg?.rank ?? 0 } : null, players: cards }
}

function rushBetting(boxes: TeamGameBox[], id: string): NFLRushPlayerCard['betting'] {
  const rows = asRows(boxes, (b) => {
    const r = b.rushing.find((x) => x.id === id)
    const rc = b.receiving.find((x) => x.id === id)
    return r || rc ? { rushing_yards: String(r?.yds ?? 0), receptions: String(rc?.rec ?? 0) } : null
  })
  return {
    rushYds: hitRatesForThresholds(rows, 'rushing_yards', CFB_RUSH_YDS_THRESHOLDS),
    anytimeTd: hitRatesForThresholds(anytimeTdRows(boxes, id), 'anytime_td', [0.5]),
    receptions: hitRatesForThresholds(rows, 'receptions', CFB_RUSH_REC_THRESHOLDS),
  }
}

export async function getCfbReceivingTabData(gameId: string, team: 'away' | 'home'): Promise<NFLReceivingTabData | null> {
  const s = await side(gameId, team)
  if (!s) return null
  const [wrs, tes, ranks] = await Promise.all([
    teamSkillPlayers(s.season.boxes, s.teamId, s.abbr, 'WR'),
    teamSkillPlayers(s.season.boxes, s.teamId, s.abbr, 'TE'),
    getCfbNationalRanks(s.teamId),
  ])
  // Top three receivers overall, regardless of WR/TE label.
  const candidates = [...wrs, ...tes].sort((a, b) => b.season.recYds - a.season.recYds).slice(0, 3)
  const players: NFLReceivingPlayerCard[] = candidates.map((player) => {
    const rows = asRows(s.season.boxes, (b) => {
      const re = b.receiving.find((x) => x.id === player.playerId)
      return re ? { receiving_yards: String(re.yds), receptions: String(re.rec) } : null
    })
    return {
      player,
      advanced: null,
      betting: {
        recYds: hitRatesForThresholds(rows, 'receiving_yards', CFB_REC_YDS_THRESHOLDS),
        receptions: hitRatesForThresholds(rows, 'receptions', CFB_REC_THRESHOLDS),
        anytimeTd: hitRatesForThresholds(anytimeTdRows(s.season.boxes, player.playerId), 'anytime_td', [0.5]),
      },
    }
  })
  const rec = s.season.boxes.reduce((t, b) => t + b.receiving.reduce((a, r) => a + r.rec, 0), 0)
  const yds = s.season.boxes.reduce((t, b) => t + b.receiving.reduce((a, r) => a + r.yds, 0), 0)
  // College box scores have no target counts; the "targets" slot carries completions (receptions) so the summary still reads.
  return { teamSummary: rec > 0 ? { targets: rec, rec, yds, rankByTargets: ranks?.passYpg?.rank ?? 0 } : null, players }
}

// ---------------------------------------------------------------------------
// Defense
// ---------------------------------------------------------------------------

export interface CfbDefenseTabData extends NFLDefenseTabData {
  vsRanked: { w: number; l: number; papg: number | null; games: number }
  nationalOf: number | null
}

export async function getCfbDefenseTabData(gameId: string, team: 'away' | 'home'): Promise<CfbDefenseTabData | null> {
  const s = await side(gameId, team)
  if (!s) return null
  const boxes = s.season.boxes
  const season = s.season
  const [ranksNat, roster] = await Promise.all([getCfbNationalRanks(s.teamId), getTeamRoster('football', CFB_LEAGUE, s.teamId).catch(() => null)])
  const posOf = new Map((roster?.players ?? []).map((p) => [p.id, p.position]))

  const stats: NFLDefenseTeamStats | null =
    season.games > 0
      ? {
          abbr: s.abbr,
          pointsAllowedPerGame: season.papg,
          passYdsAllowedPerGame: season.passAllowedYpg,
          rushYdsAllowedPerGame: season.rushAllowedYpg,
          sacks: season.sacks,
          interceptions: season.interceptions,
          tackles: season.tackles,
          passesDefended: season.passesDefended,
          forcedFumbles: boxes.reduce((t, b) => t + n(b.opp.fumblesLost), 0),
          tacklesForLoss: season.tacklesForLoss,
          turnoversForcedPerGame: season.turnoversForcedPerGame,
        }
      : null

  const rank = (r: { value: number; rank: number } | null | undefined, fallback: number) => (r ? { value: fallback, rank: r.rank } : null)
  const ranks: NFLDefenseRanks | null = stats
    ? {
        pointsAllowedPerGame: rank(ranksNat?.pointsAllowedPerGame, stats.pointsAllowedPerGame),
        passYdsAllowedPerGame: rank(ranksNat?.passAllowedYpg, stats.passYdsAllowedPerGame),
        rushYdsAllowedPerGame: rank(ranksNat?.rushAllowedYpg, stats.rushYdsAllowedPerGame),
        sacks: { value: stats.sacks, rank: ranksNat?.sacks?.rank ?? 0 },
        turnoversForced: { value: stats.turnoversForcedPerGame, rank: 0 },
        interceptions: { value: stats.interceptions, rank: ranksNat?.interceptions?.rank ?? 0 },
        tacklesForLoss: { value: stats.tacklesForLoss, rank: 0 },
      }
    : null

  const last5: NFLDefenseLastGameRow[] = [...boxes].reverse().slice(0, 5).map((b) => ({
    week: b.week ?? 0,
    opp: b.oppAbbr,
    ptsAllowed: b.them,
    passYdsAllowed: n(b.opp.netPassingYards),
    rushYdsAllowed: n(b.opp.rushingYards),
    sacks: b.defense.reduce((t, d) => t + d.sacks, 0),
    turnovers: n(b.opp.turnovers),
  }))

  // Key matchup: the opponent's quarterback against this secondary.
  let keyMatchup: NFLKeyMatchup | null = null
  const oppSeason = await getCfbTeamSeason(s.oppId, s.oppAbbr, s.matchup.season)
  const oq = pickStarterQB(oppSeason.boxes)
  const oqStats = oq ? qbSeason(oppSeason.boxes, oq.id, s.oppAbbr) : null
  if (oqStats && oqStats.season.rating >= 160 && season.passAllowedYpg >= 230) {
    keyMatchup = { title: 'Passing Attack vs Vulnerable Secondary', detail: `${oqStats.name} carries a ${oqStats.season.rating.toFixed(1)} passer efficiency into a ${s.abbr} defense allowing ${season.passAllowedYpg.toFixed(1)} pass yards per game.` }
  }

  const defenders = new Map<string, { name: string; sacks: number; ints: number; tfl: number; tot: number }>()
  for (const b of boxes) {
    for (const d of b.defense) {
      const c = defenders.get(d.id) ?? { name: d.name, sacks: 0, ints: 0, tfl: 0, tot: 0 }
      c.sacks += d.sacks; c.tfl += d.tfl; c.tot += d.tot
      defenders.set(d.id, c)
    }
    for (const i of b.interceptions) {
      const c = defenders.get(i.id) ?? { name: i.name, sacks: 0, ints: 0, tfl: 0, tot: 0 }
      c.ints += i.int
      defenders.set(i.id, c)
    }
  }
  const topDefenders: NFLTopDefender[] = Array.from(defenders.entries())
    .map(([id, d]) => ({ name: d.name, position: posOf.get(id) ?? '', sacks: d.sacks, interceptions: d.ints, score: d.sacks * 2 + d.ints * 3 + d.tfl + d.tot * 0.1 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ score, ...d }) => (void score, d))

  const perGame = boxes.map((b) => ({ sacks: String(b.defense.reduce((t, d) => t + d.sacks, 0)), turnovers: String(n(b.opp.turnovers)), points_allowed: String(b.them) }))
  const ats = atsRecord(boxes)
  const betting: NFLDefenseBetting = {
    sacks: hitRatesForThresholds(perGame, 'sacks', [1.5, 2.5, 3.5, 4.5]),
    pointsAllowed: hitRatesForThresholds(perGame, 'points_allowed', [13.5, 16.5, 20.5, 23.5, 27.5]),
    turnoversForced: hitRatesForThresholds(perGame, 'turnovers', [0.5, 1.5, 2.5]),
    ats: ats.total > 0 ? { wins: ats.w, losses: ats.l, pct: pct1(ats.w, ats.w + ats.l) } : null,
  }

  const rankedGames = boxes.filter((b) => b.oppRank !== null)
  return {
    stats,
    ranks,
    last5,
    keyMatchup,
    topDefenders,
    betting,
    vsRanked: { w: season.vsRanked.w, l: season.vsRanked.l, papg: rankedGames.length > 0 ? r1(rankedGames.reduce((t, b) => t + b.them, 0) / rankedGames.length) : null, games: rankedGames.length },
    nationalOf: ranksNat?.of ?? null,
  }
}

// ---------------------------------------------------------------------------
// Betting records from closing lines
// ---------------------------------------------------------------------------

function teamSpread(b: TeamGameBox): number | null {
  if (!b.line || b.line.homeSpread === null) return null
  return b.home ? b.line.homeSpread : -b.line.homeSpread
}

export function atsRecord(boxes: TeamGameBox[]): { w: number; l: number; p: number; total: number } {
  let w = 0, l = 0, p = 0
  for (const b of boxes) {
    const sp = teamSpread(b)
    if (sp === null) continue
    const m = b.us - b.them + sp
    if (m > 0) w++
    else if (m < 0) l++
    else p++
  }
  return { w, l, p, total: w + l + p }
}

function ouRecord(boxes: TeamGameBox[]): { o: number; u: number; total: number } {
  let o = 0, u = 0
  for (const b of boxes) {
    if (!b.line || b.line.total === null) continue
    const t = b.us + b.them
    if (t > b.line.total) o++
    else if (t < b.line.total) u++
  }
  return { o, u, total: o + u }
}

const toLine = (label: string, wins: number, losses: number): NFLBettingLine => ({ label, wins, losses, pct: pct1(wins, wins + losses) })

function bettingSummary(abbr: string, boxes: TeamGameBox[]): NFLTeamBettingSummary | null {
  if (boxes.length === 0) return null
  const wins = boxes.filter((b) => b.result === 'W').length
  const ats = atsRecord(boxes)
  const ou = ouRecord(boxes)
  const last5 = ouRecord(boxes.slice(-5))
  const home = boxes.filter((b) => b.home)
  const away = boxes.filter((b) => !b.home)
  return {
    moneyline: toLine(`${abbr} ML`, wins, boxes.length - wins),
    ats: toLine(`${abbr} ATS`, ats.w, ats.l),
    overUnder: toLine(`${abbr} O/U`, ou.o, ou.u),
    last5OverUnder: toLine(`${abbr} L5 O/U`, last5.o, last5.u),
    homeRecord: toLine(`${abbr} Home`, home.filter((b) => b.result === 'W').length, home.filter((b) => b.result !== 'W').length),
    awayRecord: toLine(`${abbr} Away`, away.filter((b) => b.result === 'W').length, away.filter((b) => b.result !== 'W').length),
    note: `ATS and Over/Under use the real DraftKings closing line ESPN recorded for each game (${ats.total} of ${boxes.length} games have one; pushes excluded).`,
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function summaryCard(s: CfbTeamSeason): NFLTeamSummaryCard | null {
  if (s.games === 0) return null
  const rankedGames = s.boxes.filter((b) => b.oppRank !== null)
  const ats = atsRecord(s.boxes.filter((b) => b.oppRank !== null))
  const last5: NFLLastGameRow[] = [...s.boxes].reverse().slice(0, 5).map((b) => ({
    week: b.week ?? 0,
    date: b.date.slice(0, 10),
    opp: `${b.oppRank !== null ? `#${b.oppRank} ` : ''}${b.oppAbbr}`,
    result: b.result,
    score: `${b.us}-${b.them}`,
    passYds: n(b.team.netPassingYards),
    rushYds: n(b.team.rushingYards),
  }))
  return {
    abbr: s.abbr,
    record: { wins: s.wins, losses: s.losses, ties: s.boxes.filter((b) => b.result === 'T').length, pct: pct1(s.wins, s.wins + s.losses) },
    last5Dots: s.boxes.slice(-10).map((b) => b.result),
    offense: { pointsPerGame: s.ppg, passYdsPerGame: s.passYpg, rushYdsPerGame: s.rushYpg, turnoversPerGame: s.turnoversPerGame },
    defense: { pointsAllowedPerGame: s.papg, passYdsAllowedPerGame: s.passAllowedYpg, rushYdsAllowedPerGame: s.rushAllowedYpg, sacks: s.sacks, turnoversForcedPerGame: s.turnoversForcedPerGame },
    last5,
    extras: [
      { label: 'Conference', value: `${s.conf.w}-${s.conf.l}` },
      { label: 'vs Ranked', value: rankedGames.length > 0 ? `${s.vsRanked.w}-${s.vsRanked.l}` : 'None yet' },
      { label: 'ATS vs Ranked', value: ats.total > 0 ? `${ats.w}-${ats.l}${ats.p ? `-${ats.p}` : ''}` : '—' },
    ],
  }
}

export async function getCfbSummaryTabData(gameId: string): Promise<NFLSummaryTabData | null> {
  const matchup = await getCfbMatchup(gameId)
  if (!matchup) return null
  const [a, h] = await Promise.all([getCfbTeamSeason(matchup.away.id, matchup.away.abbr, matchup.season), getCfbTeamSeason(matchup.home.id, matchup.home.abbr, matchup.season)])
  return { away: summaryCard(a), home: summaryCard(h), awayBetting: bettingSummary(matchup.away.abbr, a.boxes), homeBetting: bettingSummary(matchup.home.abbr, h.boxes) }
}

// ---------------------------------------------------------------------------
// Trends
// ---------------------------------------------------------------------------

function teamTrends(s: CfbTeamSeason, opp: CfbTeamSeason, qb: NFLQBStats | null): Omit<NFLTrend, 'id'>[] {
  const out: Omit<NFLTrend, 'id'>[] = []
  const a = s.abbr
  const last5 = s.boxes.slice(-5)
  const w5 = last5.filter((b) => b.result === 'W').length
  if (last5.length >= 4 && w5 >= last5.length - 1 && w5 >= 4) out.push({ category: 'Form', title: `${a} — Strong Recent Form`, stat: `${w5}-${last5.length - w5} in last ${last5.length}`, note: 'Playing at a high level heading into this matchup.', hot: w5 === last5.length })
  if (last5.length >= 4 && last5.length - w5 >= 3) out.push({ category: 'Form', title: `${a} — Struggling Stretch`, stat: `${w5}-${last5.length - w5} in last ${last5.length}`, note: 'A trend worth monitoring until they show signs of life.', hot: w5 === 0 })
  const l3 = s.boxes.slice(-3)
  if (l3.length === 3) {
    const pts = l3.reduce((t, b) => t + b.us, 0) / 3
    if (pts >= 38) out.push({ category: 'Form', title: `${a} — Offensive Hot Streak`, stat: `${r1(pts)} pts/g over last 3`, note: 'Offense trending well above norms.', hot: pts >= 45 })
    const allowed = l3.reduce((t, b) => t + b.them, 0) / 3
    if (allowed <= 14) out.push({ category: 'Form', title: `${a} — Defensive Dominance`, stat: `${r1(allowed)} pts allowed/g over last 3`, note: 'Defense locking teams down — favors unders.', hot: allowed <= 10 })
  }

  if (qb && qb.last5.length >= 3) {
    const g = qb.last5.slice(0, 3)
    const r = ncaaRating(g.reduce((t, x) => t + x.comp, 0), g.reduce((t, x) => t + x.att, 0), g.reduce((t, x) => t + x.yds, 0), g.reduce((t, x) => t + x.td, 0), g.reduce((t, x) => t + x.int, 0))
    if (r >= 160) out.push({ category: 'Passing', title: `${qb.name} — QB on Fire`, stat: `${r1(r)} efficiency over last 3 games`, note: `${a} gets a real passing edge if this holds.`, hot: r >= 175 })
    else if (r <= 115) out.push({ category: 'Passing', title: `${qb.name} — QB Struggling`, stat: `${r1(r)} efficiency over last 3 games`, note: 'Passing output has been below average recently.', hot: r <= 100 })
  }
  if (l3.length === 3) {
    const ry = l3.reduce((t, b) => t + n(b.team.rushingYards), 0) / 3
    if (ry >= 220) out.push({ category: 'Rushing', title: `${a} — Ground Game Rolling`, stat: `${r1(ry)} rush yds/g over last 3`, note: 'Run game is dictating tempo.', hot: ry >= 260 })
    else if (ry < 110) out.push({ category: 'Rushing', title: `${a} — Run Game Stalling`, stat: `${r1(ry)} rush yds/g over last 3`, note: 'Ground game has gone cold — leaning pass-heavy.', hot: ry < 80 })
  }

  // Situational: conference, home/away, ranked opponents, ATS and totals.
  const conf = s.boxes.filter((b) => b.conferenceGame)
  if (conf.length >= 2) out.push({ category: 'Situational', title: `${a} — Conference Record`, stat: `${s.conf.w}-${s.conf.l} in conference games`, note: 'Conference games tend to be tighter, more familiar matchups.', hot: false })
  const home = s.boxes.filter((b) => b.home)
  const away = s.boxes.filter((b) => !b.home)
  if (home.length >= 2) out.push({ category: 'Situational', title: `${a} — Home Record`, stat: `${home.filter((b) => b.result === 'W').length}-${home.filter((b) => b.result !== 'W').length} at home`, note: 'College home-field advantage is substantial.', hot: home.every((b) => b.result === 'W') && home.length >= 3 })
  if (away.length >= 2) out.push({ category: 'Situational', title: `${a} — Road Record`, stat: `${away.filter((b) => b.result === 'W').length}-${away.filter((b) => b.result !== 'W').length} on the road`, note: 'Away performance matters most when traveling into a hostile crowd.', hot: false })
  const rk = s.boxes.filter((b) => b.oppRank !== null)
  if (rk.length >= 1) {
    const ats = atsRecord(rk)
    out.push({ category: 'Situational', title: `${a} — vs Ranked Opponents`, stat: `${s.vsRanked.w}-${s.vsRanked.l} straight up${ats.total > 0 ? `, ${ats.w}-${ats.l} ATS` : ''}`, note: opp.boxes.length > 0 ? 'Measured against AP top-25 opponents at game time.' : 'Measured against AP top-25 opponents.', hot: s.vsRanked.w > 0 && s.vsRanked.l === 0 && rk.length >= 2 })
  }
  const ats = atsRecord(s.boxes)
  if (ats.total >= 3) out.push({ category: 'Situational', title: `${a} — Against the Spread`, stat: `${ats.w}-${ats.l}${ats.p ? `-${ats.p}` : ''} ATS this season`, note: 'Real DraftKings closing lines.', hot: ats.w >= ats.total - 1 && ats.total >= 4 })
  const ou = ouRecord(s.boxes)
  if (ou.total >= 3) out.push({ category: 'Situational', title: `${a} — Over/Under`, stat: `${ou.o} overs, ${ou.u} unders`, note: 'Real DraftKings closing totals.', hot: ou.o >= ou.total - 1 && ou.total >= 4 })
  return out
}

export async function getCfbTrendsData(gameId: string): Promise<NFLTrend[] | null> {
  const matchup = await getCfbMatchup(gameId)
  if (!matchup) return null
  const [a, h] = await Promise.all([getCfbTeamSeason(matchup.away.id, matchup.away.abbr, matchup.season), getCfbTeamSeason(matchup.home.id, matchup.home.abbr, matchup.season)])
  const aq = pickStarterQB(a.boxes)
  const hq = pickStarterQB(h.boxes)
  const awayQB = aq ? qbSeason(a.boxes, aq.id, a.abbr) : null
  const homeQB = hq ? qbSeason(h.boxes, hq.id, h.abbr) : null
  const all = [...teamTrends(a, h, awayQB), ...teamTrends(h, a, homeQB)]

  // Head-to-head: any earlier meeting this season shows up in either team's box scores.
  const meet = a.boxes.find((b) => b.oppId === matchup.home.id && b.date < (matchup.date ?? '9'))
  if (meet) all.push({ category: 'H2H', title: `${matchup.away.abbr} vs ${matchup.home.abbr} — Earlier Meeting`, stat: `${meet.result === 'W' ? matchup.away.abbr : matchup.home.abbr} won ${meet.us}-${meet.them}`, note: 'Teams that have already met this season.', hot: false })
  return all.sort((x, y) => Number(y.hot) - Number(x.hot)).map((t, i) => ({ ...t, id: i + 1 }))
}

// ---------------------------------------------------------------------------
// Stadium
// ---------------------------------------------------------------------------

export interface CfbStadiumTabData {
  stadium: { name: string; city: string | null; capacity: number | null; indoor: boolean | null }
  weather: NFLWeatherInfo
  homeEdge: {
    homeWinPct: number | null
    record: string | null
    ats: { wins: number; losses: number; pct: number } | null
    overUnder: { wins: number; losses: number; pct: number } | null
  }
  atmosphere: { rating: number; label: string; note: string }
  history: { season: number; homeWins: number; homeLosses: number; avgTotalPoints: number }[]
  betImpact: { title: string; detail: string; affects: string[] }[]
  notes: ImpactNote[]
}

function atmosphere(capacity: number | null, homeWinPct: number | null): CfbStadiumTabData['atmosphere'] {
  const cap = capacity ? Math.min(1, capacity / 105000) : 0.45
  const win = homeWinPct !== null ? homeWinPct / 100 : 0.55
  const rating = Math.max(1, Math.min(10, Math.round((cap * 5 + win * 5) * 10) / 10))
  const label = rating >= 8.5 ? 'Electric' : rating >= 7 ? 'Intimidating' : rating >= 5.5 ? 'Loud' : rating >= 4 ? 'Solid' : 'Quiet'
  const parts: string[] = []
  if (capacity) parts.push(`${capacity.toLocaleString('en-US')} seats`)
  if (homeWinPct !== null) parts.push(`${homeWinPct.toFixed(0)}% home win rate this season`)
  return { rating, label, note: parts.length ? `Rating blends capacity and home results: ${parts.join(' and ')}.` : 'Capacity and home results will refine this rating as the season goes on.' }
}

export async function getCfbStadiumTabData(gameId: string): Promise<CfbStadiumTabData | null> {
  const matchup = await getCfbMatchup(gameId)
  if (!matchup) return null
  const home = await getCfbTeamSeason(matchup.home.id, matchup.home.abbr, matchup.season)
  const indoor = matchup.venue.indoor === true
  const homeBoxes = home.boxes.filter((b) => b.home)

  const city = matchup.venue.city ? `${matchup.venue.city}${matchup.venue.state ? `,${matchup.venue.state},US` : ''}` : matchup.home.shortName
  const [weather, historySeasons, info] = await Promise.all([
    getNFLWeather(city, indoor, matchup.date),
    Promise.all([1, 2, 3].map((d) => getTeamSchedule('football', CFB_LEAGUE, matchup.home.id, matchup.season - d).catch(() => null))),
    getTeamInfo('football', CFB_LEAGUE, matchup.home.id).catch(() => null),
  ])

  const capacity = matchup.venue.capacity ?? info?.venue?.capacity ?? STADIUM_CAPACITY[matchup.home.abbr] ?? null
  const history = historySeasons
    .map((sched, i) => {
      const games = (sched ?? []).filter((g) => g.state === 'post' && g.home && (g.seasonType === null || g.seasonType === 2) && g.us !== null && g.them !== null)
      if (games.length === 0) return null
      const w = games.filter((g) => g.result === 'W').length
      return { season: matchup.season - (i + 1), homeWins: w, homeLosses: games.length - w, avgTotalPoints: r1(games.reduce((t, g) => t + (g.us ?? 0) + (g.them ?? 0), 0) / games.length) }
    })
    .filter((h): h is NonNullable<typeof h> => h !== null)

  const ats = atsRecord(homeBoxes)
  const ou = ouRecord(homeBoxes)
  const homeWinPct = home.homeWinPct
  const betImpact: CfbStadiumTabData['betImpact'] = []
  if (homeWinPct !== null && home.homeGames >= 2 && homeWinPct >= 75) betImpact.push({ title: 'Strong Home-Field Edge', detail: `${matchup.home.shortName} wins ${homeWinPct.toFixed(0)}% of its home games this season in front of ${capacity ? capacity.toLocaleString('en-US') : 'a loud'} fans.`, affects: ['Moneyline', 'Spread'] })
  if (capacity && capacity >= 85000) betImpact.push({ title: 'Massive Stadium', detail: `${matchup.venue.stadium} holds ${capacity.toLocaleString('en-US')} — one of the biggest crowds in the sport. Visiting offenses often struggle with communication.`, affects: ['Spread', 'Totals'] })
  if (history.length > 0) {
    const avg = history.reduce((t, h) => t + h.avgTotalPoints, 0) / history.length
    betImpact.push({ title: 'Historical Scoring at This Venue', detail: `Averaging ${r1(avg)} combined points per home game over the last ${history.length} season${history.length !== 1 ? 's' : ''}.`, affects: ['Totals'] })
  }
  if (indoor) betImpact.push({ title: 'Indoor Venue', detail: 'Roof or dome — weather is a non-factor for this game.', affects: ['Neutral'] })
  if (matchup.neutral) betImpact.push({ title: 'Neutral Site', detail: 'Played away from either campus, so home-field numbers above matter less.', affects: ['Spread'] })

  return {
    stadium: { name: matchup.venue.stadium, city: matchup.venue.city, capacity, indoor: matchup.venue.indoor },
    weather,
    homeEdge: {
      homeWinPct,
      record: home.homeGames > 0 ? `${homeBoxes.filter((b) => b.result === 'W').length}-${homeBoxes.filter((b) => b.result !== 'W').length}` : null,
      ats: ats.total > 0 ? { wins: ats.w, losses: ats.l, pct: pct1(ats.w, ats.w + ats.l) } : null,
      overUnder: ou.total > 0 ? { wins: ou.o, losses: ou.u, pct: pct1(ou.o, ou.o + ou.u) } : null,
    },
    atmosphere: atmosphere(capacity, homeWinPct),
    history,
    betImpact: betImpact.slice(0, 4),
    notes: weather.notes,
  }
}

void impactNotes
