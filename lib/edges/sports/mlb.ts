import { slugify } from '@/lib/players/slug'
import type { BatterFacts, BullpenFacts, LineupFacts, StarterFacts, UsedArm } from '../data/mlb'
import type { ModuleInput } from '../modules/shared'
import type { BettingOutcome, Edge, GameContext, ModuleOutput, PlayerGameRecord, TeamGameRecord } from '../types'
import { avg3, ev, f1, f2, inn, lineText, mean, ordinal, plural, recRelevance, recText } from './format'
import { foundationEdges } from './foundationItems'
import { propName, recentAtLine, seasonAtLine, vsOpponentCareer } from './props'
import { atVenue, avgAgainst, avgFor, covers, currentSeason, games as played, postseason, recentSeasons, regular, totalSide, vsOpp, vsTier, wins, type Rec } from './records'

/**
 * MLB evidence. The starting pitchers against the exact lineups they face lead every MLB bet: each pitcher's profile, his
 * venue and recent form, the lineup batter by batter with the platoon edge checked against each hitter's own splits, and the
 * bullpens by who actually pitched and how much their role matters. Records follow (W-L at tonight's number), then the
 * game foundation (weather, injuries to real bats, venue history). Each item carries the number, the comparison, the
 * reason it should last and the connection to tonight; an item that does not point the bet's way is not shown.
 */

type Side = 'away' | 'home'

const ALIAS: Record<string, string> = { ARI: 'AZ', WAS: 'WSH', CWS: 'CHW', ATH: 'OAK' }
const same = (a: string, b: string) => (ALIAS[a] ?? a) === (ALIAS[b] ?? b)
const IP = inn

const leagueEra = (game: GameContext): number | null => {
  const vals = Object.values(game.defense).map((d) => d['ERA']?.value).filter((v): v is number => typeof v === 'number')
  return vals.length >= 20 ? mean(vals) : null
}

interface VsLine {
  n: number
  ip: number
  er: number
  h: number
  ab: number
  era: number
  avg: number | null
}

/** A starter's starts this season (regular season and postseason) against one team. */
function startsVs(s: StarterFacts | null, opp: string): VsLine | null {
  if (!s) return null
  const l = s.starts.filter((x) => same(x.opp, opp))
  if (l.length === 0) return null
  const ip = l.reduce((n, x) => n + x.ip, 0)
  const er = l.reduce((n, x) => n + x.er, 0)
  const h = l.reduce((n, x) => n + x.h, 0)
  const ab = l.reduce((n, x) => n + x.ab, 0)
  return ip > 0 ? { n: l.length, ip, er, h, ab, era: (er * 9) / ip, avg: ab > 0 ? h / ab : null } : null
}

function lastStartsEra(s: StarterFacts | null, n: number): { era: number; n: number; ip: number; k: number } | null {
  const l = s?.starts.slice(0, n) ?? []
  const ip = l.reduce((a, x) => a + x.ip, 0)
  return l.length >= Math.min(n, 3) && ip > 0 ? { era: (l.reduce((a, x) => a + x.er, 0) * 9) / ip, n: l.length, ip, k: mean(l.map((x) => x.k)) } : null
}

const handWord = (h: 'L' | 'R' | null) => (h === 'L' ? 'left-handed' : 'right-handed')
const seriesName = (game: GameContext) => (game.facts.mlb?.series ? (game.facts.mlb.series.short || game.facts.mlb.series.description).replace(/\s*Game \d+$/i, '') : '')

/** The relievers who pitched in the last two days, by role: closers and setup men are the arms that matter in a close game. */
function bullpenRead(pen: BullpenFacts | null | undefined, team: string, otherEra: number | null): { text: string; taxed: boolean; rested: boolean } | null {
  if (!pen || pen.games < 1) return null
  const era = pen.era !== null ? ` (${f2(pen.era)} relief ERA${otherEra !== null ? ` vs ${f2(otherEra)} for the other side` : ''})` : ''
  const y = pen.used.filter((a) => a.daysBefore === 1)
  const hi = pen.used.filter((a) => a.role === 'closer' || a.role === 'setup')
  const hiYesterday = y.filter((a) => a.role === 'closer' || a.role === 'setup')
  const roleName = (a: UsedArm) => (a.role === 'closer' ? 'closer' : 'setup man')
  const arm = (a: UsedArm) => `${roleName(a)} ${a.name} (${IP(a.ip)} IP, ${a.pitches} pitches${a.daysBefore === 2 ? ', two days ago' : ''})`
  if (hiYesterday.length > 0 || hi.some((a) => a.pitches >= 20)) {
    const list = (hiYesterday.length ? hiYesterday : hi).slice(0, 3)
    return { text: `${team} used ${list.map(arm).join(' and ')}${hiYesterday.length ? ' yesterday' : ''} — those high-leverage arms may be limited tonight${era}`, taxed: true, rested: false }
  }
  if (y.length > 0) {
    const mop = y.filter((a) => a.role === 'long' || a.role === 'middle')
    return { text: `${team} used ${mop.slice(0, 3).map((a) => `${a.role === 'long' ? 'long reliever' : 'middle reliever'} ${a.name} (${IP(a.ip)} IP, ${a.pitches} pitches)`).join(' and ')} yesterday — its closer and setup arms are fully rested for tonight${era}`, taxed: false, rested: true }
  }
  return pen.lastTwoDaysInnings >= 6 ? { text: `${team}'s bullpen threw ${IP(pen.lastTwoDaysInnings)} innings over the last 2 days (${plural(pen.games, 'game')}) with no high-leverage arm used — shutdown relievers are available tonight${era}`, taxed: false, rested: true } : null
}

// ---------------------------------------------------------------------------
// The pitcher and the lineup (shared by team bets and totals)
// ---------------------------------------------------------------------------

/** Season profile with the league comparison; null when the starter has no real sample. */
function profileText(s: StarterFacts, team: string, game: GameContext): { text: string; era: number; delta: number | null } | null {
  const se = s.season
  if (!se || se.ip < 20) return null
  const lg = leagueEra(game)
  const delta = lg === null ? null : lg - se.era
  return {
    era: se.era,
    delta,
    text: `${s.name}, ${team}'s starter tonight, carries a ${f2(se.era)} ERA, ${f2(se.whip)} WHIP, ${f1(se.k9)} K/9 and ${f1(se.bb9)} BB/9 over ${IP(se.ip)} IP${lg !== null ? ` — ${f2(Math.abs(delta as number))} ${(delta as number) >= 0 ? 'better' : 'worse'} than the league's ${f2(lg)} team ERA` : ''}`,
  }
}

interface LineupRead {
  synthesis: string | null
  batters: string | null
  platoon: string | null
  form: string | null
  avg: number | null
  hot: number
  cold: number
  confirm: number
}

