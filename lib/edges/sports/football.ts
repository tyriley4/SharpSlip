import { slugify } from '@/lib/players/slug'
import type { OutStarter, PosKey } from '../data/nfl'
import type { Rec as LineRec } from '../data/lines'
import { cfbOpponentWeight } from '../data/cfb'
import { scriptOf, type ModuleInput } from '../modules/shared'
import type { BettingOutcome, Edge, GameContext, ModuleOutput, TeamGameRecord } from '../types'
import { ev, f1, lineText, mean, ordinal, recRelevance, recText, signed } from './format'
import { propLine, propName, recentAtLine, seasonAtLine, vsOpponentCareer } from './props'
import { atVenue, avgAgainst, avgFor, covers, currentSeason, games as played, recentSeasons, totalSide, wins, type Rec } from './records'

/**
 * Football evidence (NFL and college). The framework is the same for both: injuries only when the player's absence bears on
 * this bet (read from the depth chart), rest and schedule spots, each team's offense against the other's defense, ATS
 * records in tonight's exact situation, and for props the role (snaps, target share, carries) against the position-specific
 * defense. College adds conference records and weights opponents by tier (power conference opponents 1.3x, others 0.8x);
 * snap counts, target shares and depth charts are NFL-only.
 */

type Fb = 'nfl' | 'cfb'

const toLineRec = (r: LineRec): Rec => ({ w: r.w, l: r.l, p: r.p })

/** What an absent starter means for tonight, by position. */
const IMPACT: Record<string, string> = {
  QB: 'a backup quarterback runs the offense',
  RB: 'its backfield loses its starter',
  WR1: 'its top receiver is out',
  WR2: 'its second receiver is out',
  TE: 'its starting tight end is out',
  LT: 'pass protection is compromised',
  DE: 'its pass rush is thinner',
  DT: 'its interior run defense is thinner',
  LB: 'its linebacker group is thinner',
  CB: 'its secondary is short-handed in coverage',
  S: 'its secondary is short-handed in coverage',
}

const listOut = (xs: OutStarter[]) => xs.slice(0, 3).map((x) => `${x.name} (${x.pos}, ${x.status})`).join(', ')
const impact = (x: OutStarter): 'high' | 'medium' | 'low' => (x.weight >= 0.9 ? 'high' : x.weight >= 0.6 ? 'medium' : 'low')
const oppTierScale = (game: GameContext, sport: Fb, opp: string) => (sport === 'cfb' ? (cfbOpponentWeight(game.conference[opp], opp) ?? 1) : 1)

