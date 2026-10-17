import { slugify } from '@/lib/players/slug'
import type { NflGameFacts, NflPlayerFacts, PosKey } from '../data/nfl'
import type { Rec as LineRec } from '../data/lines'
import { cfbOpponentWeight } from '../data/cfb'
import { scriptOf, type ModuleInput } from '../modules/shared'
import type { BettingOutcome, Edge, GameContext, ModuleOutput, TeamGameRecord } from '../types'
import { ev, f1, lineText, mean, ordinal, plural, recRelevance, recText, signed } from './format'
import { foundationEdges } from './foundationItems'
import { propLine, propName, recentAtLine, seasonAtLine, vsOpponentCareer } from './props'
import { atVenue, avgAgainst, avgFor, covers, currentSeason, games as played, recentSeasons, totalSide, wins, type Rec } from './records'

/**
 * Football evidence (NFL and college), built on the game foundation: the style matchup, the quality-adjusted record, venue
 * and climate history, the weather's effect on specific positions, and who is out or back with what it changes. On top of
 * that sit the bet-specific items - ATS records in tonight's exact spot, scoring matchups with the opponent's quality, and
 * for props the role (target share, snaps, carries) behind the threshold against the position-specific defense. College
 * adds conference records and weights opponents by tier (power conference 1.3x, others 0.8x); target shares, snap counts and
 * depth charts are NFL-only.
 */

type Fb = 'nfl' | 'cfb'

const toLineRec = (r: LineRec): Rec => ({ w: r.w, l: r.l, p: r.p })
const oppTierScale = (game: GameContext, sport: Fb, opp: string) => (sport === 'cfb' ? (cfbOpponentWeight(game.conference[opp], opp) ?? 1) : 1)
const pct = (r: number) => `${Math.round(r * 100)}%`

/** Tonight's role from the line: favorite or underdog, home or road. */
function roleKey(home: boolean, line: number | null): 'homeFav' | 'homeDog' | 'roadFav' | 'roadDog' | null {
  if (line === null || line === 0) return null
  return home ? (line < 0 ? 'homeFav' : 'homeDog') : line < 0 ? 'roadFav' : 'roadDog'
}
const ROLE_WORD = { homeFav: 'a home favorite', homeDog: 'a home underdog', roadFav: 'a road favorite', roadDog: 'a road underdog' }

/** League average of a per-defense figure (for "vs the league average" comparisons). */
function leagueMean(facts: NflGameFacts | null | undefined, pick: (v: NflGameFacts['vsPosition'][string]) => number): number | null {
  const vals = Object.values(facts?.vsPosition ?? {}).map(pick).filter((x) => x > 0)
  return vals.length >= 16 ? mean(vals) : null
}

/** This team's regular-season results keyed by week (oldest first results aligned with the weeks the team played). */
function weekResults(game: GameContext, team: string): Map<number, TeamGameRecord> {
  const weeks = game.facts.nfl?.teamWeeks[team]?.map((w) => w.week) ?? []
  const asc = currentSeason(game, team).filter((g) => !g.playoff).reverse()
  const out = new Map<number, TeamGameRecord>()
  if (weeks.length === asc.length) weeks.forEach((w, i) => out.set(w, asc[i]))
  return out
}

/** The team's pass share of plays in its wins against its losses this season. */
function passByResult(game: GameContext, team: string): { win: { pct: number; n: number } | null; loss: { pct: number; n: number } | null } {
  const tw = game.facts.nfl?.teamWeeks[team] ?? []
  const res = weekResults(game, team)
  const acc = { win: { att: 0, car: 0, n: 0 }, loss: { att: 0, car: 0, n: 0 } }
  for (const w of tw) {
    const g = res.get(w.week)
    if (!g || g.us === g.them) continue
    const k = g.us > g.them ? acc.win : acc.loss
    k.att += w.att
    k.car += w.carries
    k.n++
  }
  const mk = (a: { att: number; car: number; n: number }) => (a.n >= 1 && a.att + a.car > 0 ? { pct: a.att / (a.att + a.car), n: a.n } : null)
  return { win: mk(acc.win), loss: mk(acc.loss) }
}

/** Points a defense has allowed, split by whether the offense it faced was at or above .500. */
function allowedByQuality(game: GameContext, team: string, last: number): { all: number; vsGood: number | null; nGood: number; n: number } {
  const gs = (game.results[team] ?? []).filter((g) => !g.playoff).slice(0, last)
  const good = gs.filter((g) => (game.leagueWinPct[g.opp] ?? -1) >= 0.5)
  return { all: avgAgainst(gs), vsGood: good.length >= 2 ? avgAgainst(good) : null, nGood: good.length, n: gs.length }
}

// ---------------------------------------------------------------------------
// Spread and moneyline
// ---------------------------------------------------------------------------

