import { cbbOpponentWeight } from '../data/cbb'
import { scriptOf, type ModuleInput } from '../modules/shared'
import type { BettingOutcome, Edge, GameContext, ModuleOutput } from '../types'
import { foundationEdges } from './foundationItems'
import { ev, f1, lineText, ordinal, plural, recRelevance, recText, signed } from './format'
import { backToBackSplit, priorSeasonAtLine, propName, recentAtLine, seasonAtLine, vsOpponentCareer } from './props'
import { atVenue, avgAgainst, avgFor, covers, currentSeason, games as played, recentSeasons, totalSide, vsOpp, vsTier, wins, type Rec } from './records'

/**
 * Basketball evidence (NBA and college). Early in a season the current year is a handful of games, so the evidence leans on
 * history against this opponent and last season's numbers, and says so; the current-season items are flagged as early-season
 * signals until the sample builds. College adds a conference-strength weight on opponent-specific items and the home-court
 * record as its own item (college home courts are worth more than the NBA's).
 */

type Bb = 'nba' | 'cbb'
const tierScale = (game: GameContext, sport: Bb, opp: string) => (sport === 'cbb' ? (cbbOpponentWeight(game.conference[opp]) ?? 1) : 1)

function bbSide({ outcome: o, game }: ModuleInput, sport: Bb): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  const t = o.team
  if (!t) return { edges, conflicts }
  const T = t.abbr
  const O = t.opponent
  const spread = o.type === 'spread' && o.threshold !== undefined
  const line = o.threshold ?? 0
  const home = t.home
  const push = (e: Edge) => edges.push(e)
  const tally = (gs: ReturnType<typeof currentSeason>): Rec => (spread ? covers(gs, line) : wins(gs))
  const recWord = spread ? `record covering ${lineText(line)}` : 'record'
  const scale = tierScale(game, sport, O)
  const mineLines = T === game.home ? game.facts.lines?.home : game.facts.lines?.away

  // ---- Tier 1: rest and the schedule, then players who are out (25+ minutes a game).
  const r1 = game.rest[T]
  const r2 = game.rest[O]
  if (r1 !== null && r1 !== undefined && r2 !== null && r2 !== undefined) {
    if (r2 === 0 && r1 >= 1) push(ev({ tier: 1, text: `${O} is on the second night of a back-to-back tonight (0 days of rest) vs ${plural(r1, 'day')} of rest for ${T} — a rest edge for ${T}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.7, support: 'Days since each team last played', n: 1, ageDays: 0 }))
    else if (r1 === 0 && r2 >= 1) conflicts++
  }
  const four = game.facts.nba?.gamesInFour
  if (four && four[O] >= 3 && four[T] <= 2) push(ev({ tier: 1, text: `${O} is playing its third game in four nights while ${T} has played ${four[T]} of the last 4 nights — a fatigue gap going into tonight`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.55, support: 'Schedule', n: 1, ageDays: 0 }))
  else if (four && four[T] >= 3 && four[O] <= 2) conflicts++

  const fnd = foundationEdges(o, game)
  edges.push(...fnd.edges)
  conflicts += fnd.conflicts

  // ---- Tier 2: this opponent this season and over the last two seasons, then the defense T faces.
  const cur = currentSeason(game, T)
  const vsThis = vsOpp(cur, O)
  const rv = tally(vsThis)
  if (played(rv) >= 2 && rv.w / played(rv) >= 0.6) push(ev({ tier: 2, text: `${T}'s ${recWord} vs ${O} this season: ${recText(rv)} vs ${recText(tally(cur))} across all games — ${O} is tonight's opponent`, category: 'h2h', horizon: 'season_vs_opp', relevance: recRelevance(rv.w, rv.l), support: `${vsThis.length} meetings`, n: vsThis.length, smallSample: true, scale }))
  const hist = recentSeasons(game, T, 2).filter((g) => g.opp === O && !g.playoff)
  if (hist.length >= 3) {
    const sRec = wins(hist)
    const mg = hist.reduce((n, g) => n + g.us - g.them, 0) / hist.length
    if (sRec.w / played(sRec) >= 0.65 && mg > 0) push(ev({ tier: 2, text: `${T} vs ${O} over the last two seasons: ${recText(sRec)} straight up, an average margin of ${signed(mg)} points vs ${signed(avgFor(cur) - avgAgainst(cur))} across all games this season — ${O} is tonight's opponent`, category: 'h2h', horizon: 'career_vs_opp', relevance: recRelevance(sRec.w, sRec.l), support: hist.slice(0, 6).map((g) => `${g.us}-${g.them}`).join(', ') + ' (most recent first)', n: hist.length, seasonsAgo: 1, scale }))
  }
  const dp = game.defense[O]?.Points
  if (dp && dp.rank <= Math.ceil(dp.of / 4)) push(ev({ tier: 2, text: `${O} allows ${f1(dp.value)} points per game (${ordinal(dp.rank)}-most of ${dp.of} teams) — the defense ${T} faces tonight, with ${T} scoring ${f1(avgFor(cur))} per game`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: 0.55, support: 'Points allowed per game this season', n: dp.of, scale }))

  // ---- Tier 3: last five and last ten, each team separately.
  const a5 = (game.results[T] ?? []).slice(0, 5)
  const b5 = (game.results[O] ?? []).slice(0, 5)
  if (a5.length >= 3 && b5.length >= 3) {
    const aM = avgFor(a5) - avgAgainst(a5)
    const bM = avgFor(b5) - avgAgainst(b5)
    if (aM - bM >= 4 && wins(a5).w / played(wins(a5)) >= 0.6) push(ev({ tier: 3, text: `Last ${a5.length} games: ${T} is ${recText(wins(a5))} scoring ${f1(avgFor(a5))} and allowing ${f1(avgAgainst(a5))}; ${O} is ${recText(wins(b5))} scoring ${f1(avgFor(b5))} and allowing ${f1(avgAgainst(b5))} — ${T} is ${f1(aM - bM)} points per game better heading into tonight`, category: 'recent_form', horizon: 'last7', relevance: Math.min(1, 0.45 + (aM - bM) / 25), support: `${T} margin ${signed(aM)}, ${O} margin ${signed(bM)} per game`, n: Math.min(a5.length, b5.length), ageDays: 3, smallSample: a5.length < 8, metrics: { avg: aM, n: a5.length } }))
    else if (bM - aM >= 6) conflicts++
  }

  // ---- Tier 4: ATS or straight-up records in tonight's situation (flagged as early season).
  if (mineLines) {
    const venue = tally(atVenue(cur, home))
    if (played(venue) >= 2 && venue.w / played(venue) >= 0.6) push(ev({ tier: 4, text: `${T}'s ${recWord} ${home ? 'at home' : 'on the road'} this season: ${recText(venue)}${played(tally(atVenue(cur, !home))) >= 2 ? ` vs ${recText(tally(atVenue(cur, !home)))} ${home ? 'on the road' : 'at home'}` : ` vs ${recText(tally(cur))} across all games`} — early-season sample of ${played(venue) + venue.p}, tonight is a ${home ? 'home' : 'road'} game`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(venue.w, venue.l), support: `${home ? 'Home' : 'Road'} games`, n: played(venue), smallSample: true }))
  }
  if (sport === 'cbb') {
    const homeRec = wins(atVenue(cur, true))
    if (home && played(homeRec) >= 3 && homeRec.w / played(homeRec) >= 0.7) push(ev({ tier: 4, text: `Home court factor — ${T} is ${recText(homeRec)} at home this season${played(wins(atVenue(cur, false))) >= 2 ? ` vs ${recText(wins(atVenue(cur, false)))} on the road` : ''}; tonight's game is at ${T}'s arena, where college home courts carry more weight than the pros`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(homeRec.w, homeRec.l), support: 'Home games this season', n: played(homeRec), smallSample: played(homeRec) < 8 }))
  }
  const oppPct = game.leagueWinPct[O]
  if (oppPct !== undefined) {
    const strong = oppPct >= 0.5
    const r = tally(vsTier(cur, game, strong))
    if (played(r) >= 3 && r.w / played(r) >= 0.62) push(ev({ tier: 4, text: `${T}'s ${recWord} vs teams ${strong ? 'at or above' : 'under'} .500 this season: ${recText(r)}${played(tally(vsTier(cur, game, !strong))) >= 2 ? ` vs ${recText(tally(vsTier(cur, game, !strong)))} against teams ${strong ? 'under' : 'at or above'} .500` : ` vs ${recText(tally(cur))} across all games`} — ${O} is at ${oppPct.toFixed(3).replace(/^0/, '')} tonight`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(r.w, r.l), support: 'Opponent quality from the standings', n: played(r), smallSample: true, scale }))
  }
  return { edges, conflicts }
}

function bbTotal({ outcome: o, game }: ModuleInput, sport: Bb): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  if (o.threshold === undefined) return { edges, conflicts }
  const total = o.threshold
  const over = o.direction !== 'under'
  const word = over ? 'Over' : 'Under'
  const A = game.away
  const H = game.home
  const push = (e: Edge) => edges.push(e)

  // ---- Tier 1: back-to-backs, tight schedules, rotation players out.
  const b2b = ([A, H] as const).filter((x) => game.rest[x] === 0)
  if (!over && b2b.length > 0) push(ev({ tier: 1, text: `${b2b.join(' and ')} ${b2b.length > 1 ? 'are' : 'is'} on the second night of a back-to-back tonight (0 days of rest vs ${b2b.length > 1 ? 'the usual 1+' : plural(game.rest[b2b[0] === A ? H : A] ?? 1, 'day')}) — tired legs slow the pace and shooting, supporting the under ${total}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.5, support: 'Days since each team last played', n: b2b.length, ageDays: 0 }))
  else if (over && b2b.length > 0) conflicts++

  const fnd = foundationEdges(o, game)
  edges.push(...fnd.edges)
  conflicts += fnd.conflicts

  // ---- Tier 2: each defense separately, and the scoring environment each team plays in.
  const da = game.defense[A]?.Points
  const dh = game.defense[H]?.Points
  if (da && dh) {
    const softBoth = da.rank <= Math.ceil(da.of / 2) && dh.rank <= Math.ceil(dh.of / 2) && Math.min(da.rank, dh.rank) <= Math.ceil(da.of / 3)
    const toughBoth = da.rank > Math.floor(da.of / 2) && dh.rank > Math.floor(dh.of / 2) && Math.max(da.rank, dh.rank) > Math.floor((da.of * 2) / 3)
    if ((over && softBoth) || (!over && toughBoth)) push(ev({ tier: 2, text: `${A} allows ${f1(da.value)} points per game (${over ? ordinal(da.rank) + '-most' : ordinal(da.of - da.rank + 1) + '-fewest'} of ${da.of}); ${H} allows ${f1(dh.value)} (${over ? ordinal(dh.rank) + '-most' : ordinal(dh.of - dh.rank + 1) + '-fewest'}) — ${over ? 'two defenses that give up points' : 'two defenses that hold teams down'} meet tonight`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: 0.6, support: 'Points allowed per game this season', n: da.of, smallSample: true }))
    else if ((over && toughBoth) || (!over && softBoth)) conflicts++
  }
  const cA = currentSeason(game, A)
  const cH = currentSeason(game, H)
  if (cA.length >= 3 && cH.length >= 3) {
    const paceA = cA.reduce((n, g) => n + g.us + g.them, 0) / cA.length
    const paceH = cH.reduce((n, g) => n + g.us + g.them, 0) / cH.length
    if ((over && paceA > total && paceH > total) || (!over && paceA < total && paceH < total)) push(ev({ tier: 2, text: `${A}'s games this season average ${f1(paceA)} total points; ${H}'s average ${f1(paceH)} — both teams play at a ${over ? 'pace above' : 'pace below'} tonight's ${total} line`, category: 'matchup', horizon: 'season', layer: 'opportunity', relevance: Math.min(1, 0.5 + Math.abs((paceA + paceH) / 2 - total) / 20), support: 'Total points in each team\'s games', n: Math.min(cA.length, cH.length), smallSample: Math.min(cA.length, cH.length) < 8 }))
  }

  // ---- Tier 3: recent scoring each, O/U last ten each.
  const a10 = (game.results[A] ?? []).slice(0, 10)
  const h10 = (game.results[H] ?? []).slice(0, 10)
  if (a10.length >= 3 && h10.length >= 3) {
    const combined = avgFor(a10) + avgFor(h10)
    const gap = combined - total
    const sc = sport === 'nba' ? 6 : 8
    if ((over && gap >= sc) || (!over && gap <= -sc)) push(ev({ tier: 3, text: `${A}: scoring ${f1(avgFor(a10))} per game and allowing ${f1(avgAgainst(a10))} over the last ${a10.length}; ${H}: scoring ${f1(avgFor(h10))} and allowing ${f1(avgAgainst(h10))} over the last ${h10.length} (season averages: ${f1(avgFor(cA))} scored by ${A}, ${f1(avgFor(cH))} by ${H}) — combined ${f1(combined)} over the stretch against tonight's ${total} line`, category: 'recent_form', horizon: 'last15', relevance: Math.min(1, 0.45 + Math.abs(gap) / (sc * 3)), support: 'Final scores, last ten games each', n: Math.min(a10.length, h10.length), ageDays: 3, smallSample: Math.min(a10.length, h10.length) < 8 }))
    else if ((over && gap <= -sc) || (!over && gap >= sc)) conflicts++
    const ra = totalSide(a10, total, over)
    const rh = totalSide(h10, total, over)
    if ((ra.w + rh.w) / Math.max(1, played(ra) + played(rh)) >= 0.65) push(ev({ tier: 3, text: `${A}: ${word} ${total} in ${ra.w} of the last ${played(ra) + ra.p} games vs ${totalSide(cA, total, over).w} of ${cA.length} on the season; ${H}: ${word} ${total} in ${rh.w} of the last ${played(rh) + rh.p} vs ${totalSide(cH, total, over).w} of ${cH.length} — each team's own record against tonight's number`, category: 'recent_form', horizon: 'last15', relevance: recRelevance(ra.w + rh.w, played(ra) + played(rh) - ra.w - rh.w), support: 'Final scores against tonight\'s number', n: Math.min(played(ra), played(rh)), ageDays: 3, smallSample: true, metrics: { rate: (ra.w + rh.w) / (played(ra) + played(rh)), n: played(ra) } }))
  }
  // ---- Tier 4/6: this season's records at the number, with last season as the early-season anchor.
  const sA = totalSide(cA, total, over)
  const sH = totalSide(cH, total, over)
  if (cA.length >= 3 && cH.length >= 3 && (sA.w + sH.w) / Math.max(1, played(sA) + played(sH)) >= 0.6) push(ev({ tier: 4, text: `${A}: ${word} ${total} in ${sA.w} of ${cA.length} games this season; ${H}: ${word} ${total} in ${sH.w} of ${cH.length} — each against tonight's ${total} number, an early-season sample`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(sA.w + sH.w, played(sA) + played(sH) - sA.w - sH.w), support: 'Final scores this season', n: Math.min(cA.length, cH.length), smallSample: true }))
  const lastA = recentSeasons(game, A, 2).filter((g) => !cA.includes(g))
  const lastH = recentSeasons(game, H, 2).filter((g) => !cH.includes(g))
  const pA = totalSide(lastA, total, over)
  const pH = totalSide(lastH, total, over)
  if (cA.length < 10 && played(pA) >= 30 && played(pH) >= 30 && (pA.w + pH.w) / (played(pA) + played(pH)) >= 0.56) push(ev({ tier: 6, text: `Last season: ${A} ${word} ${total} in ${pA.w} of ${played(pA) + pA.p} games; ${H} ${word} ${total} in ${pH.w} of ${played(pH) + pH.p} — only ${cA.length} games played this year, so last season anchors tonight`, category: 'hit_rate', horizon: 'career', relevance: recRelevance(pA.w + pH.w, played(pA) + played(pH) - pA.w - pH.w), support: 'Previous season final scores', n: Math.min(played(pA), played(pH)), seasonsAgo: 1 }))
  const vA = totalSide(atVenue(cA, false), total, over)
  const vH = totalSide(atVenue(cH, true), total, over)
  if (played(vA) >= 2 && played(vH) >= 2 && (vA.w + vH.w) / (played(vA) + played(vH)) >= 0.7) push(ev({ tier: 4, text: `${A} on the road: ${word} ${total} in ${vA.w} of ${played(vA) + vA.p} games; ${H} at home: ${word} ${total} in ${vH.w} of ${played(vH) + vH.p} — the venues for tonight's game`, category: 'hit_rate', horizon: 'season', relevance: 0.5, support: 'Road games for the visitor, home games for the host', n: Math.min(played(vA), played(vH)), smallSample: true }))
  return { edges, conflicts }
}