/** Tonight's role from the line: favorite or underdog, home or road. */
function roleKey(home: boolean, line: number | null): 'homeFav' | 'homeDog' | 'roadFav' | 'roadDog' | null {
  if (line === null || line === 0) return null
  return home ? (line < 0 ? 'homeFav' : 'homeDog') : line < 0 ? 'roadFav' : 'roadDog'
}
const ROLE_WORD = { homeFav: 'a home favorite', homeDog: 'a home underdog', roadFav: 'a road favorite', roadDog: 'a road underdog' }

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
  const scale = oppTierScale(game, sport, O)

  // ---- Tier 1: starters who are out (depth chart), then rest and schedule spots.
  const dMine = facts?.depth[T]
  const dTheirs = facts?.depth[O]
  if (dTheirs && dMine) {
    const theirOut = dTheirs.outStarters.filter((x) => impact(x) !== 'low')
    const myOut = dMine.outStarters.filter((x) => impact(x) !== 'low')
    const sum = (xs: OutStarter[]) => xs.reduce((n, x) => n + x.weight, 0)
    if (theirOut.length > 0 && sum(theirOut) - sum(myOut) >= 0.9) {
      const top = [...theirOut].sort((a, b) => b.weight - a.weight)[0]
      push(ev({ tier: 1, text: `${O} is without ${listOut(theirOut)} tonight — ${IMPACT[top.pos === 'WR1' || top.pos === 'WR' ? 'WR1' : top.pos] ?? 'a starter is out'} against ${T}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: Math.min(1, 0.5 + sum(theirOut) / 5), support: 'ESPN depth chart and injury report', n: theirOut.length, ageDays: 0 }))
    } else if (myOut.length > 0 && sum(myOut) - sum(theirOut) >= 0.9) conflicts += sum(myOut) >= 3 ? 2 : 1
  }
  const r1 = game.rest[T]
  const r2 = game.rest[O]
  if (r1 !== null && r1 !== undefined && r2 !== null && r2 !== undefined) {
    if (r1 >= 12 && r1 - r2 >= 3) {
      const bye = mineLines ? toLineRec(atsOrSu(mineLines.spots.offBye)) : null
      push(ev({ tier: 1, text: `${T} is coming off a bye with ${r1} days of rest vs ${r2} for ${O}${bye && played(bye) >= 2 ? ` — ${T}'s ${recWord} off a bye this season: ${recText(bye)}` : ''}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: Math.min(1, 0.55 + (r1 - r2) / 14), support: 'Days since each team last played', n: bye ? played(bye) : undefined, ageDays: 0 }))
    } else if (r1 - r2 >= 3) {
      push(ev({ tier: 1, text: `${T} has ${r1} days of rest vs ${r2} for ${O} tonight${r2 <= 5 ? ` — ${O} is on a short week` : ''}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: Math.min(1, 0.5 + (r1 - r2) / 12), support: 'Days since each team last played', ageDays: 0 }))
    } else if (r2 - r1 >= 3) conflicts++
  }

  // ---- Tier 2: the defense T attacks, by position, and the last two seasons against this opponent.
  const v = facts?.vsPosition[O]
  if (v) {
    const soft: string[] = []
    if (v.rank.QB.passYds > 0 && v.rank.QB.passYds <= 8) soft.push(`${f1(v.allowed.QB.passYdsPg)} passing yards per game to quarterbacks (${ordinal(v.rank.QB.passYds)}-most)`)
    if (v.rank.RB.rushYds > 0 && v.rank.RB.rushYds <= 8) soft.push(`${f1(v.allowed.RB.rushYdsPg)} rushing yards per game to running backs (${ordinal(v.rank.RB.rushYds)}-most)`)
    if (soft.length > 0) push(ev({ tier: 2, text: `${O} has allowed ${soft.join(' and ')} this season — the soft spots in the defense ${T} faces tonight`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: Math.min(1, 0.55 + soft.length * 0.1), support: `${v.allowed.QB.games} games of position-specific stat lines`, n: v.allowed.QB.games, scale }))
  } else {
    const dp = game.defense[O]
    const pts = dp?.Points
    if (pts && pts.rank <= Math.ceil(pts.of / 4)) push(ev({ tier: 2, text: `${O} is allowing ${f1(pts.value)} points per game (${ordinal(pts.rank)}-most of ${pts.of} teams) heading into tonight against ${T}`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: 0.55, support: 'Points allowed per game this season', n: pts.of, scale }))
  }
  const hist = recentSeasons(game, T, 2).filter((g) => g.opp === O && !g.playoff)
  if (hist.length >= 2) {
    const sRec = wins(hist)
    const m = mean(hist.map((g) => g.us - g.them))
    if (sRec.w / played(sRec) >= 0.67 && m > 0) push(ev({ tier: 2, text: `${T} vs ${O} over the last two seasons: ${recText(sRec)} straight up, an average margin of ${signed(m)} — tonight's opponent`, category: 'h2h', horizon: 'career_vs_opp', relevance: recRelevance(sRec.w, sRec.l), support: hist.map((g) => `${g.us}-${g.them}`).join(', ') + ' (most recent first)', n: hist.length, seasonsAgo: 1 }))
  }

  // ---- Tier 3: each team's last five, then the offense against the defense.
  const a5 = (game.results[T] ?? []).slice(0, 5)
  const b5 = (game.results[O] ?? []).slice(0, 5)
  const nMin = game.sport === 'nfl' ? 3 : 4
  if (a5.length >= nMin && b5.length >= nMin) {
    const w5 = wins(a5)
    const strong = a5.filter((g) => (game.leagueWinPct[g.opp] ?? 0) >= 0.5)
    const sw = wins(strong)
    const aM = mean(a5.map((g) => g.us - g.them))
    const bM = mean(b5.map((g) => g.us - g.them))
    const edge = aM - bM
    if (edge >= 3 && w5.w / played(w5) >= 0.6) {
      push(ev({ tier: 3, text: `Last ${a5.length} games: ${T} is ${recText(w5)}${strong.length >= 2 ? ` (${recText(sw)} vs teams at or above .500)` : ''} scoring ${f1(avgFor(a5))} and allowing ${f1(avgAgainst(a5))}; ${O} is ${recText(wins(b5))} scoring ${f1(avgFor(b5))} and allowing ${f1(avgAgainst(b5))} — ${T} has been ${f1(edge)} points per game better heading into tonight`, category: 'recent_form', horizon: 'last7', relevance: Math.min(1, 0.45 + edge / 20), support: `${T} margin ${signed(aM)}, ${O} margin ${signed(bM)} per game`, n: Math.min(a5.length, b5.length), ageDays: 6, metrics: { avg: aM, n: a5.length } }))
    } else if (edge <= -5) conflicts++
  }

  // ---- Tier 4: ATS or straight-up records in tonight's exact situation.
  if (mineLines) {
    const role = roleKey(home, line)
    if (role) {
      const r = toLineRec(atsOrSu(mineLines.roles[role]))
      if (played(r) >= 2 && r.w / played(r) >= 0.6) push(ev({ tier: 4, text: `${T}'s ${recWord} as ${ROLE_WORD[role]} this season: ${recText(r)} — tonight's role${spread ? ` at ${lineText(line as number)}` : ''}`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(r.w, r.l), support: `${mineLines.lined} games with closing lines on file`, n: played(r), smallSample: played(r) < 6 }))
      else if (played(r) >= 3 && r.w / played(r) <= 0.34) conflicts++
    }
    const oppPct = game.leagueWinPct[O]
    if (oppPct !== undefined) {
      const strong = oppPct >= 0.5
      const r = toLineRec(atsOrSu(strong ? mineLines.vsStrong : mineLines.vsWeak))
      if (played(r) >= 3 && r.w / played(r) >= 0.62) push(ev({ tier: 4, text: `${T}'s ${recWord} vs teams ${strong ? 'at or above' : 'under'} .500 this season: ${recText(r)} — ${O} is ${oppPct.toFixed(3).replace(/^0/, '')} tonight`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(r.w, r.l), support: 'Closing lines on file this season', n: played(r), smallSample: played(r) < 6, scale }))
      else if (played(r) >= 3 && r.w / played(r) <= 0.34) conflicts++
    }
    if (sport === 'cfb' && game.conference[T] && game.conference[T] === game.conference[O]) {
      const r = toLineRec(atsOrSu(mineLines.conf))
      if (played(r) >= 2 && r.w / played(r) >= 0.6) push(ev({ tier: 4, text: `${T}'s ${recWord} in conference games this season: ${recText(r)} — tonight is a ${game.conference[T]} game`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(r.w, r.l), support: 'Games against same-conference opponents', n: played(r), smallSample: played(r) < 6 }))
    }
    if (sport === 'nfl') {
      const spots: { key: 'shortWeek' | 'divisional'; on: boolean; text: string }[] = [
        { key: 'shortWeek', on: r1 !== null && r1 !== undefined && r1 <= 5, text: 'on a short week' },
        { key: 'divisional', on: game.flags.divisional, text: 'in divisional games' },
      ]
      for (const s of spots) {
        if (!s.on) continue
        const r = toLineRec(atsOrSu(mineLines.spots[s.key]))
        if (played(r) >= 2 && r.w / played(r) >= 0.67) push(ev({ tier: 4, text: `${T}'s ${recWord} ${s.text} this season: ${recText(r)} — tonight's spot`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: recRelevance(r.w, r.l), support: 'Closing lines on file', n: played(r), smallSample: true }))
      }
    }
  }
  // Opponent's mirror, as the road/home team, from the final scores (a spread number is only tonight's).
  if (spread && line !== null) {
    const oppVenue = atVenue(currentSeason(game, O), !home)
    const mirror = covers(oppVenue, -line)
    if (played(mirror) >= 3 && mirror.w / played(mirror) <= 0.34) push(ev({ tier: 4, text: `${O}'s record covering ${lineText(-line)} ${!home ? 'at home' : 'on the road'} this season: ${recText(mirror)} — the number ${O} has to cover tonight`, category: 'hit_rate', horizon: 'season', relevance: Math.min(1, 0.45 + (0.5 - mirror.w / played(mirror))), support: `${O}'s ${!home ? 'home' : 'road'} games`, n: played(mirror), smallSample: played(mirror) < 6 }))
  }
  return { edges, conflicts }
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
  const facts = game.facts.nfl

  // ---- Tier 1: weather at an open-air stadium, then injuries that move scoring.
  const w = game.weather
  if (w && !w.indoor) {
    const bits: string[] = []
    if (w.windMph !== null && w.windMph >= 15) bits.push(`${Math.round(w.windMph)} mph wind`)
    if (w.tempF !== null && w.tempF <= 32) bits.push(`${Math.round(w.tempF)}°F`)
    if (w.precipitation) bits.push('rain or snow in the forecast')
    if (bits.length > 0) {
      if (!over) push(ev({ tier: 1, text: `${bits.join(', ')} at ${H}'s stadium tonight — conditions that suppress the passing game and scoring, supporting the under ${total}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: Math.min(1, 0.55 + bits.length * 0.12), support: 'Game-time forecast at an open-air venue', ageDays: 0 }))
      else conflicts++
    }
  }
  if (facts) {
    const out = (abbr: string) => facts.depth[abbr]?.outStarters.filter((x) => impact(x) !== 'low') ?? []
    const offense = ['QB', 'WR1', 'WR2', 'TE', 'RB', 'LT']
    const defense = ['CB', 'S', 'DE', 'DT', 'LB']
    const offOut = [...out(A), ...out(H)].filter((x) => offense.includes(x.pos) && x.weight >= 0.9)
    const defOut = [...out(A).map((x) => ({ ...x, team: A })), ...out(H).map((x) => ({ ...x, team: H }))].filter((x) => defense.includes(x.pos) && x.weight >= 0.9)
    if (!over && offOut.length > 0) push(ev({ tier: 1, text: `${offOut.slice(0, 2).map((x) => `${x.name} (${x.pos}, ${x.status})`).join(' and ')} — a starter missing from tonight's offense lowers expected scoring against the ${total}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.6, support: 'ESPN depth charts and injury report', n: offOut.length, ageDays: 0 }))
    else if (over && offOut.length > 0) conflicts++
    if (over && defOut.length > 0) {
      const byTeam = [A, H].map((tm) => ({ tm, xs: defOut.filter((x) => x.team === tm).slice(0, 2) })).filter((x) => x.xs.length > 0)
      push(ev({ tier: 1, text: `${byTeam.map((x) => `${x.tm} is without ${x.xs.map((p) => `${p.name} (${p.pos}, ${p.status})`).join(' and ')}`).join('; ')} — defensive starters missing raise expected scoring against the ${total}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.55, support: 'ESPN depth charts and injury report', n: defOut.length, ageDays: 0 }))
    }
  }

  // ---- Tier 2: each defense separately.
  const da = game.defense[A]?.Points
  const dh = game.defense[H]?.Points
  if (da && dh) {
    const softBoth = da.rank <= Math.ceil(da.of / 2) && dh.rank <= Math.ceil(dh.of / 2) && Math.min(da.rank, dh.rank) <= Math.ceil(da.of / 3)
    const toughBoth = da.rank > Math.floor(da.of / 2) && dh.rank > Math.floor(dh.of / 2) && Math.max(da.rank, dh.rank) > Math.floor((da.of * 2) / 3)
    if ((over && softBoth) || (!over && toughBoth)) {
      push(ev({ tier: 2, text: `${A} allows ${f1(da.value)} points per game (${over ? ordinal(da.rank) + '-most' : ordinal(da.of - da.rank + 1) + '-fewest'} of ${da.of}); ${H} allows ${f1(dh.value)} (${over ? ordinal(dh.rank) + '-most' : ordinal(dh.of - dh.rank + 1) + '-fewest'}) — two defenses ${over ? 'that give up points' : 'that hold teams down'} meet tonight`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: 0.6, support: 'Points allowed per game this season', n: da.of }))
    } else if ((over && toughBoth) || (!over && softBoth)) conflicts++
  }

  // ---- Tier 3: recent scoring, each team separately, with the combined figure only as the summary.
  const nMin = game.sport === 'nfl' ? 3 : 4
  const a5 = (game.results[A] ?? []).slice(0, 5)
  const h5 = (game.results[H] ?? []).slice(0, 5)
  if (a5.length >= nMin && h5.length >= nMin) {
    const combined = avgFor(a5) + avgFor(h5)
    const proj = (avgFor(a5) + avgAgainst(h5)) / 2 + (avgFor(h5) + avgAgainst(a5)) / 2
    const gap = proj - total
    const scale = game.sport === 'nfl' ? 3 : 4
    if ((over && gap >= scale) || (!over && gap <= -scale)) {
      push(ev({ tier: 3, text: `Last ${Math.min(a5.length, h5.length)} games: ${A} scoring ${f1(avgFor(a5))} and allowing ${f1(avgAgainst(a5))}; ${H} scoring ${f1(avgFor(h5))} and allowing ${f1(avgAgainst(h5))} — combined ${f1(combined)} scored, with the two matchups projecting to ${f1(proj)} against tonight's ${total}`, category: 'recent_form', horizon: 'last7', relevance: Math.min(1, 0.45 + Math.abs(gap) / (scale * 4)), support: 'Final scores, last five games each', n: Math.min(a5.length, h5.length), ageDays: 6 }))
    } else if ((over && gap <= -scale) || (!over && gap >= scale)) conflicts++
    const ra = totalSide(a5, total, over)
    const rh = totalSide(h5, total, over)
    if ((ra.w + rh.w) / (played(ra) + played(rh)) >= 0.65 && played(ra) >= nMin) {
      push(ev({ tier: 3, text: `${A}: ${word} ${total} in ${ra.w} of the last ${played(ra) + ra.p} games; ${H}: ${word} ${total} in ${rh.w} of the last ${played(rh) + rh.p} — each team's own record at tonight's number`, category: 'recent_form', horizon: 'last7', relevance: recRelevance(ra.w + rh.w, played(ra) + played(rh) - ra.w - rh.w), support: 'Final scores against tonight\'s total', n: Math.min(played(ra), played(rh)), ageDays: 6, metrics: { rate: (ra.w + rh.w) / (played(ra) + played(rh)), n: played(ra) } }))
    }
  }
  // ---- Tier 4: season O/U at this number, each team separately, plus the venue each plays tonight.
  const curA = currentSeason(game, A)
  const curH = currentSeason(game, H)
  const sa = totalSide(curA, total, over)
  const sh = totalSide(curH, total, over)
  if (curA.length >= nMin && curH.length >= nMin && (sa.w + sh.w) / Math.max(1, played(sa) + played(sh)) >= 0.6) {
    push(ev({ tier: 4, text: `${A}: ${word} ${total} in ${sa.w} of ${curA.length} games this season; ${H}: ${word} ${total} in ${sh.w} of ${curH.length}`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(sa.w + sh.w, played(sa) + played(sh) - sa.w - sh.w), support: 'Final scores this season', n: Math.min(curA.length, curH.length), smallSample: Math.min(curA.length, curH.length) < 6 }))
  }
  const va = totalSide(atVenue(curA, false), total, over)
  const vh = totalSide(atVenue(curH, true), total, over)
  if (played(va) >= 2 && played(vh) >= 2 && (va.w + vh.w) / (played(va) + played(vh)) >= 0.67) {
    push(ev({ tier: 4, text: `${A} on the road: ${word} ${total} in ${va.w} of ${played(va) + va.p} games; ${H} at home: ${word} ${total} in ${vh.w} of ${played(vh) + vh.p} — the venues for tonight's game`, category: 'hit_rate', horizon: 'season', relevance: 0.55, support: 'Road games for the visitor, home games for the host', n: Math.min(played(va), played(vh)), smallSample: true }))
  }
  // Game script from the posted spread.
  const { margin } = scriptOf(game, H)
  if (margin !== null) {
    const spread = Math.abs(margin)
    if (!over && spread >= 10) push(ev({ tier: 4, text: `The ${f1(spread)}-point spread points to a one-sided game — the leader runs the clock late, which trims the total against the ${total}`, category: 'role', horizon: 'tonight', layer: 'opportunity', relevance: 0.55, support: 'Spread-implied game flow', n: 1, ageDays: 0 }))
    else if (over && spread <= 3 && total >= (sport === 'nfl' ? 45 : 55)) push(ev({ tier: 4, text: `The ${f1(spread)}-point spread points to a close game — both offenses stay aggressive for longer, supporting the over ${total}`, category: 'role', horizon: 'tonight', layer: 'opportunity', relevance: 0.5, support: 'Spread-implied game flow', n: 1, ageDays: 0 }))
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
  const player = facts?.players[`${slugify(o.player.name)}|${T}`]
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

  // ---- Tier 1: the weather, the secondary or front seven he faces, and the script the spread points to.
  const w = game.weather
  if (w && !w.indoor && (passing || receiving)) {
    const bits: string[] = []
    if (w.windMph !== null && w.windMph >= 15) bits.push(`${Math.round(w.windMph)} mph wind`)
    if (w.precipitation) bits.push('rain or snow in the forecast')
    if (bits.length > 0) {
      if (!over) push(ev({ tier: 1, text: `${bits.join(' and ')} at ${game.home}'s stadium tonight — conditions that suppress the passing game for ${name}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.6, support: 'Game-time forecast at an open-air venue', ageDays: 0 }))
      else conflicts++
    }
  }
  const dO = O ? facts?.depth[O] : undefined
  if (dO && over && (passing || receiving)) {
    const cbs = dO.cbs.filter((c) => c.status && /out|doubtful|injured reserve/i.test(c.status))
    const lim = dO.cbs.filter((c) => c.status && /questionable|day-to-day/i.test(c.status))
    const slot = facts?.depth[T]?.slots[slugify(o.player.name)]
    if (cbs.length > 0 && receiving) {
      push(ev({ tier: 1, text: `${O}'s starting cornerback${cbs.length > 1 ? 's' : ''} ${cbs.map((c) => `${c.name} (${c.slot}, ${/doubtful/i.test(c.status ?? '') ? 'doubtful' : 'out'})`).join(' and ')} ${cbs.length > 1 ? 'are' : 'is'} out tonight${lim.length ? `, with ${lim.map((c) => `${c.name} (${c.slot}) ${c.status?.toLowerCase()}`).join(' and ')}` : ''} — a thinner outside group for ${name}${slot ? ` (${slot})` : ''}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: Math.min(1, 0.6 + 0.15 * cbs.length), support: 'ESPN depth chart and injury report', n: cbs.length, ageDays: 0 }))
    } else if (cbs.length > 0 && passing) {
      push(ev({ tier: 1, text: `${O}'s secondary is missing ${cbs.map((c) => `${c.name} (${c.slot})`).join(' and ')} tonight — fewer defenders to cover ${name}'s receivers`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.55, support: 'ESPN depth chart and injury report', n: cbs.length, ageDays: 0 }))
    } else if (lim.length > 0 && receiving) {
      push(ev({ tier: 1, text: `${O}'s starting cornerback ${lim.map((c) => `${c.name} (${c.slot})`).join(' and ')} is listed ${lim[0].status?.toLowerCase()} — his coverage snaps against ${name} are in question tonight`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.45, support: 'ESPN depth chart and injury report', n: lim.length, ageDays: 0 }))
    }
  }
  if (dO && over && rushing) {
    const front = dO.outStarters.filter((x) => ['DT', 'DE', 'LB'].includes(x.pos) && impact(x) !== 'low')
    if (front.length > 0) push(ev({ tier: 1, text: `${O} is missing ${listOut(front)} up front tonight — ${IMPACT[front[0].pos]} against ${name}'s rushing attack`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: Math.min(1, 0.5 + front.length * 0.12), support: 'ESPN depth chart and injury report', n: front.length, ageDays: 0 }))
  }
  // Own offensive line or quarterback problems run against the bet.
  const dT = facts?.depth[T]
  if (dT && over) {
    if (dT.outStarters.some((x) => x.pos === 'QB') && (passing || receiving)) conflicts += 2
    if (dT.outStarters.some((x) => x.pos === 'LT') && (passing || rushing)) conflicts++
  }
  if (margin !== null) {
    if (passing || receiving) {
      if (over && margin <= -3.5) push(ev({ tier: 1, text: `${T} is a ${f1(Math.abs(margin))}-point underdog tonight — a trailing game script means more pass attempts, and more volume for ${name}`, category: 'role', horizon: 'tonight', layer: 'opportunity', relevance: Math.min(1, 0.5 + Math.abs(margin) / 20), support: 'Spread-implied game flow', n: 1, ageDays: 0 }))
      else if (over && margin >= 9) conflicts++
      else if (!over && margin >= 9) push(ev({ tier: 1, text: `${T} is a ${f1(margin)}-point favorite tonight — a lead shifts the offense to the run game and trims ${name}'s passing volume`, category: 'role', horizon: 'tonight', layer: 'opportunity', relevance: 0.55, support: 'Spread-implied game flow', n: 1, ageDays: 0 }))
    } else if (rushing) {
      if (over && margin >= 3.5) push(ev({ tier: 1, text: `${T} is a ${f1(margin)}-point favorite tonight — leading late means ball control and a heavier share of carries for ${name}`, category: 'role', horizon: 'tonight', layer: 'opportunity', relevance: Math.min(1, 0.5 + margin / 20), support: 'Spread-implied game flow', n: 1, ageDays: 0 }))
      else if (over && margin <= -7) conflicts++
      else if (!over && margin <= -7) push(ev({ tier: 1, text: `${T} is a ${f1(Math.abs(margin))}-point underdog tonight — trailing scripts lean pass-heavy and cut into ${name}'s carries`, category: 'role', horizon: 'tonight', layer: 'opportunity', relevance: 0.55, support: 'Spread-implied game flow', n: 1, ageDays: 0 }))
    }
  }

  // ---- Tier 2: the position-specific defense, the role behind the number, the career record against this team.
  const v = O ? facts?.vsPosition[O] : undefined
  if (v && (passing || rushing || receiving)) {
    if (passing && v.rank.QB.passYds > 0) {
      const rank = v.rank.QB.passYds
      const soft = rank <= 10
      const tough = rank > v.of - 10
      const al = v.allowed.QB
      if ((over && soft) || (!over && tough)) push(ev({ tier: 2, text: `${O} has allowed ${f1(al.passYdsPg)} passing yards per game to quarterbacks (${soft ? ordinal(rank) + '-most' : ordinal(v.of - rank + 1) + '-fewest'} in the NFL) on a ${Math.round(al.compPct * 100)}% completion rate — the defense ${name} faces tonight`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: Math.min(1, 0.55 + (soft ? 10 - rank : rank - (v.of - 10)) / 20), support: `${al.games} games, quarterback stat lines only`, n: al.games, metrics: { avg: al.passYdsPg, n: al.games }, scale }))
      else if ((over && tough) || (!over && soft)) conflicts++
    }
    if (rushing && v.rank.RB.rushYds > 0) {
      const rank = v.rank.RB.rushYds
      const soft = rank <= 10
      const tough = rank > v.of - 10
      const al = v.allowed.RB
      const ypc = al.carriesPg > 0 ? al.rushYdsPg / al.carriesPg : 0
      if ((over && soft) || (!over && tough)) push(ev({ tier: 2, text: `${O} has allowed ${f1(al.rushYdsPg)} rushing yards per game to running backs (${ypc.toFixed(1)} per carry, ${soft ? ordinal(rank) + '-most' : ordinal(v.of - rank + 1) + '-fewest'} in the NFL) — the run defense ${name} faces tonight`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: Math.min(1, 0.55 + (soft ? 10 - rank : rank - (v.of - 10)) / 20), support: `${al.games} games, running back stat lines only`, n: al.games, metrics: { avg: al.rushYdsPg, n: al.games }, scale }))
      else if ((over && tough) || (!over && soft)) conflicts++
    }
    if (receiving && (pos === 'WR' || pos === 'TE' || pos === 'RB')) {
      const al = v.allowed[pos]
      const rk = v.rank[pos]
      const yards = cat === 'Receiving Yards'
      const rank = yards ? (pos === 'RB' ? 0 : rk.recYds) : rk.rec
      const value = yards ? al.recYdsPg : al.recPg
      const label = pos === 'RB' ? 'running backs' : pos === 'TE' ? 'tight ends' : 'wide receivers'
      if (rank > 0 && value > 0) {
        const soft = rank <= 10
        const tough = rank > v.of - 10
        if ((over && soft) || (!over && tough)) push(ev({ tier: 2, text: `${O} has allowed ${f1(value)} ${yards ? 'receiving yards' : 'receptions'} per game to ${label} (${soft ? ordinal(rank) + '-most' : ordinal(v.of - rank + 1) + '-fewest'} in the NFL) — the position ${name} plays tonight`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: Math.min(1, 0.55 + (soft ? 10 - rank : rank - (v.of - 10)) / 20), support: `${al.games} games, ${label} stat lines only`, n: al.games, metrics: { avg: value, n: al.games }, scale }))
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
    // Receiving role: target share first.
    if (receiving) {
      const shares = rec.map((g) => g.targetShare).filter((x): x is number => x !== null)
      const seasonShares = player.games.map((g) => g.targetShare).filter((x): x is number => x !== null)
      if (shares.length >= 3) {
        const s4 = mean(shares)
        const season = mean(seasonShares)
        const floor = pos === 'WR' ? 0.2 : 0.15
        const tg = mean(rec.map((g) => g.targets))
        if (over && s4 >= floor) push(ev({ tier: 2, text: `${name} has commanded a ${Math.round(s4 * 100)}% target share over the last ${shares.length} games (${f1(tg)} targets per game vs ${Math.round(season * 100)}% for the season) — the volume behind tonight's ${propLine(o)}`, category: 'role', horizon: 'last7', layer: 'opportunity', relevance: Math.min(1, 0.5 + (s4 - floor) * 3), support: `Targets by game: ${rec.map((g) => g.targets).join(', ')} (most recent first)`, n: shares.length, ageDays: 7, metrics: { rate: s4, avg: tg, n: shares.length } }))
        else if (over && s4 <= floor - 0.07) conflicts++
        else if (!over && s4 <= floor - 0.06) push(ev({ tier: 2, text: `${name}'s target share has slipped to ${Math.round(s4 * 100)}% over the last ${shares.length} games (${Math.round(season * 100)}% for the season) — fewer looks tonight lower the ceiling on ${propLine(o)}`, category: 'role', horizon: 'last7', layer: 'opportunity', relevance: 0.6, support: 'Target share by game', n: shares.length, ageDays: 7 }))
      }
      const ays = rec.map((g) => g.airYardsShare).filter((x): x is number => x !== null)
      if (cat === 'Receiving Yards' && over && ays.length >= 3) {
        const a4 = mean(ays)
        const tg = rec.reduce((n, g) => n + g.targets, 0)
        const air = rec.reduce((n, g) => n + g.airYards, 0)
        if (a4 >= 0.28) push(ev({ tier: 2, text: `${name} holds a ${Math.round(a4 * 100)}% share of his team's air yards over the last ${ays.length} games${tg > 0 ? ` (${f1(air / tg)} air yards per target)` : ''} — a downfield role behind tonight's receiving-yards line`, category: 'role', horizon: 'last7', layer: 'opportunity', relevance: Math.min(1, 0.5 + (a4 - 0.28) * 2), support: 'nflverse weekly receiving data', n: ays.length, ageDays: 7, metrics: { rate: a4, n: ays.length } }))
      }
    }
    // Snap share (backs and receivers).
    const snaps = player.games.slice(0, 3).map((g) => g.snapPct).filter((x): x is number => x !== null)
    if (snaps.length >= 3 && (rushing || receiving)) {
      const s = mean(snaps)
      if (over && s >= (rushing ? 0.6 : 0.75)) push(ev({ tier: 2, text: `${name} has played ${Math.round(s * 100)}% of offensive snaps over the last ${snaps.length} games (${player.games.slice(0, 3).map((g) => (g.snapPct === null ? '—' : `${Math.round(g.snapPct * 100)}%`)).join(', ')}) — ${rushing ? (s >= 0.7 ? 'the clear lead back' : 'a primary backfield role') : 'an every-down role'} heading into tonight`, category: 'role', horizon: 'last7', layer: 'opportunity', relevance: Math.min(1, 0.5 + (s - 0.55) * 1.6), support: 'nflverse snap counts', n: snaps.length, ageDays: 7, metrics: { rate: s, n: snaps.length } }))
      else if (over && s <= (rushing ? 0.45 : 0.5)) conflicts++
      else if (!over && rushing && s <= 0.45) push(ev({ tier: 2, text: `${name} has played only ${Math.round(s * 100)}% of offensive snaps over the last ${snaps.length} games — a committee role tonight`, category: 'role', horizon: 'last7', layer: 'opportunity', relevance: 0.6, support: 'nflverse snap counts', n: snaps.length, ageDays: 7 }))
    }
    // Rushing: carries and the share of the team's carries.
    if (rushing) {
      const last4 = player.games.slice(0, 4)
      if (last4.length >= 3 && facts) {
        const carries = mean(last4.map((g) => g.carries))
        let mine = 0
        let team = 0
        for (const g of last4) {
          mine += g.carries
          for (const other of Object.values(facts.players)) {
            if (other.team !== player.team || other.position === 'QB') continue
            const og = other.games.find((x) => x.week === g.week)
            if (og) team += og.carries
          }
        }
        if (over && carries >= 12) push(ev({ tier: 2, text: `${name} is averaging ${f1(carries)} carries over the last ${last4.length} games${team > 0 ? ` — ${Math.round((mine / team) * 100)}% of the team's running back carries` : ''} heading into tonight's ${propLine(o)}`, category: 'role', horizon: 'last7', layer: 'opportunity', relevance: Math.min(1, 0.5 + (carries - 12) / 12), support: `Carries by game: ${last4.map((g) => g.carries).join(', ')} (most recent first)`, n: last4.length, ageDays: 7, metrics: { avg: carries, n: last4.length } }))
      }
    }
    // Passing volume.
    if (passing) {
      const last4 = player.games.slice(0, 4).filter((g) => g.att > 0)
      if (last4.length >= 3) {
        const att = mean(last4.map((g) => g.att))
        if (over && att >= 36) push(ev({ tier: 2, text: `${name} is averaging ${f1(att)} pass attempts over the last ${last4.length} games (${f1(mean(last4.map((g) => g.passYds)))} yards per game) — the volume behind tonight's ${propLine(o)}`, category: 'role', horizon: 'last7', layer: 'opportunity', relevance: Math.min(1, 0.5 + (att - 36) / 14), support: `Attempts by game: ${last4.map((g) => g.att).join(', ')} (most recent first)`, n: last4.length, ageDays: 7, metrics: { avg: att, n: last4.length } }))
      }
    }
  }
  merge(vsOpponentCareer(o, history, sport === 'nfl' ? 1 : 2))

  // ---- Tier 3-5: last games at the number, this season's venue split, season record.
  merge(recentAtLine(o, history, 3, [3, 5, 8]))
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

export type { TeamGameRecord }
