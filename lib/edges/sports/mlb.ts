import { slugify } from '@/lib/players/slug'
import type { StarterFacts } from '../data/mlb'
import type { ModuleInput } from '../modules/shared'
import type { BettingOutcome, Edge, GameContext, ModuleOutput, PlayerGameRecord, TeamGameRecord } from '../types'
import { avg3, ev, f1, f2, inn, lineText, mean, ordinal, plural, recRelevance, recText } from './format'
import { propName, recentAtLine, seasonAtLine, vsOpponentCareer } from './props'
import { atVenue, avgAgainst, avgFor, covers, currentSeason, games as played, postseason, recentSeasons, regular, totalSide, vsOpp, vsTier, wins, type Rec } from './records'

/**
 * MLB evidence, written the way a sharp bettor's notes read: W-L records at tonight's number, each team on its own line,
 * the starting pitchers against the exact lineup they face, bullpen workload from the last two days' boxscores, and the
 * weather at open-air parks. Every item is a real count or average; an item that does not point the bet's way is not
 * shown (it only lowers the grade).
 */

type Side = 'away' | 'home'

const ALIAS: Record<string, string> = { ARI: 'AZ', WAS: 'WSH', CWS: 'CHW', ATH: 'OAK' }
const same = (a: string, b: string) => (ALIAS[a] ?? a) === (ALIAS[b] ?? b)
const IP = inn

/** A bullpen counts as taxed with 6+ relief innings over the last two days, or 4+ innings per game it has played in them (a normal night is about three). */
const taxed = (p: { games: number; lastTwoDaysInnings: number } | null | undefined): p is { games: number; lastTwoDaysInnings: number } => !!p && p.games >= 1 && (p.lastTwoDaysInnings >= 6 || p.lastTwoDaysInnings / p.games >= 4)

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

function lastStartsEra(s: StarterFacts | null, n: number): { era: number; n: number; ip: number } | null {
  const l = s?.starts.slice(0, n) ?? []
  const ip = l.reduce((a, x) => a + x.ip, 0)
  return l.length >= Math.min(n, 3) && ip > 0 ? { era: (l.reduce((a, x) => a + x.er, 0) * 9) / ip, n: l.length, ip } : null
}

const handWord = (h: 'L' | 'R' | null) => (h === 'L' ? 'left-handed' : 'right-handed')
const seriesName = (game: GameContext) => (game.facts.mlb?.series ? (game.facts.mlb.series.short || game.facts.mlb.series.description).replace(/\s*Game \d+$/i, '') : '')