function bbProp({ outcome: o, game, history }: ModuleInput, sport: Bb): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  if (!o.player || !o.category || o.threshold === undefined) return { edges, conflicts }
  const over = o.direction !== 'under'
  const name = propName(o)
  const T = o.player.team
  const O = o.opponent ?? ''
  const home = o.homeAway === 'home' ? true : o.homeAway === 'away' ? false : null
  const push = (e: Edge) => edges.push(e)
  const merge = (r: { edges: Edge[]; conflicts: number }) => {
    edges.push(...r.edges)
    conflicts += r.conflicts
  }
  const scale = tierScale(game, sport, O)
  const scoring = ['Points', 'Rebounds', 'Assists'].includes(o.category)

  // ---- Tier 1: the second night of a back-to-back, the opponent's rest, and the game script the spread implies.
  if (game.rest[T] === 0) {
    const sp = backToBackSplit(o, history)
    if (sp && sp.b2b.avg < sp.other.avg && !over) push(ev({ tier: 1, text: `${name} is on the second night of a back-to-back tonight — averaging ${f1(sp.b2b.avg)} ${o.category} in ${plural(sp.b2b.n, 'back-to-back game')} this season vs ${f1(sp.other.avg)} on other nights`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.55, support: 'Game log split by rest', n: sp.b2b.n, smallSample: sp.b2b.n < 5 }))
    else if (over) conflicts++
  } else if (over && O && game.rest[O] === 0) {
    push(ev({ tier: 1, text: `${O} is on the second night of a back-to-back tonight (0 days of rest) vs ${plural(game.rest[T] ?? 1, 'day')} of rest for ${T} — a tired defense for ${name}'s ${o.category}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.5, support: 'Days since each team last played', n: 1, ageDays: 0 }))
  }
  const { margin, total } = scriptOf(game, T)
  const blowout = sport === 'nba' ? 12 : 15
  if (over && margin !== null && Math.abs(margin) >= blowout) conflicts++
  const fast = sport === 'nba' ? 230 : 150
  if (over && total !== null && total >= fast && scoring) push(ev({ tier: 1, text: `Tonight's game total is ${total} — a fast-paced matchup with extra possessions for ${name}'s ${o.category}`, category: 'role', horizon: 'tonight', layer: 'opportunity', relevance: Math.min(1, 0.5 + (total - fast) / 20), support: 'Posted game total', n: 1, ageDays: 0 }))

  // ---- Tier 2: the defense he faces, and his career record against this team.
  const rank = O ? game.defense[O]?.[o.category] : undefined
  if (rank) {
    const soft = rank.rank <= Math.ceil(rank.of / 4)
    const tough = rank.rank > rank.of - Math.ceil(rank.of / 4)
    if ((over && soft) || (!over && tough)) push(ev({ tier: 2, text: `${O} allows ${f1(rank.value)} ${rank.label.replace(' allowed per game', '')} per game (${soft ? ordinal(rank.rank) + '-most' : ordinal(rank.of - rank.rank + 1) + '-fewest'} of ${rank.of} teams) — the defense ${name} faces tonight`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: 0.55, support: `${rank.label} this season`, n: rank.of, smallSample: true, scale }))
    else if ((over && tough) || (!over && soft)) conflicts++
  }
  merge(vsOpponentCareer(o, history, 3))

  // ---- Tier 3-6: form at the number, venue and season, and last season while this one is young.
  merge(recentAtLine(o, history, 3, [5, 10, 15], sport === 'nba' && scoring ? { key: 'Minutes', label: 'minutes' } : undefined))
  merge(seasonAtLine(o, history, home))
  merge(priorSeasonAtLine(o, history, 10))
  return { edges, conflicts }
}

export function basketballEvidence(input: ModuleInput, sport: Bb): ModuleOutput {
  const o: BettingOutcome = input.outcome
  if (o.type === 'player_prop') return bbProp(input, sport)
  if (o.type === 'moneyline' || o.type === 'spread') return bbSide(input, sport)
  if (o.type === 'total') return bbTotal(input, sport)
  return { edges: [], conflicts: 0 }
}