/** Batter-by-batter read of a lineup against the starter it faces. */
function lineupReads(lineup: LineupFacts | null | undefined, starter: StarterFacts | null, team: string): LineupRead | null {
  if (!lineup || !starter) return null
  const faced = lineup.batters.filter((b) => (b.vsPitcher?.pa ?? 0) >= 5)
  let synthesis: string | null = null
  let batters: string | null = null
  if (faced.length >= 1 && lineup.facedAvg !== null) {
    const hr = faced.reduce((n, b) => n + (b.vsPitcher?.hr ?? 0), 0)
    const h = faced.reduce((n, b) => n + (b.vsPitcher?.h ?? 0), 0)
    const ab = faced.reduce((n, b) => n + (b.vsPitcher?.ab ?? 0), 0)
    const line = (b: BatterFacts) => `${b.name} (${b.vsPitcher!.h} for ${b.vsPitcher!.ab}${b.vsPitcher!.hr ? `, ${b.vsPitcher!.hr} HR` : ''})`
    const withAb = faced.filter((b) => (b.vsPitcher?.ab ?? 0) >= 8)
    const byAvg = [...withAb].sort((a, b) => b.vsPitcher!.h / b.vsPitcher!.ab - a.vsPitcher!.h / a.vsPitcher!.ab)
    const tail = byAvg.length >= 2 ? `; ${starter.name}'s strongest matchup is ${line(byAvg[byAvg.length - 1])}, his most vulnerable is ${line(byAvg[0])}` : ''
    synthesis = `${faced.length} of ${lineup.batters.length} ${team} batters in tonight's lineup have faced ${starter.name} — hitting ${avg3(h / ab)} combined (${h} for ${ab}) with ${hr} HR${tail}`
    const top = [...faced].sort((a, b) => (b.vsPitcher?.pa ?? 0) - (a.vsPitcher?.pa ?? 0)).slice(0, 3)
    batters = `Career vs ${starter.name}: ${top.map((b) => `${b.name} is ${b.vsPitcher!.h} for ${b.vsPitcher!.ab} (${avg3(b.vsPitcher!.ab ? b.vsPitcher!.h / b.vsPitcher!.ab : 0)}) with ${plural(b.vsPitcher!.k, 'strikeout')}`).join('; ')}`
  }
  // Platoon, confirmed by each hitter's own split against the hand he faces tonight versus the other hand.
  let platoon: string | null = null
  let confirm = 0
  const hand = starter.hand
  if (hand) {
    const rows = lineup.batters
      .map((b) => {
        const s = b.splits[hand === 'L' ? 'vl' : 'vr']
        const o = b.splits[hand === 'L' ? 'vr' : 'vl']
        return s && o && s.ab >= 40 && o.ab >= 40 ? { b, s, o, d: s.avg - o.avg } : null
      })
      .filter((x): x is { b: BatterFacts; s: NonNullable<BatterFacts['splits']['vl']>; o: NonNullable<BatterFacts['splits']['vl']>; d: number } => x !== null)
    if (rows.length >= 5) {
      confirm = rows.filter((x) => x.d >= 0.02).length
      const reverse = rows.filter((x) => x.d <= -0.02).length
      const best = [...rows].sort((a, b) => b.d - a.d)[0]
      const worst = [...rows].sort((a, b) => a.d - b.d)[0]
      const hl = hand === 'L' ? 'LHP' : 'RHP'
      const ol = hand === 'L' ? 'RHP' : 'LHP'
      platoon = `Platoon check against ${starter.name}'s ${handWord(hand)} arm: ${lineup.lefties} of ${lineup.batters.length} ${team} hitters bat left-handed tonight, and their own splits show ${confirm} of ${rows.length} hitting better against ${hl} than ${ol} (${best.b.name} ${avg3(best.s.avg)} vs ${avg3(best.o.avg)}) while ${reverse} hit worse (${worst.b.name} ${avg3(worst.s.avg)} vs ${avg3(worst.o.avg)}) — ${confirm >= Math.ceil(rows.length / 2) ? 'confirming the platoon edge in the data rather than assuming it' : confirm <= reverse ? 'contradicting the usual platoon expectation' : 'a split too mixed to call a platoon edge'}`
    }
  }
  // Recent form entering tonight.
  const hotCold = lineup.batters.filter((b) => b.form.last10Avg !== null && b.form.seasonAvg !== null).map((b) => ({ b, d: (b.form.last10Avg as number) - (b.form.seasonAvg as number) }))
  const hotList = hotCold.filter((x) => x.d >= 0.05).sort((a, b) => b.d - a.d)
  const coldList = hotCold.filter((x) => x.d <= -0.05).sort((a, b) => a.d - b.d)
  const fmt = (x: { b: BatterFacts }) => `${x.b.name} (${avg3(x.b.form.last10Avg as number)} vs ${avg3(x.b.form.seasonAvg as number)})`
  const form = hotCold.length >= 5 ? `Entering tonight ${hotList.length} of ${hotCold.length} ${team} hitters are hitting at least 50 points above their season average over the last 10 games${hotList.length ? ` (${hotList.slice(0, 3).map(fmt).join(', ')})` : ''} while ${coldList.length} are at least 50 points below${coldList.length ? ` (${coldList.slice(0, 2).map(fmt).join(', ')})` : ''}` : null
  return { synthesis, batters, platoon, form, avg: lineup.facedAvg, hot: hotList.length, cold: coldList.length, confirm }
}

// ---------------------------------------------------------------------------
// Moneyline and run line
// ---------------------------------------------------------------------------