/** Wind, temperature and rain at an open-air park, as a short phrase; null at domes and closed roofs or when nothing stands out. */
function weatherNote(game: GameContext): { text: string; out: boolean; inward: boolean; hot: boolean; cold: boolean; rain: boolean } | null {
  const w = game.weather
  if (!w || w.indoor) return null
  const wind = w.windMph !== null && w.windMph >= 8 && w.windDirection ? `${Math.round(w.windMph)} mph wind ${w.windDirection}` : null
  const temp = w.tempF !== null ? `${Math.round(w.tempF)}°F` : null
  const out = !!wind && /\bout\b/i.test(w.windDirection ?? '') && (w.windMph ?? 0) >= 10
  const inward = !!wind && /\bin\b/i.test(w.windDirection ?? '') && (w.windMph ?? 0) >= 10
  const hot = (w.tempF ?? 0) >= 85
  const cold = w.tempF !== null && w.tempF <= 50
  if (!out && !inward && !hot && !cold && !w.precipitation) return null
  return { text: [temp, wind, w.precipitation ? 'rain in the forecast' : null].filter(Boolean).join(', '), out, inward, hot, cold, rain: w.precipitation }
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
  const push = (e: Edge) => edges.push(e)
  const post = seriesName(game) || 'postseason'

  // ---- Tier 1: tonight-specific context -------------------------------------------------------------------
  if (facts) {
    const pen = facts.bullpen[theirs]
    const ownPen = facts.bullpen[mine]
    if (taxed(pen) && pen) {
      push(
        ev({
          tier: 1,
          text: `${O}'s bullpen has thrown ${IP(pen.lastTwoDaysInnings)} innings over the last 2 days (${plural(pen.games, 'game')}${pen.usedYesterday.length ? `; ${pen.usedYesterday.slice(0, 3).join(', ')} pitched yesterday` : ''})${pen.era !== null ? ` and carries a ${f2(pen.era)} relief ERA this season` : ''} — fatigue in the late innings creates a scoring opportunity for ${T} tonight`,
          category: 'situational',
          horizon: 'tonight',
          layer: 'situational',
          relevance: Math.min(1, 0.55 + pen.lastTwoDaysInnings / 25),
          support: `${pen.games} ${O} game${pen.games === 1 ? '' : 's'} in the last two days`,
          n: pen.games,
          ageDays: 1,
        })
      )
    }
    if (taxed(ownPen)) conflicts++
    const kb = facts.keyBatsOut[theirs]
    if (kb.length > 0) {
      push(ev({ tier: 1, text: `${O} is without ${kb.slice(0, 2).map((b) => `${b.name} (${b.position}, wRC+ ${b.wrcPlus} over ${b.pa} PA)`).join(' and ')} tonight — a bat from the middle of their order out of the lineup`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: Math.min(1, 0.55 + kb.length * 0.1), support: 'Injury report with season wRC+', n: kb[0].pa, ageDays: 0 }))
    }
    if (facts.keyBatsOut[mine].length > 0) conflicts++

    // ---- Tier 2: the two starters against these exact lineups
    const sT = facts.starters[mine]
    const sO = facts.starters[theirs]
    const mineVs = startsVs(sT, O)
    if (sT && mineVs && mineVs.era <= 3.75) {
      push(ev({ tier: 2, text: `${sT.name}, ${T}'s starter tonight, has a ${f2(mineVs.era)} ERA vs ${O} this season in ${plural(mineVs.n, 'start')}${mineVs.avg !== null ? ` — ${O} is batting ${avg3(mineVs.avg)} against him (${mineVs.h} for ${mineVs.ab})` : ''}`, category: 'matchup', horizon: 'season_vs_opp', layer: 'opportunity', relevance: Math.min(1, 0.55 + (4.2 - mineVs.era) / 6), support: `${IP(mineVs.ip)} IP, ${mineVs.er} ER`, n: mineVs.n, metrics: { avg: mineVs.era, n: mineVs.n } }))
    } else if (sT && mineVs && mineVs.era >= 5.5) conflicts++
    else if (sT && !mineVs && sT.vsTeam && sT.vsTeam.avg <= 0.23) {
      push(ev({ tier: 2, text: `${sT.name}, ${T}'s starter tonight, has held ${O} to a ${avg3(sT.vsTeam.avg)} average (${sT.vsTeam.ops} OPS) over ${sT.vsTeam.pa} career PA in ${sT.vsTeam.games} games`, category: 'h2h', horizon: 'career_vs_opp', layer: 'statistical', relevance: 0.6, support: 'Career line against this team', n: sT.vsTeam.games, seasonsAgo: 1 }))
    }
    const theirVs = startsVs(sO, T)
    if (sO && theirVs && theirVs.era >= 5) {
      push(ev({ tier: 2, text: `${sO.name}, ${O}'s starter tonight, has a ${f2(theirVs.era)} ERA vs ${T} this season in ${plural(theirVs.n, 'start')}${theirVs.avg !== null ? ` — ${T} is batting ${avg3(theirVs.avg)} against him (${theirVs.h} for ${theirVs.ab})` : ''}`, category: 'matchup', horizon: 'season_vs_opp', layer: 'opportunity', relevance: Math.min(1, 0.55 + (theirVs.era - 4.2) / 8), support: `${IP(theirVs.ip)} IP, ${theirVs.er} ER`, n: theirVs.n, metrics: { avg: theirVs.era, n: theirVs.n } }))
    } else if (sO && theirVs && theirVs.era <= 2.5 && theirVs.n >= 2) conflicts++
    else if (sO && !theirVs && sO.vsTeam && sO.vsTeam.avg >= 0.29) {
      push(ev({ tier: 2, text: `${sO.name}, ${O}'s starter tonight, has allowed ${T} a ${avg3(sO.vsTeam.avg)} average (${sO.vsTeam.ops} OPS) over ${sO.vsTeam.pa} career PA in ${sO.vsTeam.games} games`, category: 'h2h', horizon: 'career_vs_opp', layer: 'statistical', relevance: 0.6, support: 'Career line against this team', n: sO.vsTeam.games, seasonsAgo: 1 }))
    }
    // The starting pitcher at tonight's park (home or road split).
    const venueOf = (s: StarterFacts | null, home: boolean) => s?.splits[home ? 'h' : 'a']
    const vT = venueOf(sT, homeFlag)
    if (sT && vT && vT.ip >= 20 && vT.era <= 3.5) {
      push(ev({ tier: 2, text: `${sT.name}, ${T}'s starter tonight, has a ${f2(vT.era)} ERA ${homeFlag ? 'at home' : 'on the road'} this season over ${IP(vT.ip)} IP${sT.season ? ` (${f2(sT.season.era)} overall)` : ''} — tonight's game is ${homeFlag ? 'at home' : 'on the road'}`, category: 'hit_rate', horizon: 'season', layer: 'statistical', relevance: Math.min(1, 0.5 + (3.9 - vT.era) / 6), support: `${homeFlag ? 'Home' : 'Road'} split`, n: Math.round(vT.ip) }))
    }
    const vO = venueOf(sO, !homeFlag)
    if (sO && vO && vO.ip >= 20 && vO.era >= 5) {
      push(ev({ tier: 2, text: `${sO.name}, ${O}'s starter tonight, has a ${f2(vO.era)} ERA ${!homeFlag ? 'at home' : 'on the road'} this season over ${IP(vO.ip)} IP${sO.season ? ` (${f2(sO.season.era)} overall)` : ''} — tonight's game is ${!homeFlag ? 'at home' : 'on the road'} for him`, category: 'hit_rate', horizon: 'season', layer: 'statistical', relevance: Math.min(1, 0.5 + (vO.era - 4.5) / 6), support: `${!homeFlag ? 'Home' : 'Road'} split`, n: Math.round(vO.ip) }))
    }
    // ---- The lineup against this starter, batter by batter.
    const lineup = facts.lineups[mine]
    if (lineup && sO && lineup.facedCount >= 3 && lineup.facedPa >= 20 && lineup.facedAvg !== null) {
      if (lineup.facedAvg >= 0.265) {
        push(ev({ tier: 2, text: `${lineup.facedCount} of ${lineup.batters.length} ${T} starters in tonight's lineup have faced ${sO.name} — hitting ${avg3(lineup.facedAvg)} combined over ${lineup.facedPa} career plate appearances${lineup.facedKPct !== null ? ` (${f1(lineup.facedKPct)}% strikeout rate)` : ''}`, category: 'h2h', horizon: 'career_vs_opp', layer: 'statistical', relevance: Math.min(1, 0.5 + (lineup.facedAvg - 0.25) * 3), support: 'Career batter-vs-pitcher lines, five or more PA each', n: lineup.facedPa, seasonsAgo: 1 }))
      } else if (lineup.facedAvg <= 0.2) conflicts++
    }
    // ---- Offense against the pitcher's handedness.
    const hand = sO?.hand
    const split = hand ? facts.teamVsHand[mine][hand === 'L' ? 'vl' : 'vr'] : null
    if (sO && hand && split) {
      if (split.avg >= 0.255 || Number(split.ops) >= 0.75) {
        push(ev({ tier: 2, text: `${T} is batting ${avg3(split.avg)} (${split.ops} OPS) against ${handWord(hand)} pitching this season over ${split.pa} PA — ${sO.name} throws ${hand === 'L' ? 'left' : 'right'} tonight`, category: 'matchup', horizon: 'season', layer: 'opportunity', relevance: Math.min(1, 0.5 + (split.avg - 0.24) * 4), support: 'Team split by pitcher handedness', n: split.pa }))
      } else if (split.avg <= 0.225) conflicts++
    }
    // ---- Tier 3: the two starters' last three starts, side by side.
    const a3 = lastStartsEra(sT, 3)
    const b3 = lastStartsEra(sO, 3)
    if (sT && sO && a3 && b3 && b3.era - a3.era >= 2) {
      push(ev({ tier: 3, text: `Last ${Math.min(a3.n, b3.n)} starts: ${sT.name} ${f2(a3.era)} ERA (${IP(a3.ip)} IP) vs ${sO.name} ${f2(b3.era)} ERA (${IP(b3.ip)} IP) — the pitching edge tonight belongs to ${T}`, category: 'recent_form', horizon: 'last15', layer: 'statistical', relevance: Math.min(1, 0.5 + (b3.era - a3.era) / 8), support: 'Most recent starts, regular season and postseason', n: Math.min(a3.n, b3.n), ageDays: 4, metrics: { avg: a3.era, n: a3.n } }))
    } else if (sT && sO && a3 && b3 && a3.era - b3.era >= 2) conflicts++
  }

  // ---- Tier 2 (records): this team against this opponent this season, postseason separated.
  const cur = currentSeason(game, T)
  const vsThis = vsOpp(cur, O)
  const r = tally(vsThis)
  if (played(r) >= 3 && r.w / played(r) >= 0.6) {
    const reg = tally(regular(vsThis))
    const ps = tally(postseason(vsThis))
    const split = played(ps) > 0 && played(reg) > 0 ? ` (regular season ${recText(reg)}, ${post} ${recText(ps)})` : ''
    push(ev({ tier: 2, text: `${T}'s ${ownRecWord} vs ${O} this season: ${recText(r)}${split}`, category: 'h2h', horizon: 'season_vs_opp', relevance: recRelevance(r.w, r.l), support: `${vsThis.length} meetings`, n: vsThis.length, metrics: { rate: r.w / played(r), n: played(r) } }))
  } else if (played(r) >= 3 && r.w / played(r) <= 0.34) conflicts++

  // ---- Tier 3: runs scored and allowed over the last 10 games, each team on its own.
  const last10 = (abbr: string) => (game.results[abbr] ?? []).slice(0, 10)
  const a = last10(T)
  const b = last10(O)
  if (a.length >= 7 && b.length >= 7) {
    const aM = avgFor(a) - avgAgainst(a)
    const bM = avgFor(b) - avgAgainst(b)
    if (aM - bM >= 1) {
      push(ev({ tier: 3, text: `Last ${a.length} games: ${T} scoring ${f1(avgFor(a))} runs per game and allowing ${f1(avgAgainst(a))}; ${O} scoring ${f1(avgFor(b))} and allowing ${f1(avgAgainst(b))} — ${T} has been the better team by ${f1(aM - bM)} runs per game`, category: 'recent_form', horizon: 'last15', relevance: Math.min(1, 0.45 + (aM - bM) / 5), support: `${T} ${recText(wins(a))} · ${O} ${recText(wins(b))} over those games`, n: Math.min(a.length, b.length), ageDays: 2, metrics: { avg: aM, n: a.length } }))
    } else if (bM - aM >= 1.5) conflicts++
  }

  // ---- Tier 4: situational records that match tonight.
  const venue = tally(atVenue(cur, homeFlag))
  if (played(venue) >= 8 && venue.w / played(venue) >= 0.58) {
    push(ev({ tier: 4, text: `${T}'s ${ownRecWord} ${homeFlag ? 'at home' : 'on the road'} this season: ${recText(venue)}`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(venue.w, venue.l), support: `${homeFlag ? 'Home' : 'Road'} games, regular season and postseason`, n: played(venue), metrics: { rate: venue.w / played(venue), n: played(venue) } }))
  }
  const oppPct = game.leagueWinPct[O]
  if (oppPct !== undefined) {
    const strong = oppPct >= 0.5
    const tier = tally(vsTier(cur, game, strong))
    if (played(tier) >= 10 && tier.w / played(tier) >= 0.58) {
      push(ev({ tier: 4, text: `${T}'s ${ownRecWord} vs teams ${strong ? 'at or above' : 'under'} .500 this season: ${recText(tier)} — ${O} is at ${oppPct.toFixed(3).replace(/^0/, '')}`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(tier.w, tier.l), support: 'Opponent quality from the standings', n: played(tier), metrics: { rate: tier.w / played(tier), n: played(tier) } }))
    }
  }
  const ps = tally(postseason(cur))
  if (played(ps) >= 4 && ps.w / played(ps) >= 0.65) {
    push(ev({ tier: 4, text: `${T}'s ${ownRecWord} in the postseason this season: ${recText(ps)}`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(ps.w, ps.l), support: 'Postseason games', n: played(ps) }))
  }
  // The opponent's mirror record: where it fails is where this bet wins.
  const oppCur = currentSeason(game, O)
  const oppVenue = atVenue(oppCur, !homeFlag)
  if (spread) {
    const mirror = covers(oppVenue, -line)
    if (played(mirror) >= 8 && mirror.w / played(mirror) <= 0.42) {
      push(ev({ tier: 4, text: `${O}'s record covering ${lineText(-line)} ${!homeFlag ? 'at home' : 'on the road'} this season: ${recText(mirror)} — the number ${O} has to cover tonight`, category: 'hit_rate', horizon: 'season', relevance: Math.min(1, 0.45 + (0.5 - mirror.w / played(mirror)) * 1.5), support: `${O}'s ${!homeFlag ? 'home' : 'road'} games`, n: played(mirror), metrics: { rate: 1 - mirror.w / played(mirror), n: played(mirror) } }))
    }
  } else {
    const theirs2 = wins(oppVenue)
    if (played(theirs2) >= 8 && theirs2.w / played(theirs2) <= 0.45) {
      push(ev({ tier: 4, text: `${O}'s record ${!homeFlag ? 'at home' : 'on the road'} this season: ${recText(theirs2)} — tonight's venue for ${O}`, category: 'hit_rate', horizon: 'season', relevance: Math.min(1, 0.45 + (0.5 - theirs2.w / played(theirs2)) * 1.5), support: `${O}'s ${!homeFlag ? 'home' : 'road'} games`, n: played(theirs2) }))
    }
  }

  // ---- Tier 6: the last two seasons against this opponent, only when lopsided.
  const two = recentSeasons(game, T, 2).filter((g) => same(g.opp, O) && !g.playoff)
  const tw = tally(two)
  if (played(tw) >= 6 && tw.w / played(tw) >= 0.7) {
    push(ev({ tier: 6, text: `${T}'s ${ownRecWord} vs ${O} over the last two regular seasons: ${recText(tw)}`, category: 'h2h', horizon: 'career_vs_opp', relevance: recRelevance(tw.w, tw.l), support: 'Two most recent regular seasons', n: played(tw), seasonsAgo: 1 }))
  }
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

  // ---- Tier 1: weather at the park, then bullpens that are worn down.
  const wx = weatherNote(game)
  if (wx) {
    const helpsOver = wx.out || wx.hot
    const helpsUnder = wx.inward || wx.cold || wx.rain
    if ((over && helpsOver) || (!over && helpsUnder)) {
      push(ev({ tier: 1, text: `${wx.text} at ${H}'s park tonight — ${over ? (wx.out ? 'wind blowing out helps fly balls carry' : 'heat helps the ball carry') : wx.inward ? 'wind blowing in knocks down fly balls' : wx.rain ? 'wet conditions favor pitchers' : 'cold air keeps the ball in the park'}, supporting the ${word.toLowerCase()} ${total}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.65, support: 'Game-time weather at an open-air park', ageDays: 0 }))
    } else if ((over && helpsUnder) || (!over && helpsOver)) conflicts++
  }
  if (facts) {
    const tired = (['away', 'home'] as Side[]).map((s) => ({ s, p: facts.bullpen[s] })).filter((x): x is { s: Side; p: NonNullable<typeof x.p> } => taxed(x.p))
    if (over && tired.length > 0) {
      push(ev({ tier: 1, text: `${tired.map((x) => `${x.p.team}'s bullpen has thrown ${IP(x.p.lastTwoDaysInnings)} innings over the last 2 days (${plural(x.p.games, 'game')})`).join('; ')} — worn relievers raise the odds of late runs against tonight's ${total} total`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: Math.min(1, 0.5 + tired.length * 0.1), support: 'Boxscores from the last two days', n: tired.length, ageDays: 1 }))
    } else if (!over && tired.length > 0) conflicts++
    const kb = [...facts.keyBatsOut.away.map((b) => ({ ...b, team: A })), ...facts.keyBatsOut.home.map((b) => ({ ...b, team: H }))]
    if (!over && kb.length > 0) {
      push(ev({ tier: 1, text: `${kb.slice(0, 2).map((b) => `${b.team} is without ${b.name} (wRC+ ${b.wrcPlus})`).join('; ')} — a top bat out of the lineup trims tonight's run production`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.55, support: 'Injury report with season wRC+', n: kb[0].pa, ageDays: 0 }))
    } else if (over && kb.length > 0) conflicts++

    // ---- Tier 2: each starter against the lineup he faces.
    const parts: { s: StarterFacts | null; faces: string; side: Side }[] = [
      { s: facts.starters.away, faces: H, side: 'away' },
      { s: facts.starters.home, faces: A, side: 'home' },
    ]
    const lines: string[] = []
    let supportive = 0
    let against = 0
    for (const p of parts) {
      const vs = startsVs(p.s, p.faces)
      if (!p.s || !vs) continue
      const good = over ? vs.era >= 4.75 : vs.era <= 3.25
      const bad = over ? vs.era <= 2.75 : vs.era >= 5
      if (good) supportive++
      if (bad) against++
      lines.push(`${p.s.name} (tonight's starter) ERA vs ${p.faces} this season: ${f2(vs.era)} in ${vs.n} start${vs.n === 1 ? '' : 's'}${vs.avg !== null ? ` (${p.faces} batting ${avg3(vs.avg)})` : ''}`)
    }
    if (supportive >= 1 && supportive >= against) {
      push(ev({ tier: 2, text: `${lines.join('; ')} — ${over ? 'lineups that have already hit them' : 'lineups they have already handled'} and face again tonight`, category: 'matchup', horizon: 'season_vs_opp', layer: 'opportunity', relevance: 0.55 + supportive * 0.1, support: 'Starts this season, regular season and postseason', n: lines.length }))
    } else if (against > supportive) conflicts++
    // Venue splits and the home-run rate.
    const homeS = facts.starters.home
    const awayS = facts.starters.away
    const hv = homeS?.splits.h
    const av = awayS?.splits.a
    if (hv && av && hv.ip >= 15 && av.ip >= 15) {
      const bothHigh = hv.era >= 4.5 && av.era >= 4.5
      const bothLow = hv.era <= 3.5 && av.era <= 3.5
      if ((over && bothHigh) || (!over && bothLow)) {
        push(ev({ tier: 2, text: `${homeS!.name}'s ERA at home this season: ${f2(hv.era)} over ${IP(hv.ip)} IP; ${awayS!.name}'s ERA on the road: ${f2(av.era)} over ${IP(av.ip)} IP — each at tonight's venue`, category: 'hit_rate', horizon: 'season', layer: 'statistical', relevance: 0.6, support: 'Home and road splits', n: Math.round(Math.min(hv.ip, av.ip)) }))
      } else if ((over && bothLow) || (!over && bothHigh)) conflicts++
    }
    const hr9 = (s: StarterFacts | null) => {
      const l = s?.starts.slice(0, 5) ?? []
      const ip = l.reduce((n, x) => n + x.ip, 0)
      return l.length >= 3 && ip > 0 ? { v: (l.reduce((n, x) => n + x.hr, 0) * 9) / ip, n: l.length } : null
    }
    const hA = hr9(awayS)
    const hH = hr9(homeS)
    if (over && hA && hH && hA.v >= 1.3 && hH.v >= 1.3) {
      push(ev({ tier: 2, text: `HR/9 over the last 5 starts: ${awayS!.name} ${f1(hA.v)}, ${homeS!.name} ${f1(hH.v)} — both are giving up the long ball into tonight's game`, category: 'recent_form', horizon: 'last30', layer: 'statistical', relevance: 0.6, support: 'Last five starts each', n: Math.min(hA.n, hH.n), ageDays: 4 }))
    }
    // Bullpen quality, each side separately.
    const pA = facts.bullpen.away
    const pH = facts.bullpen.home
    if (pA?.era != null && pH?.era != null && pA.ip >= 50 && pH.ip >= 50) {
      if ((over && pA.era >= 4.3 && pH.era >= 4.3) || (!over && pA.era <= 3.5 && pH.era <= 3.5)) {
        push(ev({ tier: 2, text: `Relief ERA this season: ${A} ${f2(pA.era)}, ${H} ${f2(pH.era)} — ${over ? 'neither bullpen has held leads' : 'both bullpens have shut games down'}`, category: 'hit_rate', horizon: 'season', layer: 'statistical', relevance: 0.55, support: 'Team relief splits', n: Math.round(Math.min(pA.ip, pH.ip)) }))
      } else if ((over && pA.era <= 3.5 && pH.era <= 3.5) || (!over && pA.era >= 4.3 && pH.era >= 4.3)) conflicts++
    }
  }

  // ---- Tier 3: recent scoring, each team separately, with the combined figure only as the closing summary.
  const l10 = (abbr: string) => (game.results[abbr] ?? []).slice(0, 10)
  const a10 = l10(A)
  const h10 = l10(H)
  if (a10.length >= 7 && h10.length >= 7) {
    const combined = avgFor(a10) + avgFor(h10)
    const gap = combined - total
    if ((over && gap >= 0.5) || (!over && gap <= -0.5)) {
      push(ev({ tier: 3, text: `${A}: scoring ${f1(avgFor(a10))} runs per game over the last ${a10.length}; ${H}: scoring ${f1(avgFor(h10))} over the last ${h10.length} — combined ${f1(combined)} against tonight's ${total} line`, category: 'recent_form', horizon: 'last15', relevance: Math.min(1, 0.45 + Math.abs(gap) / 3), support: `${A} allowed ${f1(avgAgainst(a10))}, ${H} allowed ${f1(avgAgainst(h10))} over the same games`, n: Math.min(a10.length, h10.length), ageDays: 2 }))
    } else if ((over && gap <= -0.5) || (!over && gap >= 0.5)) conflicts++
  }
  const sideRec = (abbr: string, n: number) => totalSide(l10(abbr).slice(0, n), total, over)
  const ra = sideRec(A, 10)
  const rh = sideRec(H, 10)
  if (played(ra) >= 7 && played(rh) >= 7 && (ra.w + rh.w) / (played(ra) + played(rh)) >= 0.6) {
    push(ev({ tier: 3, text: `${A}: ${word} ${total} in ${ra.w} of the last ${played(ra)} games; ${H}: ${word} ${total} in ${rh.w} of the last ${played(rh)}`, category: 'recent_form', horizon: 'last15', relevance: recRelevance(ra.w + rh.w, played(ra) + played(rh) - ra.w - rh.w), support: 'Final scores against tonight\'s number', n: Math.min(played(ra), played(rh)), ageDays: 2, metrics: { rate: (ra.w + rh.w) / (played(ra) + played(rh)), n: played(ra) } }))
  } else if (played(ra) >= 7 && played(rh) >= 7 && (ra.w + rh.w) / (played(ra) + played(rh)) <= 0.4) conflicts++

  // ---- Tier 4/5: each team's season record at this number, then at tonight's venue.
  const curA = currentSeason(game, A)
  const curH = currentSeason(game, H)
  const sa = totalSide(curA, total, over)
  const sh = totalSide(curH, total, over)
  const seasonPct = (r: Rec) => r.w / Math.max(1, played(r))
  if (played(sa) >= 20 && played(sh) >= 20) {
    const both = (sa.w + sh.w) / (played(sa) + played(sh))
    if (both >= 0.54) {
      push(ev({ tier: 5, text: `${A}: ${word} ${total} in ${sa.w} of ${curA.length} games this season (${Math.round(seasonPct(sa) * 100)}%); ${H}: ${word} ${total} in ${sh.w} of ${curH.length} games (${Math.round(seasonPct(sh) * 100)}%)`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(sa.w + sh.w, played(sa) + played(sh) - sa.w - sh.w), support: 'Final scores this season, postseason included', n: Math.min(curA.length, curH.length), metrics: { rate: both, n: curA.length } }))
    } else if (both <= 0.44) conflicts++
    const va = totalSide(atVenue(curA, false), total, over)
    const vh = totalSide(atVenue(curH, true), total, over)
    if (played(va) >= 15 && played(vh) >= 15 && (va.w + vh.w) / (played(va) + played(vh)) >= 0.58) {
      push(ev({ tier: 4, text: `${A} on the road: ${word} ${total} in ${va.w} of ${played(va) + va.p} games; ${H} at home: ${word} ${total} in ${vh.w} of ${played(vh) + vh.p} games — the venue split for tonight's game`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(va.w + vh.w, played(va) + played(vh) - va.w - vh.w), support: 'Road games for the visitor, home games for the host', n: Math.min(played(va), played(vh)) }))
    }
  }
  const psA = totalSide(postseason(curA), total, over)
  const psH = totalSide(postseason(curH), total, over)
  if (played(psA) + played(psH) >= 6 && (psA.w + psH.w) / (played(psA) + played(psH)) >= 0.65) {
    push(ev({ tier: 4, text: `Postseason: ${A} ${word} ${total} in ${psA.w} of ${played(psA) + psA.p}; ${H} ${word} ${total} in ${psH.w} of ${played(psH) + psH.p}`, category: 'hit_rate', horizon: 'season', relevance: 0.55, support: 'Postseason games this season', n: played(psA) + played(psH) }))
  }
  // Tier 2: this season's meetings, separated by who scored.
  const meet = vsOpp(curA, H)
  if (meet.length >= 3) {
    const r = totalSide(meet, total, over)
    if (r.w / Math.max(1, played(r)) >= 0.6) {
      push(ev({ tier: 2, text: `${A} vs ${H} this season: ${word} ${total} in ${r.w} of ${meet.length} meetings — ${A} scoring ${f1(avgFor(meet))} per game, ${H} scoring ${f1(avgAgainst(meet))}`, category: 'h2h', horizon: 'season_vs_opp', relevance: recRelevance(r.w, played(r) - r.w), support: `${meet.length} games between these teams`, n: meet.length }))
    } else if (r.w / Math.max(1, played(r)) <= 0.34) conflicts++
  }
  return { edges, conflicts }
}

// ---------------------------------------------------------------------------
// Player props
// ---------------------------------------------------------------------------

function hitStreak(games: PlayerGameRecord[]): number {
  let n = 0
  for (const g of games) {
    const v = g.values['Hits']
    if (typeof v !== 'number') break
    if (v >= 1) n++
    else break
  }
  return n
}

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
    const leagueK = (() => {
      const vals = Object.values(game.defense).map((d) => d['Strikeout rate']?.value).filter((v): v is number => typeof v === 'number')
      return vals.length >= 20 ? mean(vals) : null
    })()
    // Tier 1: the lineup's strikeout rate against this handedness (the primary driver).
    const teamHand = hand ? facts.teamVsHand[oppSide][hand === 'L' ? 'vl' : 'vr'] : null
    const kRate = lineup?.kPctVsHand ?? teamHand?.kPct ?? null
    const kPa = lineup?.kPctVsHand != null ? lineup.paVsHand : (teamHand?.pa ?? 0)
    if (kRate !== null && leagueK !== null && hand) {
      const gap = kRate - leagueK
      if ((over && gap >= 1.5) || (!over && gap <= -1.5)) {
        const mix = lineup ? `; ${lineup.lefties} of ${lineup.batters.length} in the posted lineup bat left-handed` : '; the lineup is not posted yet, so this is the team rate'
        edges.push(ev({ tier: 1, text: `${opp} strikes out in ${f1(kRate)}% of plate appearances against ${handWord(hand)} pitching (${kPa} PA this season) vs a league rate of ${f1(leagueK)}% — ${name} is ${hand === 'L' ? 'a lefty' : 'a righty'}${mix}`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: Math.min(1, 0.55 + Math.abs(gap) / 8), support: lineup ? "Tonight's posted lineup" : 'Team split by pitcher handedness', n: kPa, metrics: { rate: kRate / 100, n: kPa } }))
      } else if ((over && gap <= -1.5) || (!over && gap >= 1.5)) conflicts++
    }
    // Tier 1: short rest.
    if (starter.restDays !== null && starter.restDays <= 3) {
      if (!over) edges.push(ev({ tier: 1, text: `${name} is working on ${starter.restDays} days of rest tonight — short rest tends to cut innings and strikeouts, favoring the under ${line}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.6, support: 'Days since his last start', ageDays: 0 }))
      else conflicts++
    }
    // Tier 2: this season and career against tonight's opponent.
    const vs = startsVs(starter, opp)
    const vsStarts = starter.starts.filter((s) => same(s.opp, opp))
    if (vsStarts.length >= 1) {
      const ks = vsStarts.map((s) => s.k)
      const hits = ks.filter((k) => (over ? k > line : k < line)).length
      if (hits / ks.length >= 0.6) {
        edges.push(ev({ tier: 2, text: `${name} vs ${opp} this season: ${ks.join(', ')} strikeouts in ${ks.length} start${ks.length === 1 ? '' : 's'} (${word} ${line} in ${hits} of ${ks.length})${vs ? `, ${f2(vs.era)} ERA` : ''}`, category: 'h2h', horizon: 'season_vs_opp', relevance: recRelevance(hits, ks.length - hits), support: 'This season, postseason included', n: ks.length }))
      } else if (hits / ks.length <= 0.34 && ks.length >= 2) conflicts++
    }
    const career = starter.vsTeam
    if (career && starter.season && starter.season.kPct > 0) {
      const gap = (career.kPct - starter.season.kPct) / starter.season.kPct
      if ((over && gap >= 0.1) || (!over && gap <= -0.1)) {
        edges.push(ev({ tier: 2, text: `${name}'s career vs ${opp}: ${f1(career.kPct)}% strikeout rate (${f1(starter.season.kPct)}% this season) with hitters batting ${avg3(career.avg)} over ${career.pa} PA in ${career.games} games`, category: 'h2h', horizon: 'career_vs_opp', relevance: Math.min(1, 0.45 + Math.abs(gap)), support: 'Career line against this team', n: career.games, seasonsAgo: 1 }))
      }
    }
    if (lineup && lineup.facedCount >= 3 && lineup.facedPa >= 20 && lineup.facedKPct !== null) {
      const good = over ? lineup.facedKPct >= 24 : lineup.facedKPct <= 17
      if (good) edges.push(ev({ tier: 2, text: `${lineup.facedCount} of ${lineup.batters.length} ${opp} starters have faced ${name} (${lineup.facedPa} career PA): ${f1(lineup.facedKPct)}% strikeout rate and ${lineup.facedAvg !== null ? avg3(lineup.facedAvg) : '—'} average`, category: 'h2h', horizon: 'career_vs_opp', relevance: Math.min(1, 0.5 + lineup.facedPa / 200), support: 'Career batter-vs-pitcher, five or more PA each', n: lineup.facedPa, seasonsAgo: 1 }))
    }
    // Tier 3: the last five starts at the line, and the opposing lineup's recent strikeout rate.
    const last5 = starter.starts.slice(0, 5)
    if (last5.length >= 3) {
      const ks = last5.map((s) => s.k)
      const hits = ks.filter((k) => (over ? k > line : k < line)).length
      if (hits / last5.length >= 0.6) {
        edges.push(ev({ tier: 3, text: `${name}'s last ${last5.length} starts: ${ks.join(', ')} strikeouts (most recent first) — ${word} ${line} in ${hits} of ${last5.length}, averaging ${f1(mean(last5.map((s) => s.ip)))} innings per start`, category: 'recent_form', horizon: 'last30', relevance: recRelevance(hits, last5.length - hits), support: last5.map((s) => `${s.k} K, ${IP(s.ip)} IP vs ${s.opp}`).join(' · '), n: last5.length, ageDays: 4, metrics: { rate: hits / last5.length, avg: mean(ks), n: last5.length } }))
      } else if (hits / last5.length <= 0.34) conflicts++
    }
    const rec = facts.recent[oppSide].d15
    const seasonK = game.defense[opp]?.['Strikeout rate']?.value
    if (rec && seasonK !== undefined && rec.games >= 5) {
      const gap = rec.kPct - seasonK
      if ((over && gap >= 1.5) || (!over && gap <= -1.5)) {
        edges.push(ev({ tier: 3, text: `${opp}'s lineup has struck out in ${f1(rec.kPct)}% of plate appearances over its last ${rec.games} games (${f1(seasonK)}% for the season)`, category: 'recent_form', horizon: 'last15', relevance: Math.min(1, 0.45 + Math.abs(gap) / 8), support: 'Team hitting, last 15 days', n: rec.games, ageDays: 1 }))
      }
    }
    return { edges, conflicts }
  }

  // ----------------------------------------------------------------------- hitters (Hits, Home Runs)
  const oppSide: Side = o.homeAway === 'home' ? 'away' : 'home'
  const starter = facts?.starters[oppSide] ?? null
  const m = extras?.hitterMatchup
  const opp = o.opponent ?? ''

  // Tier 1: the opposing bullpen's workload and the wind, where it matters.
  const pen = facts?.bullpen[oppSide]
  if (over && taxed(pen) && pen) {
    edges.push(ev({ tier: 1, text: `${opp}'s bullpen has thrown ${IP(pen.lastTwoDaysInnings)} innings over the last 2 days — ${name} sees tired relievers in the later plate appearances tonight`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.55, support: 'Boxscores from the last two days', n: pen.games, ageDays: 1 }))
  }
  const wx = weatherNote(game)
  if (wx && o.category === 'Home Runs') {
    if (over && (wx.out || wx.hot)) edges.push(ev({ tier: 1, text: `${wx.text} at ${game.home}'s park tonight — ${wx.out ? 'wind blowing out helps fly balls carry' : 'heat helps the ball carry'} for ${name}'s power`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.6, support: 'Game-time weather at an open-air park', ageDays: 0 }))
    else if (!over && (wx.inward || wx.cold || wx.rain)) edges.push(ev({ tier: 1, text: `${wx.text} at ${game.home}'s park tonight — ${wx.inward ? 'wind blowing in knocks down fly balls' : 'conditions favor pitchers'}, supporting the under`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.6, support: 'Game-time weather at an open-air park', ageDays: 0 }))
    else if ((over && (wx.inward || wx.cold)) || (!over && wx.out)) conflicts++
  }
  // The batting-order slot from the posted lineup.
  if (game.mlb && o.homeAway) {
    const slot = game.mlb.lineups[o.homeAway].indexOf(slugify(o.player.name)) + 1
    if (slot > 0) {
      if (over && slot <= 3) edges.push(ev({ tier: 1, text: `${name} bats ${slot === 1 ? 'leadoff' : slot === 2 ? 'second' : 'third'} tonight — the top of the order sees the most plate appearances`, category: 'role', horizon: 'tonight', layer: 'opportunity', relevance: slot === 3 ? 0.55 : 0.65, support: `Posted lineup, slot ${slot}`, ageDays: 0 }))
      else if (over && slot >= 7) conflicts++
      else if (!over && slot >= 7) edges.push(ev({ tier: 1, text: `${name} bats ${ordinal(slot)} tonight — fewer plate appearances than the top of the order`, category: 'role', horizon: 'tonight', layer: 'opportunity', relevance: 0.55, support: `Posted lineup, slot ${slot}`, ageDays: 0 }))
    }
  }

  // Tier 2: career against tonight's starter (five or more PA), the platoon split, and the starter's recent hits allowed.
  if (m?.vs && m.vs.plateAppearances >= 5) {
    const { hits, atBats, plateAppearances, homeRuns, strikeOuts, avg } = m.vs
    if (o.category === 'Hits') {
      const good = over ? avg >= 0.3 : avg <= 0.15
      if (good) edges.push(ev({ tier: 2, text: `${name} vs ${m.pitcher}: ${hits} for ${atBats} (${avg3(avg)}) with ${plural(strikeOuts, 'strikeout')} over ${plateAppearances} career PA${homeRuns ? `, ${homeRuns} HR` : ''}`, category: 'h2h', horizon: 'career_vs_opp', layer: 'statistical', relevance: Math.min(1, 0.5 + Math.abs(avg - 0.25) * 2.5), support: 'Career batter-vs-pitcher', n: plateAppearances, seasonsAgo: 1 }))
      else if (over ? avg <= 0.15 : avg >= 0.3) conflicts++
    } else if (o.category === 'Home Runs' && plateAppearances >= 10) {
      if (over && homeRuns >= 1) edges.push(ev({ tier: 2, text: `${name} vs ${m.pitcher}: ${homeRuns} HR in ${atBats} AB (${hits} for ${atBats}, ${plural(strikeOuts, 'strikeout')}) over ${plateAppearances} career PA`, category: 'h2h', horizon: 'career_vs_opp', layer: 'statistical', relevance: 0.6, support: 'Career batter-vs-pitcher', n: plateAppearances, seasonsAgo: 1 }))
      else if (!over && homeRuns === 0) edges.push(ev({ tier: 2, text: `${name} vs ${m.pitcher}: no home runs in ${atBats} AB (${hits} for ${atBats}) over ${plateAppearances} career PA`, category: 'h2h', horizon: 'career_vs_opp', layer: 'statistical', relevance: 0.55, support: 'Career batter-vs-pitcher', n: plateAppearances, seasonsAgo: 1 }))
    }
  }
  if (m?.platoon && m.hand && m.platoon.atBats >= 40) {
    const a = m.platoon.avg
    if (o.category === 'Hits') {
      if (over ? a >= 0.285 : a <= 0.22) edges.push(ev({ tier: 2, text: `${name} is hitting ${avg3(a)} (${m.platoon.ops} OPS) against ${handWord(m.hand)} pitching this season over ${m.platoon.atBats} AB — ${m.pitcher} throws ${m.hand === 'L' ? 'left' : 'right'} tonight`, category: 'matchup', horizon: 'season', layer: 'opportunity', relevance: Math.min(1, 0.5 + Math.abs(a - 0.25) * 3), support: 'Platoon split', n: m.platoon.atBats }))
      else if (over ? a <= 0.2 : a >= 0.3) conflicts++
    } else if (o.category === 'Home Runs' && over && m.platoon.homeRuns >= 3 && m.platoon.atBats >= 60) {
      edges.push(ev({ tier: 2, text: `${name} has ${m.platoon.homeRuns} home runs in ${m.platoon.atBats} AB against ${handWord(m.hand)} pitching this season — ${m.pitcher} throws ${m.hand === 'L' ? 'left' : 'right'} tonight`, category: 'matchup', horizon: 'season', layer: 'opportunity', relevance: 0.6, support: 'Platoon split', n: m.platoon.atBats }))
    }
  }
  if (starter) {
    const l3 = starter.starts.slice(0, 3)
    const ip = l3.reduce((n, x) => n + x.ip, 0)
    if (l3.length >= 3 && ip > 0) {
      const h9 = (l3.reduce((n, x) => n + x.h, 0) * 9) / ip
      const hr9 = (l3.reduce((n, x) => n + x.hr, 0) * 9) / ip
      if (o.category === 'Hits' && (over ? h9 >= 9.5 : h9 <= 6.5)) {
        edges.push(ev({ tier: 2, text: `${starter.name} has allowed ${l3.reduce((n, x) => n + x.h, 0)} hits in ${IP(ip)} IP over his last 3 starts (${f1(h9)} per nine) — tonight's starter against ${name}'s team`, category: 'matchup', horizon: 'last15', layer: 'opportunity', relevance: Math.min(1, 0.5 + Math.abs(h9 - 8) / 6), support: 'Last three starts', n: 3, ageDays: 4 }))
      } else if (o.category === 'Home Runs' && over && hr9 >= 1.4) {
        edges.push(ev({ tier: 2, text: `${starter.name} has allowed ${l3.reduce((n, x) => n + x.hr, 0)} home runs in ${IP(ip)} IP over his last 3 starts (${f1(hr9)} HR/9) — tonight's starter against ${name}'s team`, category: 'matchup', horizon: 'last15', layer: 'opportunity', relevance: Math.min(1, 0.5 + (hr9 - 1.2) / 3), support: 'Last three starts', n: 3, ageDays: 4 }))
      }
    }
  }

  // Tier 3-5: form at the line, this season's venue split, career against tonight's team.
  merge(recentAtLine(o, history))
  if (o.category === 'Hits' && over) {
    const streak = hitStreak(history?.games ?? [])
    if (streak >= 5) edges.push(ev({ tier: 3, text: `${name} has a hit in ${streak} straight games heading into tonight`, category: 'recent_form', horizon: 'last15', relevance: Math.min(1, 0.5 + streak / 20), support: 'Game log', n: streak, ageDays: 1 }))
  }
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
