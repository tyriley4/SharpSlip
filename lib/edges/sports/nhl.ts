import { slugify } from '@/lib/players/slug'
import type { ModuleInput } from '../modules/shared'
import type { BettingOutcome, Edge, GameContext, ModuleOutput } from '../types'
import { ev, f1, lineText, ordinal, plural, recRelevance, recText } from './format'
import { backToBackSplit, propName, recentAtLine, seasonAtLine, vsOpponentCareer } from './props'
import { atVenue, avgAgainst, avgFor, covers, currentSeason, games as played, recentSeasons, totalSide, vsOpp, vsTier, wins, type Rec } from './records'

/**
 * NHL evidence. The league is always indoors, so no weather item exists here. The case rests on the goalie matchup (each
 * goalie's save percentage over his last five starts and whether he played last night), power play against penalty kill,
 * back-to-backs, puck-line records at tonight's number, and for skaters the power-play role and the form at the number.
 */

type Side = 'away' | 'home'
const sv = (n: number) => n.toFixed(3).replace(/^0/, '')

function goalieLine(g: NonNullable<NonNullable<GameContext['facts']['nhl']>['goalies']['away']>): string {
  const saves = g.last5.reduce((n, x) => n + x.sv, 0)
  const shots = g.last5.reduce((n, x) => n + x.sa, 0)
  const last = g.last5SvPct as number
  const season = Math.abs(last - g.seasonSavePct) < 0.003 ? ', matching his season mark' : ` against a ${sv(g.seasonSavePct)} season mark`
  return `${g.name} has stopped ${saves} of ${shots} shots (${sv(last)}) over his last ${g.last5.length} starts${season}`
}