function mlbSide({ outcome: o, game }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  const t = o.team
  if (!t) return { edges, conflicts }
  const T = t.abbr
  const O = t.opponent
  const spread = o.type === 'spread' && o.threshold !== undefined
  const line = o.threshold ?? 0
  const mine: Side = T === game.away ? 'away' : 'home'
  const theirs: Side = mine === 'away' ? 'home' : 'away'
  const facts = game.facts.mlb
  const homeFlag = t.home
  const tally = (gs: TeamGameRecord[]): Rec => (spread ? covers(gs, line) : wins(gs))
  const ownRecWord = spread ? `record covering ${lineText(line)}` : 'record'
  const betWord = spread ? `${lineText(line)} run line` : 'moneyline'
  const push = (e: Edge) => edges.push(e)
  const post = seriesName(game) || 'postseason'
  const lg = leagueEra(game)

  if (facts) {
    const sT = facts.starters[mine]
    const sO = facts.starters[theirs]
    // ---- Tier 1: the pitchers, then the bullpens.
    const pT = sT ? profileText(sT, T, game) : null
    const pO = sO ? profileText(sO, O, game) : null
    if (sT && pT && pT.delta !== null && pT.delta >= 0.4) push(ev({ tier: 1, text: `${pT.text} — ${T} has the stronger arm on the mound tonight`, category: 'matchup', horizon: 'season', layer: 'opportunity', relevance: Math.min(1, 0.55 + (pT.delta as number) / 5), support: `${sT.season ? IP(sT.season.ip) : ''} IP this season`, n: Math.round(sT.season?.ip ?? 0), metrics: { avg: pT.era } }))
    else if (pT && pT.delta !== null && pT.delta <= -0.6) conflicts++
    if (sO && pO && pO.delta !== null && pO.delta <= -0.4) push(ev({ tier: 1, text: `${pO.text} — ${O}'s arm is the weaker one against ${T} tonight`, category: 'matchup', horizon: 'season', layer: 'opportunity', relevance: Math.min(1, 0.55 + Math.abs(pO.delta as number) / 5), support: `${sO.season ? IP(sO.season.ip) : ''} IP this season`, n: Math.round(sO.season?.ip ?? 0), metrics: { avg: pO.era } }))
    else if (pO && pO.delta !== null && pO.delta >= 0.8) conflicts++

    const penO = bullpenRead(facts.bullpen[theirs], O, facts.bullpen[mine]?.era ?? null)
    const penT = bullpenRead(facts.bullpen[mine], T, facts.bullpen[theirs]?.era ?? null)
    if (penO?.taxed) push(ev({ tier: 1, text: `${penO.text}, which opens late-inning scoring for ${T} tonight`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.7, support: 'Boxscores from the last two days with season saves and holds', n: 2, ageDays: 1 }))
    else if (penO?.rested && penT?.taxed) conflicts++
    if (penT?.taxed) conflicts++

    // ---- Tier 2: each starter's venue, platoon and recent form, then each lineup batter by batter.
    const venueEra = (s: StarterFacts | null, home: boolean) => s?.splits[home ? 'h' : 'a']
    const vT = venueEra(sT, homeFlag)
    if (sT && vT && vT.ip >= 20 && vT.era <= 3.5) push(ev({ tier: 2, text: `${sT.name} has a ${f2(vT.era)} ERA ${homeFlag ? 'at home' : 'on the road'} this season over ${IP(vT.ip)} IP vs ${sT.season ? f2(sT.season.era) : '—'} overall — tonight's game is ${homeFlag ? 'at home' : 'on the road'} for ${T}'s starter`, category: 'hit_rate', horizon: 'season', relevance: Math.min(1, 0.5 + (3.9 - vT.era) / 6), support: `${homeFlag ? 'Home' : 'Road'} split`, n: Math.round(vT.ip) }))
    const vO = venueEra(sO, !homeFlag)
    if (sO && vO && vO.ip >= 20 && vO.era >= 5) push(ev({ tier: 2, text: `${sO.name} has a ${f2(vO.era)} ERA ${!homeFlag ? 'at home' : 'on the road'} this season over ${IP(vO.ip)} IP vs ${sO.season ? f2(sO.season.era) : '—'} overall — tonight's game is ${!homeFlag ? 'at home' : 'on the road'} for ${O}'s starter`, category: 'hit_rate', horizon: 'season', relevance: Math.min(1, 0.5 + (vO.era - 4.5) / 6), support: `${!homeFlag ? 'Home' : 'Road'} split`, n: Math.round(vO.ip) }))
    const mineVs = startsVs(sT, O)
    if (sT && mineVs && mineVs.era <= 3.75) push(ev({ tier: 2, text: `${sT.name} has a ${f2(mineVs.era)} ERA vs ${O} this season in ${plural(mineVs.n, 'start')}${mineVs.avg !== null ? ` with ${O} batting ${avg3(mineVs.avg)} against him (${mineVs.h} for ${mineVs.ab})` : ''}${lg !== null ? ` vs the ${f2(lg)} league ERA` : ''} — the same lineup he faces tonight`, category: 'matchup', horizon: 'season_vs_opp', layer: 'opportunity', relevance: Math.min(1, 0.55 + (4.2 - mineVs.era) / 6), support: `${IP(mineVs.ip)} IP, ${mineVs.er} ER`, n: mineVs.n, metrics: { avg: mineVs.era, n: mineVs.n } }))
    else if (sT && mineVs && mineVs.era >= 5.5) conflicts++
    const theirVs = startsVs(sO, T)
    if (sO && theirVs && theirVs.era >= 5) push(ev({ tier: 2, text: `${sO.name} has a ${f2(theirVs.era)} ERA vs ${T} this season in ${plural(theirVs.n, 'start')}${theirVs.avg !== null ? ` with ${T} batting ${avg3(theirVs.avg)} against him (${theirVs.h} for ${theirVs.ab})` : ''}${lg !== null ? ` vs the ${f2(lg)} league ERA` : ''} — the same lineup he faces tonight`, category: 'matchup', horizon: 'season_vs_opp', layer: 'opportunity', relevance: Math.min(1, 0.55 + (theirVs.era - 4.2) / 8), support: `${IP(theirVs.ip)} IP, ${theirVs.er} ER`, n: theirVs.n, metrics: { avg: theirVs.era, n: theirVs.n } }))
    else if (sO && theirVs && theirVs.era <= 2.5 && theirVs.n >= 2) conflicts++

    // The pitcher's handedness splits against the makeup of the lineup he faces.
    const lineupT = facts.lineups[mine]
    if (sO && lineupT && sO.splits.vl && sO.splits.vr) {
      const l = sO.splits.vl
      const r = sO.splits.vr
      const worseSide = l.era > r.era ? 'left-handed' : 'right-handed'
      const worseEra = Math.max(l.era, r.era)
      const nWorse = l.era > r.era ? lineupT.lefties : lineupT.righties
      if (worseEra >= 4.8 && nWorse >= 5 && Math.abs(l.era - r.era) >= 1) push(ev({ tier: 2, text: `${sO.name} has a ${f2(l.era)} ERA vs left-handed hitters (${f1(l.kPct)}% K rate) and ${f2(r.era)} vs right-handed (${f1(r.kPct)}% K rate) — ${nWorse} of ${lineupT.batters.length} ${T} hitters tonight are the ${worseSide} side he struggles against`, category: 'matchup', horizon: 'season', layer: 'opportunity', relevance: 0.6, support: 'Pitcher splits by batter handedness', n: Math.round(Math.min(l.ip, r.ip)) }))
    }
    const lineupO = facts.lineups[theirs]
    if (sT && lineupO && sT.splits.vl && sT.splits.vr) {
      const l = sT.splits.vl
      const r = sT.splits.vr
      const betterSide = l.era < r.era ? 'left-handed' : 'right-handed'
      const betterEra = Math.min(l.era, r.era)
      const nBetter = l.era < r.era ? lineupO.lefties : lineupO.righties
      if (betterEra <= 3.4 && nBetter >= 5 && Math.abs(l.era - r.era) >= 1) push(ev({ tier: 2, text: `${sT.name} has a ${f2(l.era)} ERA vs left-handed hitters (${f1(l.kPct)}% K rate) and ${f2(r.era)} vs right-handed (${f1(r.kPct)}% K rate) — ${nBetter} of ${lineupO.batters.length} ${O} hitters tonight are the ${betterSide} side he handles best`, category: 'matchup', horizon: 'season', layer: 'opportunity', relevance: 0.6, support: 'Pitcher splits by batter handedness', n: Math.round(Math.min(l.ip, r.ip)) }))
    }
    const reads = lineupReads(lineupT, sO, T)
    if (reads?.synthesis && reads.avg !== null) {
      if (reads.avg >= 0.265) {
        push(ev({ tier: 2, text: `${reads.synthesis} — hitting that well vs the .250 baseline of an average hitter makes this a favorable matchup for ${T} tonight`, category: 'h2h', horizon: 'career_vs_opp', layer: 'statistical', relevance: Math.min(1, 0.5 + (reads.avg - 0.25) * 3), support: 'Career batter-vs-pitcher lines, five or more PA each', n: lineupT?.facedPa ?? 0, seasonsAgo: 1 }))
        if (reads.batters) push(ev({ tier: 2, text: `${reads.batters} — the career lines of the ${T} bats who will face him tonight`, category: 'h2h', horizon: 'career_vs_opp', layer: 'statistical', relevance: 0.55, support: 'Career batter-vs-pitcher lines', n: lineupT?.facedPa ?? 0, seasonsAgo: 1 }))
      } else if (reads.avg <= 0.2) conflicts++
    }
    if (reads?.platoon && reads.confirm >= 5) push(ev({ tier: 2, text: `${reads.platoon} — the handedness edge for ${T} tonight`, category: 'matchup', horizon: 'season', layer: 'opportunity', relevance: 0.6, support: "Each hitter's season split by pitcher handedness", n: 8 }))
    if (reads?.form && reads.hot >= 3 && reads.hot > reads.cold) push(ev({ tier: 3, text: `${reads.form} — ${T}'s lineup arrives hot`, category: 'recent_form', horizon: 'last15', relevance: 0.55, support: 'Last ten games against season average, each hitter', n: 10, ageDays: 1 }))
    else if (reads?.form && reads.cold >= 3 && reads.cold > reads.hot) conflicts++
    // The opposing lineup against T's starter.
    const readO = lineupReads(lineupO, sT, O)
    if (readO && readO.avg !== null && readO.synthesis && readO.avg <= 0.2) push(ev({ tier: 2, text: `${readO.synthesis} — a lineup that cannot hit him vs the .250 baseline of an average hitter, good for ${T} tonight`, category: 'h2h', horizon: 'career_vs_opp', layer: 'statistical', relevance: 0.6, support: 'Career batter-vs-pitcher lines, five or more PA each', n: lineupO?.facedPa ?? 0, seasonsAgo: 1 }))
    else if (readO && readO.avg !== null && readO.avg >= 0.285) conflicts++

    // ---- Tier 3: each starter's last three starts against his season.
    const a3 = lastStartsEra(sT, 3)
    const b3 = lastStartsEra(sO, 3)
    if (sT && sT.season && a3 && a3.era <= sT.season.era - 0.75 && a3.era <= 3.5) push(ev({ tier: 3, text: `${sT.name}'s ERA over his last ${a3.n} starts is ${f2(a3.era)} vs ${f2(sT.season.era)} on the season — trending better, with ${f1(a3.k)} strikeouts per start in them — heading into tonight's start for ${T}`, category: 'recent_form', horizon: 'last15', layer: 'statistical', relevance: Math.min(1, 0.5 + (sT.season.era - a3.era) / 6), support: 'Most recent starts, regular season and postseason', n: a3.n, ageDays: 4, metrics: { avg: a3.era, n: a3.n } }))
    else if (sT?.season && a3 && a3.era >= sT.season.era + 1.5) conflicts++
    if (sO && sO.season && b3 && b3.era >= sO.season.era + 0.75 && b3.era >= 4.5) push(ev({ tier: 3, text: `${sO.name}'s ERA over his last ${b3.n} starts is ${f2(b3.era)} vs ${f2(sO.season.era)} on the season — trending worse — heading into tonight's start for ${O}`, category: 'recent_form', horizon: 'last15', layer: 'statistical', relevance: Math.min(1, 0.5 + (b3.era - sO.season.era) / 6), support: 'Most recent starts, regular season and postseason', n: b3.n, ageDays: 4, metrics: { avg: b3.era, n: b3.n } }))
  }

  // ---- Tier 2: this team against this opponent this season, postseason separated, with the opponent's quality.
  const cur = currentSeason(game, T)
  const vsThis = vsOpp(cur, O)
  const r = tally(vsThis)
  const oppPct = game.leagueWinPct[O]
  const oppWord = oppPct !== undefined ? ` — ${O} is ${oppPct.toFixed(3).replace(/^0/, '')} on the season, so these are meetings with a ${oppPct >= 0.5 ? 'winning' : 'losing'} team` : ''
  if (played(r) >= 3 && r.w / played(r) >= 0.6) {
    const reg = tally(regular(vsThis))
    const ps = tally(postseason(vsThis))
    const split = played(ps) > 0 && played(reg) > 0 ? ` (regular season ${recText(reg)}, ${post} ${recText(ps)})` : ''
    push(ev({ tier: 2, text: `${T}'s ${ownRecWord} vs ${O} this season: ${recText(r)}${split}${oppWord} — the matchup behind tonight's ${betWord}`, category: 'h2h', horizon: 'season_vs_opp', relevance: recRelevance(r.w, r.l), support: `${vsThis.length} meetings`, n: vsThis.length, metrics: { rate: r.w / played(r), n: played(r) } }))
  } else if (played(r) >= 3 && r.w / played(r) <= 0.34) conflicts++

  // ---- Tier 3: runs scored and allowed over the last 10 games against each team's season, side by side.
  const last10 = (abbr: string) => (game.results[abbr] ?? []).slice(0, 10)
  const a = last10(T)
  const b = last10(O)
  if (a.length >= 7 && b.length >= 7) {
    const aM = avgFor(a) - avgAgainst(a)
    const bM = avgFor(b) - avgAgainst(b)
    const aS = currentSeason(game, T)
    const bS = currentSeason(game, O)
    if (aM - bM >= 1) {
      push(ev({ tier: 3, text: `Last ${a.length} games: ${T} scoring ${f1(avgFor(a))} runs per game and allowing ${f1(avgAgainst(a))} (${f1(avgFor(aS))} and ${f1(avgAgainst(aS))} on the season); ${O} scoring ${f1(avgFor(b))} and allowing ${f1(avgAgainst(b))} (${f1(avgFor(bS))} and ${f1(avgAgainst(bS))} on the season) — ${T} has been ${f1(aM - bM)} runs per game better heading into tonight`, category: 'recent_form', horizon: 'last15', relevance: Math.min(1, 0.45 + (aM - bM) / 5), support: `${T} ${recText(wins(a))} · ${O} ${recText(wins(b))} over those games`, n: Math.min(a.length, b.length), ageDays: 2, metrics: { avg: aM, n: a.length } }))
    } else if (bM - aM >= 1.5) conflicts++
  }

  // ---- Tier 4: situational records that match tonight, each against its counterpart.
  const venue = tally(atVenue(cur, homeFlag))
  const venueOther = tally(atVenue(cur, !homeFlag))
  if (played(venue) >= 8 && venue.w / played(venue) >= 0.58) push(ev({ tier: 4, text: `${T}'s ${ownRecWord} ${homeFlag ? 'at home' : 'on the road'} this season: ${recText(venue)}${played(venueOther) >= 8 ? ` vs ${recText(venueOther)} ${homeFlag ? 'on the road' : 'at home'}` : ''} — tonight's ${betWord} is a ${homeFlag ? 'home' : 'road'} game for ${T}`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(venue.w, venue.l), support: `${homeFlag ? 'Home' : 'Road'} games, regular season and postseason`, n: played(venue), metrics: { rate: venue.w / played(venue), n: played(venue) } }))
  if (oppPct !== undefined) {
    const strong = oppPct >= 0.5
    const tier = tally(vsTier(cur, game, strong))
    if (played(tier) >= 10 && tier.w / played(tier) >= 0.58) push(ev({ tier: 4, text: `${T}'s ${ownRecWord} vs teams ${strong ? 'at or above' : 'under'} .500 this season: ${recText(tier)} — ${O} is at ${oppPct.toFixed(3).replace(/^0/, '')}, so this is the quality of opponent tonight's ${betWord} faces`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(tier.w, tier.l), support: 'Opponent quality from the standings', n: played(tier), metrics: { rate: tier.w / played(tier), n: played(tier) } }))
  }
  const ps = tally(postseason(cur))
  if (played(ps) >= 4 && ps.w / played(ps) >= 0.65) push(ev({ tier: 4, text: `${T}'s ${ownRecWord} in the postseason this season: ${recText(ps)} vs ${recText(tally(regular(cur)))} in the regular season — tonight's game is a postseason game`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(ps.w, ps.l), support: 'Postseason games', n: played(ps) }))
  // The opponent's mirror record, where it fails is where this bet wins.
  const oppVenue = atVenue(currentSeason(game, O), !homeFlag)
  if (spread) {
    const mirror = covers(oppVenue, -line)
    if (played(mirror) >= 8 && mirror.w / played(mirror) <= 0.42) push(ev({ tier: 4, text: `${O}'s record covering ${lineText(-line)} ${!homeFlag ? 'at home' : 'on the road'} this season: ${recText(mirror)}${played(covers(atVenue(currentSeason(game, O), homeFlag), -line)) >= 8 ? ` vs ${recText(covers(atVenue(currentSeason(game, O), homeFlag), -line))} ${homeFlag ? 'at home' : 'on the road'}` : ''} — the number ${O} has to cover tonight`, category: 'hit_rate', horizon: 'season', relevance: Math.min(1, 0.45 + (0.5 - mirror.w / played(mirror)) * 1.5), support: `${O}'s ${!homeFlag ? 'home' : 'road'} games`, n: played(mirror), metrics: { rate: 1 - mirror.w / played(mirror), n: played(mirror) } }))
  } else {
    const theirs2 = wins(oppVenue)
    if (played(theirs2) >= 8 && theirs2.w / played(theirs2) <= 0.45) push(ev({ tier: 4, text: `${O}'s record ${!homeFlag ? 'at home' : 'on the road'} this season: ${recText(theirs2)}${played(wins(atVenue(currentSeason(game, O), homeFlag))) >= 8 ? ` vs ${recText(wins(atVenue(currentSeason(game, O), homeFlag)))} ${homeFlag ? 'at home' : 'on the road'}` : ''} — the venue ${O} plays tonight`, category: 'hit_rate', horizon: 'season', relevance: Math.min(1, 0.45 + (0.5 - theirs2.w / played(theirs2)) * 1.5), support: `${O}'s ${!homeFlag ? 'home' : 'road'} games`, n: played(theirs2) }))
  }

  // ---- Tier 6: the last two regular seasons against this opponent, only when lopsided.
  const two = recentSeasons(game, T, 2).filter((g) => same(g.opp, O) && !g.playoff)
  const tw = tally(two)
  if (played(tw) >= 6 && tw.w / played(tw) >= 0.7) push(ev({ tier: 6, text: `${T}'s ${ownRecWord} vs ${O} over the last two regular seasons: ${recText(tw)} vs the ${recText(tally(vsOpp(cur, O)))} this season — tonight's opponent`, category: 'h2h', horizon: 'career_vs_opp', relevance: recRelevance(tw.w, tw.l), support: 'Two most recent regular seasons', n: played(tw), seasonsAgo: 1 }))

  const f = foundationEdges(o, game)
  edges.push(...f.edges)
  conflicts += f.conflicts
  return { edges, conflicts }
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

function mlbTotal({ outcome: o, game }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  if (o.threshold === undefined) return { edges, conflicts }
  const total = o.threshold
  const over = o.direction !== 'under'
  const word = over ? 'Over' : 'Under'
  const A = game.away
  const H = game.home
  const facts = game.facts.mlb
  const push = (e: Edge) => edges.push(e)
  const lg = leagueEra(game)

  if (facts) {
    // ---- Tier 1: both starting pitchers, each on his own line.
    const sa = facts.starters.away
    const sh = facts.starters.home
    const pa = sa ? profileText(sa, A, game) : null
    const ph = sh ? profileText(sh, H, game) : null
    if (pa && ph && pa.delta !== null && ph.delta !== null) {
      const hi = Math.max(pa.delta, ph.delta)
      const lo = Math.min(pa.delta, ph.delta)
      const bothBad = (pa.delta <= -0.3 && ph.delta <= -0.3) || (lo <= -1 && hi <= 0.2)
      const bothGood = (pa.delta >= 0.3 && ph.delta >= 0.3) || (hi >= 1 && lo >= -0.2)
      if ((over && bothBad) || (!over && bothGood)) push(ev({ tier: 1, text: `${pa.text}; ${ph.text} — ${over ? 'the pair of arms grades worse than the league baseline, tilting tonight toward runs' : 'the pair of arms grades better than the league baseline, tilting tonight toward pitching'} against the ${total} total`, category: 'matchup', horizon: 'season', layer: 'opportunity', relevance: 0.65, support: 'Season lines for each probable starter', n: Math.round(Math.min(sa?.season?.ip ?? 0, sh?.season?.ip ?? 0)) }))
      else if ((over && bothGood) || (!over && bothBad)) conflicts++
    }
    // Last three starts for each.
    const l3a = lastStartsEra(sa, 3)
    const l3h = lastStartsEra(sh, 3)
    if (sa?.season && sh?.season && l3a && l3h) {
      const worse = l3a.era >= sa.season.era + 0.5 && l3h.era >= sh.season.era + 0.5
      const better = l3a.era <= sa.season.era - 0.5 && l3h.era <= sh.season.era - 0.5
      if ((over && worse) || (!over && better)) push(ev({ tier: 3, text: `${sa.name}'s ERA over his last ${l3a.n} starts is ${f2(l3a.era)} vs ${f2(sa.season.era)} on the season; ${sh.name}'s is ${f2(l3h.era)} vs ${f2(sh.season.era)} — both ${over ? 'trending worse' : 'trending better'} going into tonight's ${total}`, category: 'recent_form', horizon: 'last15', layer: 'statistical', relevance: 0.55, support: 'Most recent starts, each', n: Math.min(l3a.n, l3h.n), ageDays: 4 }))
      else if ((over && better) || (!over && worse)) conflicts++
    }
    // This season against the lineup he faces tonight.
    const lines: string[] = []
    let supportive = 0
    let against = 0
    for (const p of [{ s: sa, faces: H }, { s: sh, faces: A }]) {
      const vs = startsVs(p.s, p.faces)
      if (!p.s || !vs) continue
      const good = over ? vs.era >= 4.75 : vs.era <= 3.25
      const bad = over ? vs.era <= 2.75 : vs.era >= 5
      if (good) supportive++
      if (bad) against++
      lines.push(`${p.s.name} has a ${f2(vs.era)} ERA vs ${p.faces} this season in ${plural(vs.n, 'start')}${vs.avg !== null ? ` (${p.faces} batting ${avg3(vs.avg)})` : ''}`)
    }
    if (supportive >= 1 && supportive >= against) push(ev({ tier: 2, text: `${lines.join('; ')}${lg !== null ? ` vs the ${f2(lg)} league ERA` : ''} — the same lineups they face tonight`, category: 'matchup', horizon: 'season_vs_opp', layer: 'opportunity', relevance: 0.55 + supportive * 0.1, support: 'Starts this season, regular season and postseason', n: lines.length }))
    else if (against > supportive) conflicts++
    // The lineups batter by batter.
    for (const [lineup, starter, team] of [[facts.lineups.away, sh, A], [facts.lineups.home, sa, H]] as const) {
      const r = lineupReads(lineup, starter, team)
      if (!r?.synthesis || r.avg === null) continue
      if ((over && r.avg >= 0.265) || (!over && r.avg <= 0.2)) push(ev({ tier: 2, text: `${r.synthesis} vs the .250 baseline of an average hitter — ${over ? 'a lineup that has hit this starter' : 'a lineup that has not hit this starter'} and faces him tonight`, category: 'h2h', horizon: 'career_vs_opp', layer: 'statistical', relevance: 0.55, support: 'Career batter-vs-pitcher lines, five or more PA each', n: lineup?.facedPa ?? 0, seasonsAgo: 1 }))
      else if ((over && r.avg <= 0.2) || (!over && r.avg >= 0.285)) conflicts++
    }
    // Home runs allowed.
    const hr9 = (s: StarterFacts | null) => {
      const l = s?.starts.slice(0, 5) ?? []
      const ip = l.reduce((n, x) => n + x.ip, 0)
      return l.length >= 3 && ip > 0 ? { v: (l.reduce((n, x) => n + x.hr, 0) * 9) / ip, n: l.length, season: s?.season?.hr9 ?? null } : null
    }
    const hA = hr9(sa)
    const hH = hr9(sh)
    if (over && sa && sh && hA && hH && hA.v >= 1.3 && hH.v >= 1.3) push(ev({ tier: 2, text: `HR/9 over the last 5 starts: ${sa.name} ${f1(hA.v)}${hA.season !== null ? ` vs ${f1(hA.season)} on the season` : ''}, ${sh.name} ${f1(hH.v)}${hH.season !== null ? ` vs ${f1(hH.season)} on the season` : ''} — both are giving up the long ball going into tonight's ${total}`, category: 'recent_form', horizon: 'last30', layer: 'statistical', relevance: 0.6, support: 'Last five starts each', n: Math.min(hA.n, hH.n), ageDays: 4 }))
    // Bullpens by name and role.
    const penA = bullpenRead(facts.bullpen.away, A, facts.bullpen.home?.era ?? null)
    const penH = bullpenRead(facts.bullpen.home, H, facts.bullpen.away?.era ?? null)
    const taxed = [penA, penH].filter((p): p is NonNullable<typeof p> => !!p && p.taxed)
    if (over && taxed.length > 0) push(ev({ tier: 1, text: `${taxed.map((p) => p.text).join('; ')} — worn high-leverage relievers raise the odds of late runs against tonight's ${total}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: Math.min(1, 0.5 + taxed.length * 0.1), support: 'Boxscores from the last two days with season saves and holds', n: taxed.length, ageDays: 1 }))
    else if (!over && penA?.rested && penH?.rested) push(ev({ tier: 1, text: `${penA.text}; ${penH.text} — both bullpens arrive with their best arms available, supporting the under ${total}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.5, support: 'Boxscores from the last two days with season saves and holds', n: 2, ageDays: 1 }))
    else if (!over && taxed.length > 0) conflicts++
  }

  // ---- Tier 3: recent scoring, each team separately, with the combined figure only as the closing summary.
  const l10 = (abbr: string) => (game.results[abbr] ?? []).slice(0, 10)
  const a10 = l10(A)
  const h10 = l10(H)
  const sA = currentSeason(game, A)
  const sH = currentSeason(game, H)
  if (a10.length >= 7 && h10.length >= 7) {
    const trend = (recent: number, season: number) => (recent >= season + 0.4 ? 'trending up' : recent <= season - 0.4 ? 'trending down' : 'stable')
    const ra = avgFor(a10)
    const rh = avgFor(h10)
    const combined = ra + rh
    const gap = combined - total
    if ((over && gap >= 0.5) || (!over && gap <= -0.5)) push(ev({ tier: 3, text: `${A} is scoring ${f1(ra)} runs per game over the last ${a10.length} (${f1(avgFor(sA))} on the season, ${trend(ra, avgFor(sA))}); ${H} is scoring ${f1(rh)} over the last ${h10.length} (${f1(avgFor(sH))} on the season, ${trend(rh, avgFor(sH))}) — combined ${f1(combined)} against tonight's ${total} line`, category: 'recent_form', horizon: 'last15', relevance: Math.min(1, 0.45 + Math.abs(gap) / 3), support: `${A} allowed ${f1(avgAgainst(a10))}, ${H} allowed ${f1(avgAgainst(h10))} over the same games`, n: Math.min(a10.length, h10.length), ageDays: 2 }))
    else if ((over && gap <= -0.5) || (!over && gap >= 0.5)) conflicts++
  }
  // ---- Tier 4/5: each team's record at this number, with its tonight's-venue split.
  const sa2 = totalSide(sA, total, over)
  const sh2 = totalSide(sH, total, over)
  const pct = (r: Rec, n: number) => Math.round((r.w / Math.max(1, n)) * 100)
  if (played(sa2) >= 20 && played(sh2) >= 20) {
    const va = totalSide(atVenue(sA, false), total, over)
    const vh = totalSide(atVenue(sH, true), total, over)
    const both = (sa2.w + sh2.w) / (played(sa2) + played(sh2))
    if (both >= 0.54) push(ev({ tier: 5, text: `${A}: ${word} ${total} in ${sa2.w} of ${sA.length} games this season (${pct(sa2, sA.length)}%)${played(va) >= 15 ? ` — on the road: ${va.w} of ${played(va) + va.p} (${pct(va, played(va) + va.p)}%)` : ''}; ${H}: ${word} ${total} in ${sh2.w} of ${sH.length} games (${pct(sh2, sH.length)}%)${played(vh) >= 15 ? ` — at home: ${vh.w} of ${played(vh) + vh.p} (${pct(vh, played(vh) + vh.p)}%)` : ''} — each against tonight's ${total} number`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(sa2.w + sh2.w, played(sa2) + played(sh2) - sa2.w - sh2.w), support: 'Final scores this season, postseason included', n: Math.min(sA.length, sH.length), metrics: { rate: both, n: sA.length } }))
    else if (both <= 0.44) conflicts++
  }
  const l10a = totalSide(a10, total, over)
  const l10h = totalSide(h10, total, over)
  if (played(l10a) >= 7 && played(l10h) >= 7 && (l10a.w + l10h.w) / (played(l10a) + played(l10h)) >= 0.6) push(ev({ tier: 3, text: `${A}: ${word} ${total} in ${l10a.w} of the last ${played(l10a) + l10a.p} games vs ${sa2.w} of ${sA.length} on the season; ${H}: ${word} ${total} in ${l10h.w} of the last ${played(l10h) + l10h.p} vs ${sh2.w} of ${sH.length} — recent results against tonight's number`, category: 'recent_form', horizon: 'last15', relevance: recRelevance(l10a.w + l10h.w, played(l10a) + played(l10h) - l10a.w - l10h.w), support: "Final scores against tonight's number", n: Math.min(played(l10a), played(l10h)), ageDays: 2, metrics: { rate: (l10a.w + l10h.w) / (played(l10a) + played(l10h)), n: played(l10a) } }))
  const psA = totalSide(postseason(sA), total, over)
  const psH = totalSide(postseason(sH), total, over)
  if (played(psA) + played(psH) >= 6 && (psA.w + psH.w) / (played(psA) + played(psH)) >= 0.65) push(ev({ tier: 4, text: `Postseason: ${A} ${word} ${total} in ${psA.w} of ${played(psA) + psA.p}; ${H} ${word} ${total} in ${psH.w} of ${played(psH) + psH.p} — playoff games vs the regular-season marks above, and tonight is a playoff game`, category: 'hit_rate', horizon: 'season', relevance: 0.55, support: 'Postseason games this season', n: played(psA) + played(psH) }))
  // This season's meetings: each team's scoring, then the combined summary last.
  const meet = vsOpp(sA, H)
  if (meet.length >= 3) {
    const r = totalSide(meet, total, over)
    if (r.w / Math.max(1, played(r)) >= 0.6) push(ev({ tier: 2, text: `${A} vs ${H} this season: ${A} scored ${f1(avgFor(meet))} and ${H} scored ${f1(avgAgainst(meet))} per game across ${meet.length} meetings — combined, ${r.w} of ${meet.length} meetings cleared ${over ? 'over' : 'under'} ${total} — the same two teams tonight`, category: 'h2h', horizon: 'season_vs_opp', relevance: recRelevance(r.w, played(r) - r.w), support: `${meet.length} games between these teams`, n: meet.length }))
    else if (r.w / Math.max(1, played(r)) <= 0.34) conflicts++
  }
  const f = foundationEdges(o, game)
  edges.push(...f.edges)
  conflicts += f.conflicts
  return { edges, conflicts }
}

// ---------------------------------------------------------------------------
// Player props
// ---------------------------------------------------------------------------

function mlbProp({ outcome: o, game, history, extras }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  if (!o.player || !o.category) return { edges, conflicts }
  const over = o.direction !== 'under'
  const name = propName(o)
  const facts = game.facts.mlb
  const homeFlag = o.homeAway === 'home' ? true : o.homeAway === 'away' ? false : null
  const merge = (r: { edges: Edge[]; conflicts: number }) => {
    edges.push(...r.edges)
    conflicts += r.conflicts
  }
  const push = (e: Edge) => edges.push(e)

  // ----------------------------------------------------------------------- pitcher strikeouts
  if (o.category === 'Strikeouts') {
    if (!facts) return { edges, conflicts }
    const slug = slugify(o.player.name)
    const side: Side | null = facts.starters.away?.slug === slug ? 'away' : facts.starters.home?.slug === slug ? 'home' : null
    const starter = side ? facts.starters[side] : null
    if (!side || !starter) return { edges, conflicts }
    const oppSide: Side = side === 'away' ? 'home' : 'away'
    const opp = oppSide === 'home' ? game.home : game.away
    const line = o.threshold ?? 0
    const lineup = facts.lineups[oppSide]
    const hand = starter.hand
    const word = over ? 'Over' : 'Under'
    const rankRow = game.defense[opp]?.['Strikeout rate']
    const leagueK = (() => {
      const vals = Object.values(game.defense).map((d) => d['Strikeout rate']?.value).filter((v): v is number => typeof v === 'number')
      return vals.length >= 20 ? mean(vals) : null
    })()
    // Tier 1: the lineup's strikeout rate against this handedness, ranked.
    const teamHand = hand ? facts.teamVsHand[oppSide][hand === 'L' ? 'vl' : 'vr'] : null
    const kRate = lineup?.kPctVsHand ?? teamHand?.kPct ?? null
    const kPa = lineup?.kPctVsHand != null ? lineup.paVsHand : (teamHand?.pa ?? 0)
    if (kRate !== null && leagueK !== null && hand) {
      const gap = kRate - leagueK
      if ((over && gap >= 1.5) || (!over && gap <= -1.5)) {
        const rank = rankRow ? `, ${ordinal(over ? rankRow.rank : rankRow.of - rankRow.rank + 1)}-${over ? 'highest' : 'lowest'} of ${rankRow.of} teams overall` : ''
        const mix = lineup ? `; ${lineup.lefties} of ${lineup.batters.length} in the posted lineup bat left-handed` : '; the lineup is not posted yet, so this is the team rate'
        push(ev({ tier: 1, text: `${opp}'s ${lineup ? 'hitters in the posted lineup' : 'hitters'} strike out in ${f1(kRate)}% of plate appearances against ${handWord(hand)} pitching over ${kPa} PA this season vs the league's ${f1(leagueK)}%${rank} — ${name} is ${hand === 'L' ? 'a lefty' : 'a righty'}${mix}, the primary driver of tonight's ${word.toLowerCase()} ${line}`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: Math.min(1, 0.55 + Math.abs(gap) / 8), support: lineup ? "Tonight's posted lineup" : 'Team split by pitcher handedness', n: kPa, metrics: { rate: kRate / 100, n: kPa } }))
      } else if ((over && gap <= -1.5) || (!over && gap >= 1.5)) conflicts++
    }
    // The individual high-strikeout bats in the lineup.
    if (lineup && leagueK !== null && hand) {
      const high = lineup.batters.filter((b) => b.vsHand && b.vsHand.pa >= 40 && (b.vsHand.k / b.vsHand.pa) * 100 >= leagueK + 4).map((b) => ({ n: b.name, k: (b.vsHand!.k / b.vsHand!.pa) * 100 }))
      const low = lineup.batters.filter((b) => b.vsHand && b.vsHand.pa >= 40 && (b.vsHand.k / b.vsHand.pa) * 100 <= leagueK - 4)
      if (over && high.length >= 3) push(ev({ tier: 1, text: `${high.length} of ${lineup.batters.length} ${opp} hitters strike out at least 4 points above the league's ${f1(leagueK)}% against ${handWord(hand)} pitching, including ${high.sort((a, b) => b.k - a.k).slice(0, 3).map((h) => `${h.n} (${f1(h.k)}%)`).join(', ')} — contact-poor bats ${name} faces tonight`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: 0.6, support: "Each hitter's strikeout rate against this handedness", n: lineup.batters.length }))
      else if (!over && low.length >= 3) push(ev({ tier: 1, text: `${low.length} of ${lineup.batters.length} ${opp} hitters strike out at least 4 points below the league's ${f1(leagueK)}% against ${handWord(hand)} pitching — contact bats that limit ${name}'s strikeouts tonight`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: 0.55, support: "Each hitter's strikeout rate against this handedness", n: lineup.batters.length }))
    }
    if (starter.restDays !== null && starter.restDays <= 3) {
      if (!over) push(ev({ tier: 1, text: `${name} is working on ${starter.restDays} days of rest tonight vs the usual four — short rest cuts innings and strikeouts, favoring the under ${line}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.6, support: 'Days since his last start', n: 1, ageDays: 0 }))
      else conflicts++
    }
    // Tier 2: this season and career against tonight's opponent.
    const vs = startsVs(starter, opp)
    const vsStarts = starter.starts.filter((s) => same(s.opp, opp))
    if (vsStarts.length >= 1) {
      const ks = vsStarts.map((s) => s.k)
      const hits = ks.filter((k) => (over ? k > line : k < line)).length
      const seasonK = starter.starts.length ? mean(starter.starts.map((s) => s.k)) : null
      if (hits / ks.length >= 0.6) push(ev({ tier: 2, text: `${name} vs ${opp} this season: ${ks.join(', ')} strikeouts in ${plural(ks.length, 'start')} (${word} ${line} in ${hits} of ${ks.length})${seasonK !== null ? ` vs ${f1(seasonK)} per start on the season` : ''}${vs ? ` with a ${f2(vs.era)} ERA` : ''} — tonight's opponent`, category: 'h2h', horizon: 'season_vs_opp', relevance: recRelevance(hits, ks.length - hits), support: 'This season, postseason included', n: ks.length }))
      else if (hits / ks.length <= 0.34 && ks.length >= 2) conflicts++
    }
    const career = starter.vsTeam
    if (career && starter.season && starter.season.kPct > 0) {
      const gap = (career.kPct - starter.season.kPct) / starter.season.kPct
      if ((over && gap >= 0.1) || (!over && gap <= -0.1)) push(ev({ tier: 2, text: `${name}'s career vs ${opp}: ${f1(career.kPct)}% strikeout rate vs ${f1(starter.season.kPct)}% this season, with hitters batting ${avg3(career.avg)} over ${career.pa} PA in ${plural(career.games, 'game')} — tonight's opponent`, category: 'h2h', horizon: 'career_vs_opp', relevance: Math.min(1, 0.45 + Math.abs(gap)), support: 'Career line against this team', n: career.games, seasonsAgo: 1 }))
    }
    if (lineup && lineup.facedCount >= 3 && lineup.facedPa >= 20 && lineup.facedKPct !== null) {
      const good = over ? lineup.facedKPct >= 24 : lineup.facedKPct <= 17
      if (good) push(ev({ tier: 2, text: `${lineup.facedCount} of ${lineup.batters.length} ${opp} starters have faced ${name} (${lineup.facedPa} career PA): ${f1(lineup.facedKPct)}% strikeout rate vs ${starter.season ? f1(starter.season.kPct) : '—'}% this season and ${lineup.facedAvg !== null ? avg3(lineup.facedAvg) : '—'} average — the bats he faces tonight`, category: 'h2h', horizon: 'career_vs_opp', relevance: Math.min(1, 0.5 + lineup.facedPa / 200), support: 'Career batter-vs-pitcher, five or more PA each', n: lineup.facedPa, seasonsAgo: 1 }))
    }
    // Tier 3: recent starts against his season, and the lineup's own recent strikeout rate.
    const last5 = starter.starts.slice(0, 5)
    if (last5.length >= 3) {
      const ks = last5.map((s) => s.k)
      const hits = ks.filter((k) => (over ? k > line : k < line)).length
      const seasonK = starter.starts.length >= 6 ? mean(starter.starts.map((s) => s.k)) : null
      if (hits / last5.length >= 0.6) push(ev({ tier: 3, text: `${name} averaged ${f1(mean(ks))} strikeouts over his last ${last5.length} starts (${ks.join(', ')}) vs ${seasonK !== null ? `${f1(seasonK)} per start on the season` : 'his season average'} — ${word} ${line} in ${hits} of ${last5.length}, averaging ${f1(mean(last5.map((s) => s.ip)))} innings per start, the form behind tonight's number`, category: 'recent_form', horizon: 'last30', relevance: recRelevance(hits, last5.length - hits), support: last5.map((s) => `${s.k} K, ${IP(s.ip)} IP vs ${s.opp}`).join(' · '), n: last5.length, ageDays: 4, metrics: { rate: hits / last5.length, avg: mean(ks), n: last5.length } }))
      else if (hits / last5.length <= 0.34) conflicts++
    }
    const rec = facts.recent[oppSide].d15
    const seasonKrate = game.defense[opp]?.['Strikeout rate']?.value
    if (rec && seasonKrate !== undefined && rec.games >= 5) {
      const gap = rec.kPct - seasonKrate
      if ((over && gap >= 1.5) || (!over && gap <= -1.5)) push(ev({ tier: 3, text: `${opp}'s lineup has struck out in ${f1(rec.kPct)}% of plate appearances over its last ${rec.games} games vs ${f1(seasonKrate)}% for the season — the form it brings into tonight`, category: 'recent_form', horizon: 'last15', relevance: Math.min(1, 0.45 + Math.abs(gap) / 8), support: 'Team hitting, last 15 days', n: rec.games, ageDays: 1 }))
    }
    return { edges, conflicts }
  }

  // ----------------------------------------------------------------------- hitters (Hits, Home Runs, ...)
  const oppSide: Side = o.homeAway === 'home' ? 'away' : 'home'
  const starter = facts?.starters[oppSide] ?? null
  const m = extras?.hitterMatchup
  const opp = o.opponent ?? ''
  const wx = game.foundation?.weather
  const bettingHr = o.category === 'Home Runs'

  // Tier 1: the weather at the park (home runs), the bullpen he sees late, the batting-order slot, the starter's recent damage.
  if (wx && bettingHr) {
    if (over && wx.carry === 'out') push(ev({ tier: 1, text: `${wx.text} — conditions that help ${name}'s fly balls carry tonight`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.6, support: 'Game-time weather at an open-air park', n: 5, ageDays: 0 }))
    else if (!over && wx.carry === 'in') push(ev({ tier: 1, text: `${wx.text} — conditions that keep ${name}'s fly balls in the park tonight`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.6, support: 'Game-time weather at an open-air park', n: 5, ageDays: 0 }))
    else if ((over && wx.carry === 'in') || (!over && wx.carry === 'out')) conflicts++
  }
  const penO = bullpenRead(facts?.bullpen[oppSide], opp, null)
  if (over && penO?.taxed) push(ev({ tier: 1, text: `${penO.text}, so ${name} sees weaker relief arms in his later plate appearances tonight`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.55, support: 'Boxscores from the last two days with season saves and holds', n: 2, ageDays: 1 }))
  if (game.mlb && o.homeAway) {
    const slot = game.mlb.lineups[o.homeAway].indexOf(slugify(o.player.name)) + 1
    if (slot > 0) {
      if (over && slot <= 3) push(ev({ tier: 1, text: `${name} bats ${ordinal(slot)} tonight — the top three spots in the order get the most plate appearances in the lineup, which raises the number of chances to reach ${o.threshold} ${o.category}`, category: 'role', horizon: 'tonight', layer: 'opportunity', relevance: slot === 3 ? 0.55 : 0.65, support: `Posted lineup, slot ${slot}`, n: 1, ageDays: 0 }))
      else if (over && slot >= 7) conflicts++
      else if (!over && slot >= 7) push(ev({ tier: 1, text: `${name} bats ${ordinal(slot)} tonight — the bottom of the order gets fewer plate appearances than the top three, which lowers his chances to reach ${o.threshold} ${o.category}`, category: 'role', horizon: 'tonight', layer: 'opportunity', relevance: 0.55, support: `Posted lineup, slot ${slot}`, n: 1, ageDays: 0 }))
    }
  }
  if (starter) {
    const l3 = starter.starts.slice(0, 3)
    const ip = l3.reduce((n, x) => n + x.ip, 0)
    const all = starter.starts
    const allIp = all.reduce((n, x) => n + x.ip, 0)
    if (l3.length >= 3 && ip > 0 && allIp > 0) {
      const h9 = (l3.reduce((n, x) => n + x.h, 0) * 9) / ip
      const sh9 = (all.reduce((n, x) => n + x.h, 0) * 9) / allIp
      const hr9 = (l3.reduce((n, x) => n + x.hr, 0) * 9) / ip
      const shr9 = (all.reduce((n, x) => n + x.hr, 0) * 9) / allIp
      if (o.category === 'Hits' && (over ? h9 >= sh9 + 1 && h9 >= 9.5 : h9 <= sh9 - 1 && h9 <= 6.5)) push(ev({ tier: 2, text: `${starter.name} has allowed ${l3.reduce((n, x) => n + x.h, 0)} hits in ${IP(ip)} IP over his last 3 starts (${f1(h9)} per nine vs ${f1(sh9)} on the season) — tonight's starter against ${name}'s team`, category: 'matchup', horizon: 'last15', layer: 'opportunity', relevance: Math.min(1, 0.5 + Math.abs(h9 - sh9) / 6), support: 'Last three starts', n: 3, ageDays: 4 }))
      else if (bettingHr && over && hr9 >= 1.4 && hr9 >= shr9 + 0.4) push(ev({ tier: 2, text: `${starter.name} has allowed ${l3.reduce((n, x) => n + x.hr, 0)} home runs in ${IP(ip)} IP over his last 3 starts (${f1(hr9)} HR/9 vs ${f1(shr9)} on the season) — tonight's starter against ${name}'s team`, category: 'matchup', horizon: 'last15', layer: 'opportunity', relevance: Math.min(1, 0.5 + (hr9 - 1.2) / 3), support: 'Last three starts', n: 3, ageDays: 4 }))
    }
  }

  // Tier 2: career against tonight's starter, the platoon edge checked against both of his splits, and his current form.
  if (m?.vs && m.vs.plateAppearances >= 5) {
    const { hits, atBats, plateAppearances, homeRuns, strikeOuts, avg } = m.vs
    const seasonAvg = m.form.seasonAvg
    if (o.category === 'Hits') {
      const good = over ? avg >= 0.3 : avg <= 0.15
      if (good) push(ev({ tier: 2, text: `${name} is ${hits} for ${atBats} (${avg3(avg)}) vs ${m.pitcher} in his career with ${plural(strikeOuts, 'strikeout')} in ${atBats} at-bats over ${plateAppearances} PA${homeRuns ? ` and ${homeRuns} HR` : ''}${seasonAvg !== null ? ` vs his ${avg3(seasonAvg)} season average` : ''} — the starter he faces tonight`, category: 'h2h', horizon: 'career_vs_opp', layer: 'statistical', relevance: Math.min(1, 0.5 + Math.abs(avg - 0.25) * 2.5), support: 'Career batter-vs-pitcher', n: plateAppearances, seasonsAgo: 1 }))
      else if (over ? avg <= 0.15 : avg >= 0.3) conflicts++
    } else if (bettingHr && plateAppearances >= 10) {
      if (over && homeRuns >= 1) push(ev({ tier: 2, text: `${name} has ${homeRuns} HR in ${atBats} AB vs ${m.pitcher} in his career (${hits} for ${atBats}, ${plural(strikeOuts, 'strikeout')}) over ${plateAppearances} PA — the starter he faces tonight`, category: 'h2h', horizon: 'career_vs_opp', layer: 'statistical', relevance: 0.6, support: 'Career batter-vs-pitcher', n: plateAppearances, seasonsAgo: 1 }))
      else if (!over && homeRuns === 0) push(ev({ tier: 2, text: `${name} has no home runs in ${atBats} AB vs ${m.pitcher} in his career (${hits} for ${atBats}) over ${plateAppearances} PA — the starter he faces tonight`, category: 'h2h', horizon: 'career_vs_opp', layer: 'statistical', relevance: 0.55, support: 'Career batter-vs-pitcher', n: plateAppearances, seasonsAgo: 1 }))
    }
  }
  if (m?.platoon && m.hand && m.platoon.atBats >= 40) {
    const a = m.platoon.avg
    const other = m.opposite
    const split = other && other.atBats >= 40 ? other.avg : null
    const diff = split !== null ? a - split : null
    const verdict = diff === null ? '' : diff >= 0.03 ? ` — confirming a platoon advantage (+${Math.round(diff * 1000)} points) in his own numbers` : diff <= -0.03 ? ` — a reverse split (${Math.round(diff * 1000)} points), contradicting the usual platoon expectation` : ' — a minimal split, so handedness is not the story'
    if (o.category === 'Hits') {
      if (over ? a >= 0.285 : a <= 0.22) push(ev({ tier: 2, text: `${name} hits ${avg3(a)} (${m.platoon.ops} OPS, ${m.platoon.atBats} AB) vs ${handWord(m.hand)} pitching this season${split !== null ? ` vs ${avg3(split)} (${other!.ops}) vs the other side` : ''}${verdict} — ${m.pitcher} throws ${m.hand === 'L' ? 'left' : 'right'} tonight`, category: 'matchup', horizon: 'season', layer: 'opportunity', relevance: Math.min(1, 0.5 + Math.abs(a - 0.25) * 3), support: 'Platoon splits, this season', n: m.platoon.atBats }))
      else if (over ? a <= 0.2 : a >= 0.3) conflicts++
    } else if (bettingHr && over && m.platoon.homeRuns >= 3 && m.platoon.atBats >= 60) {
      push(ev({ tier: 2, text: `${name} has ${m.platoon.homeRuns} home runs in ${m.platoon.atBats} AB against ${handWord(m.hand)} pitching this season (one every ${Math.round(m.platoon.atBats / m.platoon.homeRuns)} AB)${verdict} — ${m.pitcher} throws ${m.hand === 'L' ? 'left' : 'right'} tonight`, category: 'matchup', horizon: 'season', layer: 'opportunity', relevance: 0.6, support: 'Platoon splits, this season', n: m.platoon.atBats }))
    }
  }
  if (m?.form.last10Avg != null && m.form.seasonAvg != null && o.category === 'Hits') {
    const d = m.form.last10Avg - m.form.seasonAvg
    if ((over && d >= 0.04) || (!over && d <= -0.04)) push(ev({ tier: 3, text: `${name} is hitting ${avg3(m.form.last10Avg)} over his last 10 games (${m.form.last10Ab} AB) — ${d > 0 ? 'above' : 'below'} his ${avg3(m.form.seasonAvg)} season average by ${Math.round(Math.abs(d) * 1000)} points, the form he carries into tonight`, category: 'recent_form', horizon: 'last15', relevance: Math.min(1, 0.5 + Math.abs(d) * 4), support: 'Last ten games against the season', n: 10, ageDays: 1, metrics: { avg: m.form.last10Avg, n: 10 } }))
    else if ((over && d <= -0.06) || (!over && d >= 0.06)) conflicts++
  }
  // Tier 3-5: the threshold record read against the season, the venue split, career against tonight's team.
  let streak = 0
  for (const g of (history?.games ?? []) as PlayerGameRecord[]) {
    const v = g.values['Hits']
    if (typeof v !== 'number' || v < 1) break
    streak++
  }
  merge(recentAtLine(o, history, 3, [7, 10, 15]))
  if (o.category === 'Hits' && over && streak >= 5) push(ev({ tier: 3, text: `${name} has a hit in ${streak} straight games heading into tonight vs a ${m?.form.seasonAvg != null ? `${avg3(m.form.seasonAvg)} season average` : 'season rate that does not usually run this long'} — the streak behind tonight's ${o.threshold} hits line`, category: 'recent_form', horizon: 'last15', relevance: Math.min(1, 0.5 + streak / 20), support: 'Game log', n: streak, ageDays: 1 }))
  merge(seasonAtLine(o, history, homeFlag))
  merge(vsOpponentCareer(o, history, 5))
  return { edges, conflicts }
}

export function mlbEvidence(input: ModuleInput): ModuleOutput {
  const o: BettingOutcome = input.outcome
  if (o.type === 'player_prop') return mlbProp(input)
  if (o.type === 'moneyline' || o.type === 'spread') return mlbSide(input)
  if (o.type === 'total') return mlbTotal(input)
  return { edges: [], conflicts: 0 }
}