function fbSide({ outcome: o, game }: ModuleInput, sport: Fb): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  const t = o.team
  if (!t) return { edges, conflicts }
  const T = t.abbr
  const O = t.opponent
  const spread = o.type === 'spread' && o.threshold !== undefined
  const line = spread ? (o.threshold as number) : (scriptOf(game, T).margin !== null ? -(scriptOf(game, T).margin as number) : null)
  const home = t.home
  const push = (e: Edge) => edges.push(e)
  const facts = game.facts.nfl
  const lines = game.facts.lines
  const mineLines = T === game.home ? lines?.home : lines?.away
  const atsOrSu = (r: { ats: LineRec; su: LineRec }) => (spread ? r.ats : r.su)
  const recWord = spread ? 'record against the spread' : 'straight-up record'
  const betWord = spread ? `${lineText(o.threshold as number)} spread` : 'moneyline'
  const scale = oppTierScale(game, sport, O)

  // ---- The game foundation: style matchup, quality-adjusted record, venue and climate history, weather, roster.
  const f = foundationEdges(o, game)
  edges.push(...f.edges)
  conflicts += f.conflicts

  // ---- Tier 1: rest and schedule spots.
  const r1 = game.rest[T]
  const r2 = game.rest[O]
  if (r1 !== null && r1 !== undefined && r2 !== null && r2 !== undefined) {
    if (r1 >= 12 && r1 - r2 >= 3) {
      const bye = mineLines ? toLineRec(atsOrSu(mineLines.spots.offBye)) : null
      push(ev({ tier: 1, text: `${T} is coming off a bye with ${r1} days of rest vs ${r2} for ${O}${bye && played(bye) >= 2 ? ` — ${T}'s ${recWord} off a bye this season: ${recText(bye)}` : ''} — the extra preparation time applies to tonight's ${betWord}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: Math.min(1, 0.55 + (r1 - r2) / 14), support: 'Days since each team last played', n: bye ? played(bye) : 1, ageDays: 0 }))
    } else if (r1 - r2 >= 3) {
      push(ev({ tier: 1, text: `${T} has ${r1} days of rest vs ${r2} for ${O} tonight${r2 <= 5 ? ` — ${O} is on a short week` : ''}, a rest edge in tonight's ${betWord}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: Math.min(1, 0.5 + (r1 - r2) / 12), support: 'Days since each team last played', n: 1, ageDays: 0 }))
    } else if (r2 - r1 >= 3) conflicts++
  }

  // ---- Tier 2: the soft spots in the defense T attacks, against the league average, and the last two seasons against this opponent.
  const v = facts?.vsPosition[O]
  if (v) {
    const lgPass = leagueMean(facts, (x) => x.allowed.QB.passYdsPg)
    const lgRush = leagueMean(facts, (x) => x.allowed.RB.rushYdsPg)
    const soft: string[] = []
    if (v.rank.QB.passYds > 0 && v.rank.QB.passYds <= 8) soft.push(`${f1(v.allowed.QB.passYdsPg)} passing yards per game to quarterbacks (${ordinal(v.rank.QB.passYds)}-most${lgPass ? ` vs a ${f1(lgPass)} league average` : ''})`)
    if (v.rank.RB.rushYds > 0 && v.rank.RB.rushYds <= 8) soft.push(`${f1(v.allowed.RB.rushYdsPg)} rushing yards per game to running backs (${ordinal(v.rank.RB.rushYds)}-most${lgRush ? ` vs a ${f1(lgRush)} league average` : ''})`)
    if (soft.length > 0) push(ev({ tier: 2, text: `${O} has allowed ${soft.join(' and ')} this season — the soft spots in the defense ${T} faces tonight`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: Math.min(1, 0.55 + soft.length * 0.1), support: `${v.allowed.QB.games} games of position-specific stat lines`, n: v.allowed.QB.games, scale }))
  } else {
    const pts = game.defense[O]?.Points
    if (pts && pts.rank <= Math.ceil(pts.of / 4)) push(ev({ tier: 2, text: `${O} is allowing ${f1(pts.value)} points per game (${ordinal(pts.rank)}-most of ${pts.of} teams) heading into tonight against ${T}, whose offense is the one testing it`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: 0.55, support: 'Points allowed per game this season', n: pts.of, scale }))
  }
  const hist = recentSeasons(game, T, 2).filter((g) => g.opp === O && !g.playoff)
  if (hist.length >= 2) {
    const sRec = wins(hist)
    const m = mean(hist.map((g) => g.us - g.them))
    const thisYear = vsOppSeason(game, T, O)
    if (sRec.w / played(sRec) >= 0.67 && m > 0) push(ev({ tier: 2, text: `${T} vs ${O} over the last two seasons: ${recText(sRec)} straight up with an average margin of ${signed(m)} points${thisYear ? ` vs ${signed(thisYear.margin)} in ${plural(thisYear.n, 'game')} this season` : ''} — tonight's opponent`, category: 'h2h', horizon: 'career_vs_opp', relevance: recRelevance(sRec.w, sRec.l), support: hist.map((g) => `${g.us}-${g.them}`).join(', ') + ' (most recent first)', n: hist.length, seasonsAgo: 1 }))
  }

  // ---- Tier 3: scoring matchup with the opponent's quality, and the last five against the season.
  const a5 = (game.results[T] ?? []).slice(0, 5)
  const b5 = (game.results[O] ?? []).slice(0, 5)
  const nMin = game.sport === 'nfl' ? 3 : 4
  if (a5.length >= nMin && b5.length >= nMin) {
    const w5 = wins(a5)
    const aM = mean(a5.map((g) => g.us - g.them))
    const bM = mean(b5.map((g) => g.us - g.them))
    const edge = aM - bM
    const q = allowedByQuality(game, O, 5)
    const quality = q.vsGood !== null ? `; ${O}'s ${f1(q.all)} allowed includes ${plural(q.nGood, 'game')} against teams at or above .500 (${f1(q.vsGood)} allowed in those)` : `; none of ${O}'s last ${q.n} opponents was at or above .500, so its ${f1(q.all)} allowed is against weaker offenses`
    if (edge >= 3 && w5.w / played(w5) >= 0.6) push(ev({ tier: 3, text: `${T} is averaging ${f1(avgFor(a5))} points over its last ${a5.length} (allowing ${f1(avgAgainst(a5))}) vs ${O} averaging ${f1(avgFor(b5))} and allowing ${f1(avgAgainst(b5))} — a ${f1(edge)}-point per game differential in ${T}'s favor${quality} — the scoring matchup behind tonight's ${betWord}`, category: 'recent_form', horizon: 'last7', relevance: Math.min(1, 0.45 + edge / 20), support: `${T} margin ${signed(aM)}, ${O} margin ${signed(bM)} per game`, n: Math.min(a5.length, b5.length), ageDays: 6, metrics: { avg: aM, n: a5.length } }))
    else if (edge <= -5) conflicts++
  }

  // ---- Tier 4: ATS or straight-up records in tonight's exact situation.
  if (mineLines) {
    const role = roleKey(home, line)
    if (role) {
      const r = toLineRec(atsOrSu(mineLines.roles[role]))
      const total = toLineRec(atsOrSu({ ats: mineLines.ats, su: mineLines.su }))
      if (played(r) >= 2 && r.w / played(r) >= 0.6 && Math.abs(r.w / played(r) - total.w / Math.max(1, played(total))) >= 0.08) push(ev({ tier: 4, text: `${T}'s ${recWord} as ${ROLE_WORD[role]} this season: ${recText(r)} vs ${recText(total)} across all games${spread ? ` — tonight's role at ${lineText(line as number)}` : ' — tonight\'s role'}`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(r.w, r.l), support: `${mineLines.lined} games with closing lines on file`, n: played(r), smallSample: played(r) < 6 }))
      else if (played(r) >= 3 && r.w / played(r) <= 0.34) conflicts++
    }
    const oppPct = game.leagueWinPct[O]
    if (oppPct !== undefined) {
      const strong = oppPct >= 0.5
      const r = toLineRec(atsOrSu(strong ? mineLines.vsStrong : mineLines.vsWeak))
      const other = toLineRec(atsOrSu(strong ? mineLines.vsWeak : mineLines.vsStrong))
      if (played(r) >= 3 && r.w / played(r) >= 0.62) push(ev({ tier: 4, text: `${T}'s ${recWord} vs teams ${strong ? 'at or above' : 'under'} .500 this season: ${recText(r)}${played(other) >= 2 ? ` vs ${recText(other)} against teams ${strong ? 'under' : 'at or above'} .500` : ''} — ${O} is ${oppPct.toFixed(3).replace(/^0/, '')} tonight`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(r.w, r.l), support: 'Closing lines on file this season', n: played(r), smallSample: played(r) < 6, scale }))
      else if (played(r) >= 3 && r.w / played(r) <= 0.34) conflicts++
    }
    if (sport === 'cfb' && game.conference[T] && game.conference[T] === game.conference[O]) {
      const r = toLineRec(atsOrSu(mineLines.conf))
      if (played(r) >= 2 && r.w / played(r) >= 0.6) push(ev({ tier: 4, text: `${T}'s ${recWord} in conference games this season: ${recText(r)} vs ${recText(toLineRec(atsOrSu({ ats: mineLines.ats, su: mineLines.su })))} across all games — tonight is a ${game.conference[T]} game`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(r.w, r.l), support: 'Games against same-conference opponents', n: played(r), smallSample: played(r) < 6 }))
    }
    if (sport === 'nfl') {
      const spots: { key: 'shortWeek' | 'divisional'; on: boolean; text: string }[] = [
        { key: 'shortWeek', on: r1 !== null && r1 !== undefined && r1 <= 5, text: 'on a short week' },
        { key: 'divisional', on: game.flags.divisional, text: 'in divisional games' },
      ]
      for (const s of spots) {
        if (!s.on) continue
        const r = toLineRec(atsOrSu(mineLines.spots[s.key]))
        const all = toLineRec(atsOrSu({ ats: mineLines.ats, su: mineLines.su }))
        if (played(r) >= 2 && r.w / played(r) >= 0.67 && Math.abs(r.w / played(r) - all.w / Math.max(1, played(all))) >= 0.08) push(ev({ tier: 4, text: `${T}'s ${recWord} ${s.text} this season: ${recText(r)} vs ${recText(toLineRec(atsOrSu({ ats: mineLines.ats, su: mineLines.su })))} across all games — tonight's spot`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: recRelevance(r.w, r.l), support: 'Closing lines on file', n: played(r), smallSample: true }))
      }
    }
  }
  // The opponent's mirror, from the final scores (a spread number is only tonight's).
  if (spread && line !== null) {
    const oppCur = currentSeason(game, O)
    const mirror = covers(atVenue(oppCur, !home), -line)
    const mirrorOther = covers(atVenue(oppCur, home), -line)
    if (played(mirror) >= 3 && mirror.w / played(mirror) <= 0.34) push(ev({ tier: 4, text: `${O}'s record covering ${lineText(-line)} ${!home ? 'at home' : 'on the road'} this season: ${recText(mirror)}${played(mirrorOther) >= 3 ? ` vs ${recText(mirrorOther)} ${home ? 'at home' : 'on the road'}` : ''} — the number ${O} has to cover tonight`, category: 'hit_rate', horizon: 'season', relevance: Math.min(1, 0.45 + (0.5 - mirror.w / played(mirror))), support: `${O}'s ${!home ? 'home' : 'road'} games`, n: played(mirror), smallSample: played(mirror) < 6 }))
  }
  return { edges, conflicts }
}

function vsOppSeason(game: GameContext, team: string, opp: string): { n: number; margin: number } | null {
  const g = currentSeason(game, team).filter((x) => x.opp === opp && !x.playoff)
  return g.length ? { n: g.length, margin: mean(g.map((x) => x.us - x.them)) } : null
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

function fbTotal({ outcome: o, game }: ModuleInput, sport: Fb): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  if (o.threshold === undefined) return { edges, conflicts }
  const total = o.threshold
  const over = o.direction !== 'under'
  const word = over ? 'Over' : 'Under'
  const A = game.away
  const H = game.home
  const push = (e: Edge) => edges.push(e)

  // ---- The game foundation: weather, style matchups, injuries.
  const f = foundationEdges(o, game)
  edges.push(...f.edges)
  conflicts += f.conflicts

  // ---- Tier 2: each defense separately, against the league.
  const da = game.defense[A]?.Points
  const dh = game.defense[H]?.Points
  if (da && dh) {
    const softBoth = da.rank <= Math.ceil(da.of / 2) && dh.rank <= Math.ceil(dh.of / 2) && Math.min(da.rank, dh.rank) <= Math.ceil(da.of / 3)
    const toughBoth = da.rank > Math.floor(da.of / 2) && dh.rank > Math.floor(dh.of / 2) && Math.max(da.rank, dh.rank) > Math.floor((da.of * 2) / 3)
    if ((over && softBoth) || (!over && toughBoth)) {
      push(ev({ tier: 2, text: `${A} allows ${f1(da.value)} points per game (${over ? ordinal(da.rank) + '-most' : ordinal(da.of - da.rank + 1) + '-fewest'} of ${da.of}); ${H} allows ${f1(dh.value)} (${over ? ordinal(dh.rank) + '-most' : ordinal(dh.of - dh.rank + 1) + '-fewest'}) — two defenses ${over ? 'that give up points' : 'that hold teams down'} meet tonight`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: 0.6, support: 'Points allowed per game this season', n: da.of }))
    } else if ((over && toughBoth) || (!over && softBoth)) conflicts++
  }

  // ---- Tier 3: recent scoring, each team separately with its season average, then the combined figure last.
  const nMin = game.sport === 'nfl' ? 3 : 4
  const a5 = (game.results[A] ?? []).slice(0, 5)
  const h5 = (game.results[H] ?? []).slice(0, 5)
  const sA = currentSeason(game, A)
  const sH = currentSeason(game, H)
  if (a5.length >= nMin && h5.length >= nMin) {
    const combined = avgFor(a5) + avgFor(h5)
    const proj = (avgFor(a5) + avgAgainst(h5)) / 2 + (avgFor(h5) + avgAgainst(a5)) / 2
    const gap = proj - total
    const scale = game.sport === 'nfl' ? 3 : 4
    const trend = (recent: number, season: number) => (recent >= season + 2 ? 'trending up' : recent <= season - 2 ? 'trending down' : 'stable')
    if ((over && gap >= scale) || (!over && gap <= -scale)) {
      push(ev({ tier: 3, text: `${A} is scoring ${f1(avgFor(a5))} and allowing ${f1(avgAgainst(a5))} over its last ${a5.length} ${sA.length > a5.length ? `(${f1(avgFor(sA))} scored on the season, ${trend(avgFor(a5), avgFor(sA))})` : `(its full ${sA.length}-game season)`}; ${H} is scoring ${f1(avgFor(h5))} and allowing ${f1(avgAgainst(h5))} ${sH.length > h5.length ? `(${f1(avgFor(sH))} on the season, ${trend(avgFor(h5), avgFor(sH))})` : `(its full ${sH.length}-game season)`} — combined ${f1(combined)} scored, with the two matchups projecting to ${f1(proj)} against tonight's ${total}`, category: 'recent_form', horizon: 'last7', relevance: Math.min(1, 0.45 + Math.abs(gap) / (scale * 4)), support: 'Final scores, last five games each', n: Math.min(a5.length, h5.length), ageDays: 6 }))
    } else if ((over && gap <= -scale) || (!over && gap >= scale)) conflicts++
    const ra = totalSide(a5, total, over)
    const rh = totalSide(h5, total, over)
    if ((ra.w + rh.w) / (played(ra) + played(rh)) >= 0.65 && played(ra) >= nMin) {
      const sa = totalSide(sA, total, over)
      const sh = totalSide(sH, total, over)
      push(ev({ tier: 3, text: `${A}: ${word} ${total} in ${ra.w} of the last ${played(ra) + ra.p} games vs ${sa.w} of ${sA.length} on the season; ${H}: ${word} ${total} in ${rh.w} of the last ${played(rh) + rh.p} vs ${sh.w} of ${sH.length} — each team's own record against tonight's number`, category: 'recent_form', horizon: 'last7', relevance: recRelevance(ra.w + rh.w, played(ra) + played(rh) - ra.w - rh.w), support: "Final scores against tonight's total", n: Math.min(played(ra), played(rh)), ageDays: 6, metrics: { rate: (ra.w + rh.w) / (played(ra) + played(rh)), n: played(ra) } }))
    }
  }
  // ---- Tier 4: season O/U at this number, each team separately, plus the venue each plays tonight.
  const sa = totalSide(sA, total, over)
  const sh = totalSide(sH, total, over)
  const va = totalSide(atVenue(sA, false), total, over)
  const vh = totalSide(atVenue(sH, true), total, over)
  if (sA.length >= nMin && sH.length >= nMin && (sa.w + sh.w) / Math.max(1, played(sa) + played(sh)) >= 0.6) {
    push(ev({ tier: 4, text: `${A}: ${word} ${total} in ${sa.w} of ${sA.length} games this season${played(va) >= 2 ? ` — on the road ${va.w} of ${played(va) + va.p}` : ''}; ${H}: ${word} ${total} in ${sh.w} of ${sH.length}${played(vh) >= 2 ? ` — at home ${vh.w} of ${played(vh) + vh.p}` : ''} — each against tonight's ${total} number`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(sa.w + sh.w, played(sa) + played(sh) - sa.w - sh.w), support: 'Final scores this season', n: Math.min(sA.length, sH.length), smallSample: Math.min(sA.length, sH.length) < 6 }))
  }
  // Game script from the posted spread.
  const { margin } = scriptOf(game, H)
  if (margin !== null) {
    const spread = Math.abs(margin)
    if (!over && spread >= 10) push(ev({ tier: 4, text: `The ${f1(spread)}-point spread points to a one-sided game — the leader runs the clock late, trimming the total vs a typical ${sport === 'nfl' ? '45' : '55'}-point game against the ${total}`, category: 'role', horizon: 'tonight', layer: 'opportunity', relevance: 0.55, support: 'Spread-implied game flow', n: 1, ageDays: 0 }))
    else if (over && spread <= 3 && total >= (sport === 'nfl' ? 45 : 55)) push(ev({ tier: 4, text: `The ${f1(spread)}-point spread points to a close game — both offenses stay aggressive for longer than in a typical lopsided game, supporting the over ${total}`, category: 'role', horizon: 'tonight', layer: 'opportunity', relevance: 0.5, support: 'Spread-implied game flow', n: 1, ageDays: 0 }))
  }
  return { edges, conflicts }
}

// ---------------------------------------------------------------------------
// Player props
// ---------------------------------------------------------------------------

function fbProp({ outcome: o, game, history }: ModuleInput, sport: Fb): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  if (!o.player || !o.category || o.threshold === undefined) return { edges, conflicts }
  const over = o.direction !== 'under'
  const name = propName(o)
  const T = o.player.team
  const O = o.opponent ?? ''
  const home = o.homeAway === 'home' ? true : o.homeAway === 'away' ? false : null
  const cat = o.category
  const facts = game.facts.nfl
  const player: NflPlayerFacts | undefined = facts?.players[`${slugify(o.player.name)}|${T}`]
  const pos = ((player?.position ?? o.player.position ?? '') as string).toUpperCase().replace('HB', 'RB').replace('FB', 'RB') as PosKey
  const passing = cat === 'Pass Yards'
  const rushing = cat === 'Rush Yards'
  const receiving = cat === 'Receiving Yards' || cat === 'Receptions'
  const push = (e: Edge) => edges.push(e)
  const merge = (r: { edges: Edge[]; conflicts: number }) => {
    edges.push(...r.edges)
    conflicts += r.conflicts
  }
  const scale = oppTierScale(game, sport, O)
  const margin = scriptOf(game, T).margin
  const f = game.foundation
  const slot = facts?.depth[T]?.slots[slugify(o.player.name)]

  // ---- Tier 1: weather matched to this player's route depth, then the roster context that changes his volume.
  const wx = f?.weather
  if (wx && (passing || receiving)) {
    const last4 = player?.games.slice(0, 4) ?? []
    const targets = last4.reduce((n, g) => n + g.targets, 0)
    const air = last4.reduce((n, g) => n + g.airYards, 0)
    const adot = targets >= 8 ? air / targets : null
    const deep = adot !== null && adot >= 11
    const shortRoutes = adot !== null && adot <= 8.5
    const routeText = passing ? `${name} is the passer whose throws depend on those routes` : adot !== null ? `${name}'s targets travel ${f1(adot)} air yards on average over the last ${last4.length} games (${deep ? 'a deep' : shortRoutes ? 'a short' : 'an intermediate'} route tree)` : `${name}'s route depth is not measured`
    const exposed = passing || deep
    if (wx.deepSuppressed || wx.cold || wx.wet) {
      if (!over && exposed) push(ev({ tier: 1, text: `${wx.text}. ${routeText} — directly exposed to those conditions, relevant to the ${o.threshold} threshold`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.65, support: 'Game-time forecast and air yards per target', n: Math.max(1, last4.length), ageDays: 0 }))
      else if (over && shortRoutes) push(ev({ tier: 1, text: `${wx.text}. ${routeText} — the conditions that hurt deep routes least affect his short-route role, which protects the ${o.threshold} threshold`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.5, support: 'Game-time forecast and air yards per target', n: Math.max(1, last4.length), ageDays: 0 }))
      else if (over && exposed) conflicts++
    }
  }
  // Roster notes for this player's own team and the defense he faces.
  for (const n of f?.roster ?? []) {
    if (!n.affects.some((a) => a === pos || (a === 'QB' && passing))) continue
    if (n.team === T) {
      if (n.kind === 'out' && n.player !== o.player.name) {
        if (over && (n.position === pos || (['WR', 'WR1', 'WR2', 'TE'].includes(n.position) && receiving))) push(ev({ tier: 1, text: `${n.text} — a volume opening for ${name} tonight`, category: 'role', horizon: 'tonight', layer: 'opportunity', relevance: n.impact === 'high' ? 0.7 : 0.55, support: 'Depth chart, injury report and season usage', n: 5, ageDays: 0 }))
        else if (n.position === 'QB' && over) conflicts += 2
        else if (n.position === 'LT' && (passing || rushing) && over) conflicts++
      } else if (n.kind === 'returning' && n.player !== o.player.name && n.position === pos && over) conflicts++
      else if (n.kind === 'returning' && n.player === o.player.name && over) push(ev({ tier: 1, text: `${n.text} — ${name}'s role steps back up for tonight`, category: 'role', horizon: 'tonight', layer: 'opportunity', relevance: 0.55, support: 'Season usage by week', n: 5, ageDays: 0 }))
    } else if (n.team === O && n.kind === 'out' && over && ((receiving && ['CB', 'S'].includes(n.position)) || (passing && ['CB', 'S', 'DE'].includes(n.position)) || (rushing && ['DT', 'DE', 'LB'].includes(n.position)))) {
      push(ev({ tier: 1, text: `${n.text} — an opening for ${name} tonight`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: n.impact === 'high' ? 0.65 : 0.5, support: 'ESPN depth chart and injury report', n: 5, ageDays: 0 }))
    }
  }
  // The cornerbacks he is expected to face (the depth chart's CB1 for a team's WR1).
  const dO = O ? facts?.depth[O] : undefined
  if (dO && receiving && over && slot) {
    const cb = slot === 'WR1' ? dO.cbs[0] : slot === 'WR2' ? dO.cbs[1] : dO.cbs[2]
    if (cb && cb.status && /out|doubtful|questionable|day-to-day|limited/i.test(cb.status)) {
      const rep = dO.cbs.find((c) => c !== cb && !(c.status && /out|doubtful/i.test(c.status)))
      push(ev({ tier: 1, text: `${name} (${slot}) is expected to see ${O}'s ${cb.slot} ${cb.name}, who is listed ${cb.status.toLowerCase()}${rep ? ` — ${rep.name} (${rep.slot}) would shadow him instead` : ''}, a coverage matchup that is in flux tonight`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.55, support: 'ESPN depth chart and injury report', n: 2, ageDays: 0 }))
    }
  }
  // The script the spread implies, with how this team has actually played in wins and losses.
  const pr = facts ? passByResult(game, T) : { win: null, loss: null }
  if (margin !== null) {
    const split = pr.win && pr.loss ? ` (${T} has passed on ${pct(pr.loss.pct)} of plays in its ${plural(pr.loss.n, 'loss', 'losses')} vs ${pct(pr.win.pct)} in its ${plural(pr.win.n, 'win')})` : ''
    if (passing || receiving) {
      if (over && margin <= -3.5) push(ev({ tier: 1, text: `${T} is a ${f1(Math.abs(margin))}-point underdog tonight${split} — trailing scripts mean more pass attempts and more targets for ${name}`, category: 'role', horizon: 'tonight', layer: 'opportunity', relevance: Math.min(1, 0.5 + Math.abs(margin) / 20), support: 'Spread-implied game flow with pass rate by result', n: 1, ageDays: 0 }))
      else if (over && margin >= 9) conflicts++
      else if (!over && margin >= 9) push(ev({ tier: 1, text: `${T} is a ${f1(margin)}-point favorite tonight${split} — a lead shifts the offense to the run game and trims ${name}'s passing volume vs an average game`, category: 'role', horizon: 'tonight', layer: 'opportunity', relevance: 0.55, support: 'Spread-implied game flow with pass rate by result', n: 1, ageDays: 0 }))
    } else if (rushing) {
      if (over && margin >= 3.5) push(ev({ tier: 1, text: `${T} is a ${f1(margin)}-point favorite tonight${split ? ` (${T} has run on ${pct(1 - (pr.win?.pct ?? 0.5))} of plays in wins vs ${pct(1 - (pr.loss?.pct ?? 0.5))} in losses)` : ''} — leading late means ball control and a heavier share of carries for ${name}`, category: 'role', horizon: 'tonight', layer: 'opportunity', relevance: Math.min(1, 0.5 + margin / 20), support: 'Spread-implied game flow with run rate by result', n: 1, ageDays: 0 }))
      else if (over && margin <= -7) conflicts++
      else if (!over && margin <= -7) push(ev({ tier: 1, text: `${T} is a ${f1(Math.abs(margin))}-point underdog tonight — trailing scripts lean pass-heavy and cut into ${name}'s carries vs a leading game`, category: 'role', horizon: 'tonight', layer: 'opportunity', relevance: 0.55, support: 'Spread-implied game flow', n: 1, ageDays: 0 }))
    }
  }

  // ---- Tier 2: the position-specific defense with its quality qualifier, the role behind the number, the career record.
  const v = O ? facts?.vsPosition[O] : undefined
  const defG = O ? facts?.defGames[O] : undefined
  const goodG = defG?.filter((g) => (game.leagueWinPct[g.opp] ?? -1) >= 0.5) ?? []
  const qual = (vals: number[], goodVals: number[], unit: string) => (goodVals.length >= 2 ? `, ${f1(mean(goodVals))} in ${plural(goodVals.length, 'game')} against teams at or above .500 — the vulnerability holds against winning offenses` : vals.length >= 3 ? `, all against offenses under .500 so far — the sample is thin on quality opponents` : '')
  void qual
  if (v && (passing || rushing || receiving)) {
    if (passing && v.rank.QB.passYds > 0) {
      const rank = v.rank.QB.passYds
      const soft = rank <= 10
      const tough = rank > v.of - 10
      const al = v.allowed.QB
      const lg = leagueMean(facts, (x) => x.allowed.QB.passYdsPg)
      const gv = goodG.map((g) => g.qbPass)
      if ((over && soft) || (!over && tough)) push(ev({ tier: 2, text: `${O} has allowed ${f1(al.passYdsPg)} passing yards per game to quarterbacks (${soft ? ordinal(rank) + '-most' : ordinal(v.of - rank + 1) + '-fewest'} in the NFL${lg ? ` vs a ${f1(lg)} league average` : ''}) on a ${Math.round(al.compPct * 100)}% completion rate${gv.length >= 2 ? `, ${f1(mean(gv))} in ${plural(gv.length, 'game')} against teams at or above .500 — ${soft ? 'the vulnerability holds against winning offenses' : 'the strength holds against winning offenses'}` : ', all against offenses under .500 so far'} — the defense ${name} faces tonight`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: Math.min(1, 0.55 + (soft ? 10 - rank : rank - (v.of - 10)) / 20), support: `${al.games} games, quarterback stat lines only`, n: al.games, metrics: { avg: al.passYdsPg, n: al.games }, scale }))
      else if ((over && tough) || (!over && soft)) conflicts++
    }
    if (rushing && v.rank.RB.rushYds > 0) {
      const rank = v.rank.RB.rushYds
      const soft = rank <= 10
      const tough = rank > v.of - 10
      const al = v.allowed.RB
      const lg = leagueMean(facts, (x) => x.allowed.RB.rushYdsPg)
      const ypc = al.carriesPg > 0 ? al.rushYdsPg / al.carriesPg : 0
      const gv = goodG.map((g) => g.rbRush)
      if ((over && soft) || (!over && tough)) push(ev({ tier: 2, text: `${O} has allowed ${f1(al.rushYdsPg)} rushing yards per game to running backs (${ypc.toFixed(1)} per carry, ${soft ? ordinal(rank) + '-most' : ordinal(v.of - rank + 1) + '-fewest'} in the NFL${lg ? ` vs a ${f1(lg)} league average` : ''})${gv.length >= 2 ? `, ${f1(mean(gv))} in ${plural(gv.length, 'game')} against teams at or above .500 — ${soft ? 'the vulnerability holds against quality offenses' : 'the strength holds against quality offenses'}` : ', all against offenses under .500 so far'} — the run defense ${name} faces tonight`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: Math.min(1, 0.55 + (soft ? 10 - rank : rank - (v.of - 10)) / 20), support: `${al.games} games, running back stat lines only`, n: al.games, metrics: { avg: al.rushYdsPg, n: al.games }, scale }))
      else if ((over && tough) || (!over && soft)) conflicts++
    }
    if (receiving && (pos === 'WR' || pos === 'TE' || pos === 'RB')) {
      const al = v.allowed[pos]
      const rk = v.rank[pos]
      const yards = cat === 'Receiving Yards'
      const rank = yards ? (pos === 'RB' ? 0 : rk.recYds) : rk.rec
      const value = yards ? al.recYdsPg : al.recPg
      const label = pos === 'RB' ? 'running backs' : pos === 'TE' ? 'tight ends' : 'wide receivers'
      const wr1 = O ? facts?.wr1Allowed[O] : undefined
      if (rank > 0 && value > 0) {
        const soft = rank <= 10
        const tough = rank > v.of - 10
        const lg = leagueMean(facts, (x) => (yards ? x.allowed[pos].recYdsPg : x.allowed[pos].recPg))
        // A WR1 faces the defense's answer to opposing WR1s, measured on its own.
        const wr1Text = slot === 'WR1' && yards && wr1 ? `, and ${f1(wr1.yds)} to opposing WR1s (${ordinal(wr1.rank)}-most of ${wr1.of})${goodG.length >= 2 ? `, ${f1(mean(goodG.map((g) => g.wr1Yds)))} in ${plural(goodG.length, 'game')} against teams at or above .500 — ${soft ? 'the vulnerability holds against winning teams' : 'the strength holds against winning teams'}` : ''}` : ''
        if ((over && soft) || (!over && tough)) push(ev({ tier: 2, text: `${O} has allowed ${f1(value)} ${yards ? 'receiving yards' : 'receptions'} per game to ${label} (${soft ? ordinal(rank) + '-most' : ordinal(v.of - rank + 1) + '-fewest'} in the NFL${lg ? ` vs a ${f1(lg)} league average` : ''})${wr1Text} — the position ${name} plays tonight`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: Math.min(1, 0.55 + (soft ? 10 - rank : rank - (v.of - 10)) / 20), support: `${al.games} games, ${label} stat lines only`, n: al.games, metrics: { avg: value, n: al.games }, scale }))
        else if ((over && tough) || (!over && soft)) conflicts++
      }
    }
  } else if (O && (passing || rushing || receiving)) {
    // College (no position-level tables): the defense's yards allowed per game and rank.
    const rank = game.defense[O]?.[cat]
    if (rank) {
      const soft = rank.rank <= Math.ceil(rank.of / 4)
      const tough = rank.rank > rank.of - Math.ceil(rank.of / 4)
      if ((over && soft) || (!over && tough)) push(ev({ tier: 2, text: `${O} allows ${f1(rank.value)} ${rank.label.replace(' per game', '')} per game (${soft ? ordinal(rank.rank) + '-most' : ordinal(rank.of - rank.rank + 1) + '-fewest'} of ${rank.of} teams) — the defense ${name} faces tonight`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: 0.55, support: 'Defensive yards allowed per game this season', n: rank.of, scale }))
      else if ((over && tough) || (!over && soft)) conflicts++
    }
  }
  if (player) {
    const rec = player.games.slice(0, 4)
    // Receiving role: the target share against the season, and what explains it.
    if (receiving) {
      const shares = rec.map((g) => g.targetShare).filter((x): x is number => x !== null)
      const seasonShares = player.games.map((g) => g.targetShare).filter((x): x is number => x !== null)
      if (shares.length >= 3 && seasonShares.length >= 4) {
        const s4 = mean(shares)
        const season = mean(seasonShares)
        const floor = pos === 'WR' ? 0.2 : 0.15
        const tg = mean(rec.map((g) => g.targets))
        const tgSeason = mean(player.games.map((g) => g.targets))
        const allAbove = shares.every((x) => x >= season)
        const mates = (f?.roster ?? []).filter((n) => n.team === T && n.kind === 'out' && ['WR', 'WR1', 'WR2', 'TE'].includes(n.position) && n.player !== o.player!.name)
        const why = mates.length > 0 ? `${mates[0].player} out tonight` : allAbove ? `sustained across all ${shares.length} games, not a one-game spike` : 'uneven across the stretch, so partly variance'
        if (over && s4 >= floor) push(ev({ tier: 2, text: `${name}'s target share is ${pct(s4)} over the last ${shares.length} games vs ${pct(season)} on the season (${f1(tg)} targets per game vs ${f1(tgSeason)}) — ${s4 - season >= 0.03 ? 'elevated' : 'steady'} relative to his season, ${why} — the volume behind tonight's ${propLine(o)}`, category: 'role', horizon: 'last7', layer: 'opportunity', relevance: Math.min(1, 0.5 + (s4 - floor) * 3 + (s4 - season >= 0.03 ? 0.1 : 0)), support: `Targets by game: ${rec.map((g) => g.targets).join(', ')} (most recent first)`, n: shares.length, ageDays: 7, metrics: { rate: s4, avg: tg, n: shares.length } }))
        else if (over && s4 <= floor - 0.07) conflicts++
        else if (!over && s4 <= floor - 0.06) push(ev({ tier: 2, text: `${name}'s target share has slipped to ${pct(s4)} over the last ${shares.length} games vs ${pct(season)} on the season (${f1(tg)} targets per game vs ${f1(tgSeason)}) — fewer looks tonight lower the ceiling on ${propLine(o)}`, category: 'role', horizon: 'last7', layer: 'opportunity', relevance: 0.6, support: 'Target share by game', n: shares.length, ageDays: 7 }))
      }
      const ays = rec.map((g) => g.airYardsShare).filter((x): x is number => x !== null)
      if (cat === 'Receiving Yards' && over && ays.length >= 3) {
        const a4 = mean(ays)
        const aSeason = mean(player.games.map((g) => g.airYardsShare).filter((x): x is number => x !== null))
        const tg = rec.reduce((n, g) => n + g.targets, 0)
        const air = rec.reduce((n, g) => n + g.airYards, 0)
        if (a4 >= 0.28) push(ev({ tier: 2, text: `${name} holds a ${pct(a4)} share of his team's air yards over the last ${ays.length} games vs ${pct(aSeason)} on the season${tg > 0 ? ` (${f1(air / tg)} air yards per target)` : ''} — a downfield role behind tonight's receiving-yards line`, category: 'role', horizon: 'last7', layer: 'opportunity', relevance: Math.min(1, 0.5 + (a4 - 0.28) * 2), support: 'nflverse weekly receiving data', n: ays.length, ageDays: 7, metrics: { rate: a4, n: ays.length } }))
      }
    }
    // Snap share, against the season.
    const snaps = player.games.slice(0, 3).map((g) => g.snapPct).filter((x): x is number => x !== null)
    const seasonSnaps = player.games.map((g) => g.snapPct).filter((x): x is number => x !== null)
    if (snaps.length >= 3 && (rushing || receiving)) {
      const s = mean(snaps)
      const sSeason = seasonSnaps.length >= 4 ? mean(seasonSnaps) : null
      const trend = sSeason === null ? '' : s >= sSeason + 0.05 ? ` — up from ${pct(sSeason)} on the season` : s <= sSeason - 0.05 ? ` — down from ${pct(sSeason)} on the season` : ` vs ${pct(sSeason)} on the season`
      if (over && s >= (rushing ? 0.6 : 0.75)) push(ev({ tier: 2, text: `${name} has played ${pct(s)} of offensive snaps over the last ${snaps.length} games (${player.games.slice(0, 3).map((g) => (g.snapPct === null ? '—' : pct(g.snapPct))).join(', ')})${trend} — ${rushing ? (s >= 0.7 ? 'the clear lead back' : 'a primary backfield role') : 'an every-down role'} heading into tonight`, category: 'role', horizon: 'last7', layer: 'opportunity', relevance: Math.min(1, 0.5 + (s - 0.55) * 1.6), support: 'nflverse snap counts', n: snaps.length, ageDays: 7, metrics: { rate: s, n: snaps.length } }))
      else if (over && s <= (rushing ? 0.45 : 0.5)) conflicts++
      else if (!over && rushing && s <= 0.45) push(ev({ tier: 2, text: `${name} has played only ${pct(s)} of offensive snaps over the last ${snaps.length} games${trend} — a committee role tonight`, category: 'role', horizon: 'last7', layer: 'opportunity', relevance: 0.6, support: 'nflverse snap counts', n: snaps.length, ageDays: 7 }))
    }
    // Rushing: carries and the share of the team's carries, with the season share.
    if (rushing && facts) {
      const shareOf = (gs: typeof player.games) => {
        let mine = 0
        let team = 0
        for (const g of gs) {
          mine += g.carries
          for (const other of Object.values(facts.players)) {
            if (other.team !== player.team || other.position === 'QB') continue
            const og = other.games.find((x) => x.week === g.week)
            if (og) team += og.carries
          }
        }
        return team > 0 ? { share: mine / team, per: mine / Math.max(1, gs.length) } : null
      }
      const last4 = shareOf(player.games.slice(0, 4))
      const seasonS = shareOf(player.games)
      if (last4 && seasonS && over && last4.per >= 12) push(ev({ tier: 2, text: `${name} is carrying ${pct(last4.share)} of ${T}'s running back carries over the last ${Math.min(4, player.games.length)} games (${f1(last4.per)} per game) vs ${pct(seasonS.share)} (${f1(seasonS.per)}) on the season — ${last4.per >= seasonS.per ? 'above' : 'below'} his season workload heading into tonight's ${propLine(o)}`, category: 'role', horizon: 'last7', layer: 'opportunity', relevance: Math.min(1, 0.5 + (last4.per - 12) / 12), support: `Carries by game: ${player.games.slice(0, 4).map((g) => g.carries).join(', ')} (most recent first)`, n: Math.min(4, player.games.length), ageDays: 7, metrics: { avg: last4.per, n: 4 } }))
    }
    // Passing volume.
    if (passing) {
      const last4 = player.games.slice(0, 4).filter((g) => g.att > 0)
      const all = player.games.filter((g) => g.att > 0)
      if (last4.length >= 3) {
        const att = mean(last4.map((g) => g.att))
        if (over && att >= 36) push(ev({ tier: 2, text: `${name} is averaging ${f1(att)} pass attempts over the last ${last4.length} games (${f1(mean(last4.map((g) => g.passYds)))} yards per game) vs ${f1(mean(all.map((g) => g.att)))} attempts on the season — the volume behind tonight's ${propLine(o)}`, category: 'role', horizon: 'last7', layer: 'opportunity', relevance: Math.min(1, 0.5 + (att - 36) / 14), support: `Attempts by game: ${last4.map((g) => g.att).join(', ')} (most recent first)`, n: last4.length, ageDays: 7, metrics: { avg: att, n: last4.length } }))
        // How this quarterback has produced in losses against wins.
        const res = weekResults(game, T)
        const inLoss = all.filter((g) => {
          const r = res.get(g.week)
          return r && r.us < r.them
        })
        const inWin = all.filter((g) => {
          const r = res.get(g.week)
          return r && r.us > r.them
        })
        if (over && margin !== null && margin <= -3.5 && inLoss.length >= 1 && inWin.length >= 1 && mean(inLoss.map((g) => g.passYds)) > mean(inWin.map((g) => g.passYds))) push(ev({ tier: 2, text: `${name} has averaged ${f1(mean(inLoss.map((g) => g.passYds)))} passing yards in ${plural(inLoss.length, 'loss', 'losses')} vs ${f1(mean(inWin.map((g) => g.passYds)))} in ${plural(inWin.length, 'win')} this season — ${f1(mean(inLoss.map((g) => g.passYds)) - mean(inWin.map((g) => g.passYds)))} more when trailing, and ${T} is an underdog tonight`, category: 'role', horizon: 'season', layer: 'opportunity', relevance: 0.55, support: 'Passing yards by result', n: all.length }))
      }
    }
  }
  // Career against this defense, with receptions and yards for receivers.
  if (receiving && history && O) {
    const vs = history.games.filter((g) => g.opp === O)
    if (vs.length >= (sport === 'nfl' ? 1 : 2) && over) {
      const rec = vs.map((g) => g.values['Receptions']).filter((x): x is number => typeof x === 'number')
      const yds = vs.map((g) => g.values['Receiving Yards']).filter((x): x is number => typeof x === 'number')
      const cur = history.games.filter((g) => g.season === history.games[0].season)
      const seasonRec = cur.map((g) => g.values['Receptions']).filter((x): x is number => typeof x === 'number')
      const val = (cat === 'Receptions' ? rec : yds)
      if (val.length && mean(val) > (o.threshold as number)) push(ev({ tier: 2, text: `${name} has ${rec.reduce((n, x) => n + x, 0)} receptions for ${Math.round(yds.reduce((n, x) => n + x, 0))} yards in ${plural(vs.length, 'career game')} vs ${O} — ${f1(mean(rec))} receptions per game${seasonRec.length >= 3 ? ` vs ${f1(mean(seasonRec))} on the season` : ''}, ${f1(mean(val))} ${cat === 'Receptions' ? 'receptions' : 'yards'} per game against a ${o.threshold} line tonight`, category: 'h2h', horizon: 'career_vs_opp', relevance: 0.55, support: vs.slice(0, 4).map((g) => `${g.values['Receptions'] ?? 0} for ${g.values['Receiving Yards'] ?? 0}`).join(' · ') + ' (most recent first)', n: vs.length, seasonsAgo: 1 }))
    }
  } else merge(vsOpponentCareer(o, history, sport === 'nfl' ? 1 : 2))

  // ---- Tier 3-5: the threshold record read against the season (with the usage behind it), the venue split.
  const usage = rushing ? { key: 'Rush Attempts', label: 'carries' } : receiving ? { key: 'Targets', label: 'targets' } : undefined
  merge(recentAtLine(o, history, 3, [3, 5, 8], usage))
  merge(seasonAtLine(o, history, home))
  return { edges, conflicts }
}

export function footballEvidence(input: ModuleInput, sport: Fb): ModuleOutput {
  const o: BettingOutcome = input.outcome
  if (o.type === 'player_prop') return fbProp(input, sport)
  if (o.type === 'moneyline' || o.type === 'spread') return fbSide(input, sport)
  if (o.type === 'total') return fbTotal(input, sport)
  return { edges: [], conflicts: 0 }
}