function nhlSide({ outcome: o, game }: ModuleInput): ModuleOutput {
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
  const home = t.home
  const facts = game.facts.nhl
  const push = (e: Edge) => edges.push(e)
  const tally = (gs: ReturnType<typeof currentSeason>): Rec => (spread ? covers(gs, line) : wins(gs))
  const recWord = spread ? `record covering ${lineText(line)}` : 'record'

  // ---- Tier 1: goalies, rest, and the players who are out.
  const gO = facts?.goalies[theirs]
  const gT = facts?.goalies[mine]
  if (gO?.last5SvPct != null) {
    if (gO.last5SvPct <= 0.895) push(ev({ tier: 1, text: `${O}'s likely starter ${goalieLine(gO)}${gO.startedYesterday ? ' and played last night, so a backup may start' : ''} — a goalie ${T} can score on tonight`, category: 'matchup', horizon: 'last15', layer: 'opportunity', relevance: Math.min(1, 0.55 + (0.91 - gO.last5SvPct) * 6), support: gO.last5.map((r) => `${r.sv}/${r.sa} vs ${r.opp}`).join(' · '), n: gO.last5.length, ageDays: 3, metrics: { rate: gO.last5SvPct, n: gO.last5.length } }))
    else if (gO.last5SvPct >= 0.925) conflicts++
  } else if (gO?.startedYesterday) {
    push(ev({ tier: 1, text: `${O}'s likely starter ${gO.name} played last night, so a backup goalie may be in net against ${T} tonight`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.45, support: 'Goalie game log', n: 1, ageDays: 0 }))
  }
  if (gT?.last5SvPct != null && gT.last5SvPct >= 0.925) {
    push(ev({ tier: 1, text: `${T}'s likely starter ${goalieLine(gT)} — the goaltending behind ${T} tonight`, category: 'matchup', horizon: 'last15', layer: 'opportunity', relevance: Math.min(1, 0.5 + (gT.last5SvPct - 0.91) * 6), support: gT.last5.map((r) => `${r.sv}/${r.sa} vs ${r.opp}`).join(' · '), n: gT.last5.length, ageDays: 3, metrics: { rate: gT.last5SvPct, n: gT.last5.length } }))
  } else if (gT?.last5SvPct != null && gT.last5SvPct <= 0.895) conflicts++
  const r1 = game.rest[T]
  const r2 = game.rest[O]
  if (r1 !== null && r1 !== undefined && r2 !== null && r2 !== undefined) {
    if (r2 === 0 && r1 >= 1) push(ev({ tier: 1, text: `${O} is on the second night of a back-to-back tonight while ${T} has had ${plural(r1, 'day')} off`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.7, support: 'Days since each team last played', n: 1, ageDays: 0 }))
    else if (r1 === 0 && r2 >= 1) conflicts++
  }
  const outT = game.teammatesOut.filter((x) => x.team === O && x.usage && x.usage.value >= 16)
  const outMine = game.teammatesOut.filter((x) => x.team === T && x.usage && x.usage.value >= 16)
  if (outT.length > 0) push(ev({ tier: 1, text: `${O} is without ${outT.slice(0, 2).map((x) => `${x.player} (${x.position}, ${x.usage!.value} minutes of ice time per game)`).join(' and ')} tonight — a regular from the lineup missing against ${T}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: Math.min(1, 0.5 + outT.length * 0.1), support: 'Injury report with ice-time averages', n: outT.length, ageDays: 0 }))
  if (outMine.length > 0) conflicts++

  // ---- Tier 2: special teams, and this team's record against this opponent.
  const sMine = facts?.special[T]
  const sTheirs = facts?.special[O]
  if (sMine && sTheirs) {
    const edge = sMine.ppPct - (100 - sTheirs.pkPct)
    if (edge >= 3 || (sMine.ppRank <= sMine.of / 3 && sTheirs.pkRank > (sTheirs.of * 2) / 3)) {
      push(ev({ tier: 2, text: `${T}'s power play converts ${f1(sMine.ppPct)}% (${ordinal(sMine.ppRank)} of ${sMine.of}); ${O}'s penalty kill allows ${f1(100 - sTheirs.pkPct)}% (kills ${f1(sTheirs.pkPct)}%, ${ordinal(sTheirs.pkRank)} of ${sTheirs.of}) — a ${f1(Math.abs(edge))}-point ${edge >= 0 ? 'edge for ' + T + "'s power play" : 'gap'} tonight`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: Math.min(1, 0.5 + Math.max(0, edge) / 20), support: 'Team special teams this season', n: sMine.of }))
    } else if (edge <= -6) conflicts++
  }
  const cur = currentSeason(game, T)
  const vsThis = vsOpp(cur, O)
  const rv = tally(vsThis)
  if (played(rv) >= 2 && rv.w / played(rv) >= 0.6) {
    push(ev({ tier: 2, text: `${T}'s ${recWord} vs ${O} this season: ${recText(rv)} (${plural(vsThis.length, 'meeting')})`, category: 'h2h', horizon: 'season_vs_opp', relevance: recRelevance(rv.w, rv.l), support: `${vsThis.length} games`, n: vsThis.length, smallSample: vsThis.length < 3 }))
  } else if (played(rv) >= 3 && rv.w / played(rv) <= 0.34) conflicts++
  const prior = recentSeasons(game, T, 2).filter((g) => g.opp === O && !g.playoff)
  const pr = tally(prior)
  if (played(pr) >= 4 && pr.w / played(pr) >= 0.7) push(ev({ tier: 6, text: `${T}'s ${recWord} vs ${O} over the last two seasons: ${recText(pr)}`, category: 'h2h', horizon: 'career_vs_opp', relevance: recRelevance(pr.w, pr.l), support: 'Two most recent seasons', n: played(pr), seasonsAgo: 1 }))

  // ---- Tier 3: goals for and against over the last ten, each team separately.
  const a10 = (game.results[T] ?? []).slice(0, 10)
  const b10 = (game.results[O] ?? []).slice(0, 10)
  if (a10.length >= 5 && b10.length >= 5) {
    const aM = avgFor(a10) - avgAgainst(a10)
    const bM = avgFor(b10) - avgAgainst(b10)
    if (aM - bM >= 0.8) push(ev({ tier: 3, text: `Last ${a10.length} games: ${T} scoring ${f1(avgFor(a10))} and allowing ${f1(avgAgainst(a10))} per game (${recText(wins(a10))}); ${O} scoring ${f1(avgFor(b10))} and allowing ${f1(avgAgainst(b10))} (${recText(wins(b10))}) — ${T} is ${f1(aM - bM)} goals per game better heading into tonight`, category: 'recent_form', horizon: 'last15', relevance: Math.min(1, 0.45 + (aM - bM) / 3), support: 'Final scores, last ten games each', n: Math.min(a10.length, b10.length), ageDays: 3, metrics: { avg: aM, n: a10.length } }))
    else if (bM - aM >= 1.2) conflicts++
  }

  // ---- Tier 4: the record at tonight's number in tonight's situation.
  const venue = tally(atVenue(cur, home))
  if (played(venue) >= 4 && venue.w / played(venue) >= 0.6) push(ev({ tier: 4, text: `${T}'s ${recWord} ${home ? 'at home' : 'on the road'} this season: ${recText(venue)}`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(venue.w, venue.l), support: `${home ? 'Home' : 'Road'} games`, n: played(venue), smallSample: played(venue) < 8 }))
  const oppPct = game.leagueWinPct[O]
  if (oppPct !== undefined) {
    const strong = oppPct >= 0.5
    const r = tally(vsTier(cur, game, strong))
    if (played(r) >= 3 && r.w / played(r) >= 0.62) push(ev({ tier: 4, text: `${T}'s ${recWord} vs teams ${strong ? 'at or above' : 'under'} .500 this season: ${recText(r)} — ${O} is at ${oppPct.toFixed(3).replace(/^0/, '')}`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(r.w, r.l), support: 'Opponent quality from the standings', n: played(r), smallSample: played(r) < 8 }))
  }
  if (spread) {
    const mirror = covers(atVenue(currentSeason(game, O), !home), -line)
    if (played(mirror) >= 4 && mirror.w / played(mirror) <= 0.38) push(ev({ tier: 4, text: `${O}'s record covering ${lineText(-line)} ${!home ? 'at home' : 'on the road'} this season: ${recText(mirror)} — the number ${O} has to cover tonight`, category: 'hit_rate', horizon: 'season', relevance: Math.min(1, 0.45 + (0.5 - mirror.w / played(mirror))), support: `${O}'s ${!home ? 'home' : 'road'} games`, n: played(mirror), smallSample: played(mirror) < 8 }))
  }
  return { edges, conflicts }
}

function nhlTotal({ outcome: o, game }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  if (o.threshold === undefined) return { edges, conflicts }
  const total = o.threshold
  const over = o.direction !== 'under'
  const word = over ? 'Over' : 'Under'
  const A = game.away
  const H = game.home
  const facts = game.facts.nhl
  const push = (e: Edge) => edges.push(e)

  // ---- Tier 1: both goalies, back-to-backs, players who are out.
  const ga = facts?.goalies.away
  const gh = facts?.goalies.home
  if (ga?.last5SvPct != null && gh?.last5SvPct != null) {
    const bothWeak = ga.last5SvPct <= 0.9 && gh.last5SvPct <= 0.9
    const bothSharp = ga.last5SvPct >= 0.92 && gh.last5SvPct >= 0.92
    if ((over && bothWeak) || (!over && bothSharp)) {
      push(ev({ tier: 1, text: `${A}'s ${ga.name}: ${sv(ga.last5SvPct)} over his last ${ga.last5.length} starts; ${H}'s ${gh.name}: ${sv(gh.last5SvPct)} over his last ${gh.last5.length} — ${over ? 'neither goalie has been stopping the puck' : 'both goalies have been sharp'} going into tonight's ${total}`, category: 'recent_form', horizon: 'last15', layer: 'statistical', relevance: 0.62, support: `${ga.name}: ${ga.last5.map((r) => `${r.sv}/${r.sa}`).join(', ')} · ${gh.name}: ${gh.last5.map((r) => `${r.sv}/${r.sa}`).join(', ')}`, n: Math.min(ga.last5.length, gh.last5.length), ageDays: 3 }))
    } else if ((over && bothSharp) || (!over && bothWeak)) conflicts++
  }
  const b2b = ([A, H] as const).filter((x) => game.rest[x] === 0)
  if (over && b2b.length > 0) push(ev({ tier: 1, text: `${b2b.join(' and ')} ${b2b.length > 1 ? 'are' : 'is'} on the second night of a back-to-back tonight — tired legs and backup goaltending raise scoring against the ${total}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.55, support: 'Days since each team last played', n: b2b.length, ageDays: 0 }))
  const stars = game.teammatesOut.filter((x) => x.usage && x.usage.value >= 16 && x.position.toUpperCase() !== 'G')
  if (!over && stars.length > 0) push(ev({ tier: 1, text: `${stars.slice(0, 2).map((x) => `${x.team} is without ${x.player} (${x.position}, ${x.usage!.value} minutes per game)`).join('; ')} — a regular out of the lineup trims scoring against the ${total}`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.5, support: 'Injury report with ice-time averages', n: stars.length, ageDays: 0 }))
  else if (over && stars.length > 0) conflicts++

  // ---- Tier 2: special teams, each side.
  const sa = facts?.special[A]
  const sh = facts?.special[H]
  if (sa && sh) {
    const aEdge = sa.ppPct - (100 - sh.pkPct)
    const hEdge = sh.ppPct - (100 - sa.pkPct)
    if (over && aEdge >= 2 && hEdge >= 2) push(ev({ tier: 2, text: `${A}'s power play converts ${f1(sa.ppPct)}% against ${H}'s ${f1(sh.pkPct)}% penalty kill; ${H}'s power play converts ${f1(sh.ppPct)}% against ${A}'s ${f1(sa.pkPct)}% kill — both power plays have the edge tonight`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: 0.55, support: 'Team special teams this season', n: sa.of }))
    else if (!over && aEdge <= -4 && hEdge <= -4) push(ev({ tier: 2, text: `${A}'s power play converts ${f1(sa.ppPct)}% against ${H}'s ${f1(sh.pkPct)}% penalty kill; ${H}'s converts ${f1(sh.ppPct)}% against ${A}'s ${f1(sa.pkPct)}% — both penalty kills have the edge tonight`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: 0.5, support: 'Team special teams this season', n: sa.of }))
  }

  // ---- Tier 3: recent scoring, each team separately, then the combined summary.
  const a10 = (game.results[A] ?? []).slice(0, 10)
  const h10 = (game.results[H] ?? []).slice(0, 10)
  if (a10.length >= 5 && h10.length >= 5) {
    const combined = avgFor(a10) + avgFor(h10)
    const gap = combined - total
    if ((over && gap >= 0.4) || (!over && gap <= -0.4)) push(ev({ tier: 3, text: `${A}: scoring ${f1(avgFor(a10))} goals per game and allowing ${f1(avgAgainst(a10))} over the last ${a10.length}; ${H}: scoring ${f1(avgFor(h10))} and allowing ${f1(avgAgainst(h10))} over the last ${h10.length} — combined ${f1(combined)} against tonight's ${total} line`, category: 'recent_form', horizon: 'last15', relevance: Math.min(1, 0.45 + Math.abs(gap) / 2), support: 'Final scores, last ten games each', n: Math.min(a10.length, h10.length), ageDays: 3 }))
    else if ((over && gap <= -0.4) || (!over && gap >= 0.4)) conflicts++
    const ra = totalSide(a10, total, over)
    const rh = totalSide(h10, total, over)
    if ((ra.w + rh.w) / Math.max(1, played(ra) + played(rh)) >= 0.62) push(ev({ tier: 3, text: `${A}: ${word} ${total} in ${ra.w} of the last ${played(ra) + ra.p} games; ${H}: ${word} ${total} in ${rh.w} of the last ${played(rh) + rh.p}`, category: 'recent_form', horizon: 'last15', relevance: recRelevance(ra.w + rh.w, played(ra) + played(rh) - ra.w - rh.w), support: 'Final scores against tonight\'s number', n: Math.min(played(ra), played(rh)), ageDays: 3, metrics: { rate: (ra.w + rh.w) / (played(ra) + played(rh)), n: played(ra) } }))
  }
  // ---- Tier 4: season records at the number, then the venues.
  const cA = currentSeason(game, A)
  const cH = currentSeason(game, H)
  const sA = totalSide(cA, total, over)
  const sH = totalSide(cH, total, over)
  if (cA.length >= 4 && cH.length >= 4 && (sA.w + sH.w) / Math.max(1, played(sA) + played(sH)) >= 0.6) push(ev({ tier: 4, text: `${A}: ${word} ${total} in ${sA.w} of ${cA.length} games this season; ${H}: ${word} ${total} in ${sH.w} of ${cH.length}`, category: 'hit_rate', horizon: 'season', relevance: recRelevance(sA.w + sH.w, played(sA) + played(sH) - sA.w - sH.w), support: 'Final scores this season', n: Math.min(cA.length, cH.length), smallSample: Math.min(cA.length, cH.length) < 10 }))
  const vA = totalSide(atVenue(cA, false), total, over)
  const vH = totalSide(atVenue(cH, true), total, over)
  if (played(vA) >= 3 && played(vH) >= 3 && (vA.w + vH.w) / (played(vA) + played(vH)) >= 0.65) push(ev({ tier: 4, text: `${A} on the road: ${word} ${total} in ${vA.w} of ${played(vA) + vA.p} games; ${H} at home: ${word} ${total} in ${vH.w} of ${played(vH) + vH.p} — the venues for tonight's game`, category: 'hit_rate', horizon: 'season', relevance: 0.55, support: 'Road games for the visitor, home games for the host', n: Math.min(played(vA), played(vH)), smallSample: true }))
  return { edges, conflicts }
}

function nhlProp({ outcome: o, game, history }: ModuleInput): ModuleOutput {
  const edges: Edge[] = []
  let conflicts = 0
  if (!o.player || !o.category || o.threshold === undefined || (o.player.position ?? '') === 'G') return { edges, conflicts }
  const over = o.direction !== 'under'
  const name = propName(o)
  const T = o.player.team
  const O = o.opponent ?? ''
  const home = o.homeAway === 'home' ? true : o.homeAway === 'away' ? false : null
  const facts = game.facts.nhl
  const oppSide: Side = O === game.home ? 'home' : 'away'
  const push = (e: Edge) => edges.push(e)
  const merge = (r: { edges: Edge[]; conflicts: number }) => {
    edges.push(...r.edges)
    conflicts += r.conflicts
  }
  const points = o.category === 'Points' || o.category === 'Assists'

  // ---- Tier 1: the goalie he shoots at, then the second night of a back-to-back, then his power-play role.
  const g = facts?.goalies[oppSide]
  if (g?.last5SvPct != null) {
    const weak = g.last5SvPct <= 0.895
    const strong = g.last5SvPct >= 0.925
    if ((over && weak) || (!over && strong)) push(ev({ tier: 1, text: `${O}'s likely starter ${goalieLine(g)}${g.startedYesterday ? ' and played last night, so a backup may start' : ''} — the goalie ${name} faces tonight`, category: 'matchup', horizon: 'last15', layer: 'opportunity', relevance: Math.min(1, 0.5 + Math.abs(g.last5SvPct - 0.91) * 8), support: g.last5.map((r) => `${r.sv}/${r.sa} vs ${r.opp}`).join(' · '), n: g.last5.length, ageDays: 3, metrics: { rate: g.last5SvPct, n: g.last5.length } }))
    else if ((over && strong) || (!over && weak)) conflicts++
  } else if (g?.startedYesterday && over) {
    push(ev({ tier: 1, text: `${O}'s likely starter ${g.name} played last night, so a backup goalie may face ${name} tonight`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.45, support: 'Goalie game log', n: 1, ageDays: 0 }))
  }
  if (game.rest[T] === 0) {
    const sp = backToBackSplit(o, history)
    if (sp) {
      const lower = sp.b2b.avg < sp.other.avg
      if (!over && lower) push(ev({ tier: 1, text: `${name} is on the second night of a back-to-back tonight — averaging ${f1(sp.b2b.avg)} ${o.category} in ${plural(sp.b2b.n, 'back-to-back game')} this season vs ${f1(sp.other.avg)} on other nights`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.55, support: 'Game log split by rest', n: sp.b2b.n, smallSample: sp.b2b.n < 5 }))
      else if (over && lower) conflicts++
      else if (over && !lower) push(ev({ tier: 1, text: `${name} is on the second night of a back-to-back tonight — yet averages ${f1(sp.b2b.avg)} ${o.category} in ${plural(sp.b2b.n, 'back-to-back game')} this season vs ${f1(sp.other.avg)} on other nights`, category: 'situational', horizon: 'tonight', layer: 'situational', relevance: 0.5, support: 'Game log split by rest', n: sp.b2b.n, smallSample: sp.b2b.n < 5 }))
    } else if (over) conflicts++
  }
  const role = facts?.ppRoles[`${slugify(o.player.name)}|${T}`]
  if (over && role && role.gp >= 4 && points && role.ppToiSec >= 90) {
    const m = Math.floor(role.ppToiSec / 60)
    const sec = String(Math.round(role.ppToiSec % 60)).padStart(2, '0')
    push(ev({ tier: 1, text: `${name} averages ${m}:${sec} of power-play time per game (${Math.round(role.ppShare * 100)}% of ${T}'s power-play minutes) with ${plural(role.ppPoints, 'power-play point')} in ${role.gp} games — ${O}'s penalty kill${facts?.special[O] ? ` ranks ${ordinal(facts.special[O].pkRank)} of ${facts.special[O].of} at ${f1(facts.special[O].pkPct)}%` : ''} tonight`, category: 'role', horizon: 'season', layer: 'opportunity', relevance: Math.min(1, 0.5 + (role.ppToiSec - 90) / 150), support: 'NHL stats service, power play', n: role.gp, smallSample: role.gp < 8 }))
  } else if (over && role && role.gp >= 4 && points && role.ppToiSec <= 20) conflicts++
  if (over && points) {
    const mineS = facts?.special[T]
    const theirS = facts?.special[O]
    if (mineS && theirS && mineS.ppRank <= mineS.of / 3 && theirS.pkRank > (theirS.of * 2) / 3) {
      push(ev({ tier: 2, text: `${T}'s power play converts ${f1(mineS.ppPct)}% (${ordinal(mineS.ppRank)} of ${mineS.of}) against ${O}'s penalty kill at ${f1(theirS.pkPct)}% (${ordinal(theirS.pkRank)} of ${theirS.of}) — the special-teams matchup for ${name}'s ${o.category} tonight`, category: 'matchup', horizon: 'tonight', layer: 'opportunity', relevance: 0.6, support: 'Team special teams this season', n: mineS.of }))
    }
  }
  // ---- Tier 2-5: career against tonight's team, form at the number, venue and season.
  merge(vsOpponentCareer(o, history, 3))
  merge(recentAtLine(o, history, 3, [5, 10, 15]))
  merge(seasonAtLine(o, history, home))
  return { edges, conflicts }
}

export function nhlEvidence(input: ModuleInput): ModuleOutput {
  const o: BettingOutcome = input.outcome
  if (o.type === 'player_prop') return nhlProp(input)
  if (o.type === 'moneyline' || o.type === 'spread') return nhlSide(input)
  if (o.type === 'total') return nhlTotal(input)
  return { edges: [], conflicts: 0 }
}
