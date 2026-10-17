import { getNFLSchedule } from '@/lib/nfl/api'
import { normalizeNflAbbr } from '@/lib/nfl/divisions'
import { slugify } from '@/lib/players/slug'
import type { NflGameFacts, NflPlayerFacts } from './data/nfl'
import type { GameContext, GameFoundation, RosterNote, TeamFoundation, TeamGameRecord, WeatherImpact } from './types'
import { nflRoofedHome } from './venues'
import { f1, mean, ordinal, plural, recText } from './sports/format'
import { atVenue, currentSeason, games as played, recentSeasons, wins } from './sports/records'

/**
 * The game foundation: one picture of the game, built once and read by every bet in it. It answers the questions a sharp
 * bettor asks before looking at any single line: what kind of team is each side and does one attack the other's weakness;
 * how good is each side's recent record once the quality of the opposition is accounted for; how does each team do at
 * this venue and in this climate; what do tonight's conditions do to which positions; and who is missing or returning
 * and what that changes. Everything is computed from data already loaded for the game; where a measure is not published
 * (defensive scheme, MLB opponent injuries at the time of past games) it is left out rather than guessed.
 */

type Facts = NflGameFacts

const other = (game: GameContext, team: string) => (team === game.away ? game.home : game.away)

// ---------------------------------------------------------------------------
// Team identity and the style matchup (football)
// ---------------------------------------------------------------------------

function offenseStyle(facts: Facts | null | undefined, team: string): { text: string; label: TeamFoundation['offenseLabel'] } | null {
  const st = facts?.teamStyle[team]
  if (!st || st.plays < 100) return null
  const third = Math.max(1, Math.round(st.of / 3))
  const label = st.rank <= third ? 'pass-heavy' : st.rank > st.of - third ? 'run-heavy' : 'balanced'
  return { label, text: `${team} is a ${label} offense (${Math.round(st.passPct * 100)}% pass rate, ${ordinal(st.rank)} most pass-heavy of ${st.of})` }
}

function defenseStyle(facts: Facts | null | undefined, team: string): { text: string; label: TeamFoundation['defenseLabel']; passRank: number; rushRank: number; of: number } | null {
  const v = facts?.vsPosition[team]
  if (!v || v.rank.QB.passYds === 0 || v.rank.RB.rushYds === 0) return null
  const of = v.of
  const third = Math.max(1, Math.round(of / 3))
  const pr = v.rank.QB.passYds
  const rr = v.rank.RB.rushYds
  const soft = (r: number) => r <= third
  const tough = (r: number) => r > of - third
  const label: TeamFoundation['defenseLabel'] = soft(pr) && tough(rr) ? 'pass-funnel' : soft(rr) && tough(pr) ? 'run-funnel' : soft(pr) && soft(rr) ? 'soft' : tough(pr) && tough(rr) ? 'stingy' : 'balanced'
  const phrase = { 'pass-funnel': 'the weakness is through the air, not on the ground', 'run-funnel': 'the weakness is on the ground, not through the air', soft: 'soft against both the pass and the run', stingy: 'tough against both the pass and the run', balanced: 'no single glaring weakness' }[label]
  return { label, passRank: pr, rushRank: rr, of, text: `${team}'s defense allows ${f1(v.allowed.QB.passYdsPg)} passing yards per game to quarterbacks (${ordinal(pr)}-most of ${of}) and ${f1(v.allowed.RB.rushYdsPg)} rushing yards per game to running backs (${ordinal(rr)}-most) — ${phrase} (from yards allowed; coverage scheme data is not published)` }
}

function styleMatchup(facts: Facts | null | undefined, attacker: string, defender: string): string | null {
  const off = offenseStyle(facts, attacker)
  const def = defenseStyle(facts, defender)
  const v = facts?.vsPosition[defender]
  if (!off || !def || !v || !facts?.teamStyle[attacker]) return null
  const st = facts.teamStyle[attacker]
  const lead = `${attacker} is a ${off.label} offense (${Math.round(st.passPct * 100)}% pass rate, ${ordinal(st.rank)} of ${st.of})`
  if (off.label === 'pass-heavy' && def.passRank <= Math.round(def.of / 3)) return `${lead} facing ${defender}'s defense that allows the ${ordinal(def.passRank)}-most passing yards to quarterbacks (${f1(v.allowed.QB.passYdsPg)} per game) — the style matchup points at ${attacker}'s passing game`
  if (off.label === 'run-heavy' && def.rushRank <= Math.round(def.of / 3)) return `${lead} facing ${defender}'s defense that allows the ${ordinal(def.rushRank)}-most rushing yards to running backs (${f1(v.allowed.RB.rushYdsPg)} per game) — the style matchup points at ${attacker}'s run game`
  if (off.label === 'pass-heavy' && def.passRank > def.of - Math.round(def.of / 3)) return `${lead} facing ${defender}'s defense that allows the ${ordinal(def.of - def.passRank + 1)}-fewest passing yards to quarterbacks (${f1(v.allowed.QB.passYdsPg)} per game) — ${attacker}'s identity runs into ${defender}'s strength`
  if (off.label === 'run-heavy' && def.rushRank > def.of - Math.round(def.of / 3)) return `${lead} facing ${defender}'s defense that allows the ${ordinal(def.of - def.rushRank + 1)}-fewest rushing yards to running backs (${f1(v.allowed.RB.rushYdsPg)} per game) — ${attacker}'s identity runs into ${defender}'s strength`
  return null
}

// ---------------------------------------------------------------------------
// Recent form against opponent quality
// ---------------------------------------------------------------------------

function formRead(game: GameContext, team: string): TeamFoundation['form'] {
  const cur = currentSeason(game, team)
  const n = game.sport === 'mlb' ? 10 : 5
  const last = cur.slice(0, n)
  if (last.length < 3) return null
  const facts = game.facts.nfl
  // Football only: align this team's games (oldest first) with the weeks it played, to see whether the opposing quarterback started.
  const weeks = facts?.teamWeeks[team]?.map((w) => w.week)
  const asc = [...cur].reverse()
  const aligned = !!weeks && weeks.length === asc.length
  const weekOf = (g: TeamGameRecord) => (aligned ? weeks![asc.indexOf(g)] : null)
  const flagged: string[] = []
  const compromised = new Set<TeamGameRecord>()
  for (const g of last) {
    const wk = weekOf(g)
    if (wk === null || !facts) continue
    const st = facts.qbStarters[g.opp]?.[wk]
    if (st && !st.mainPlayed) {
      compromised.add(g)
      flagged.push(`the ${g.us > g.them ? 'win' : 'loss'} over ${g.opp} in week ${wk} came against a team whose starting quarterback ${facts.qbMain[g.opp]} did not play (${st.name} started)`)
    }
  }
  const raw = wins(last)
  const full = last.filter((g) => !compromised.has(g))
  const adj = compromised.size > 0 ? wins(full) : null
  const strong = last.filter((g) => (game.leagueWinPct[g.opp] ?? -1) >= 0.5)
  const weak = last.filter((g) => game.leagueWinPct[g.opp] !== undefined && (game.leagueWinPct[g.opp] as number) < 0.5)
  const tiers = strong.length + weak.length >= 3 ? ` (${recText(wins(strong))} against teams at or above .500, ${recText(wins(weak))} against teams under)` : ''
  const text = adj
    ? `${team} is ${recText(raw)} over its last ${last.length}, but ${flagged.join('; and ')} — against full-strength opponents the record is ${recText(adj)}`
    : `${team} is ${recText(raw)} over its last ${last.length}${tiers}`
  return { text, raw: { w: raw.w, l: raw.l }, adjusted: adj ? { w: adj.w, l: adj.l } : null, flagged }
}

// ---------------------------------------------------------------------------
// Venue and climate
// ---------------------------------------------------------------------------

async function climateRead(game: GameContext, team: string): Promise<{ text: string; rec: { w: number; l: number } } | null> {
  const w = game.weather
  if (game.sport !== 'nfl' || !w || w.indoor || w.tempF === null || w.tempF > 50) return null
  try {
    const top = Math.max(...(game.results[team] ?? []).map((g) => g.season), 0)
    const lists = await Promise.all([top, top - 1].map((s) => getNFLSchedule(s).catch(() => null)))
    let coldW = 0
    let coldL = 0
    let domeW = 0
    let domeL = 0
    for (const rows of lists)
      for (const r of rows ?? []) {
        const home = normalizeNflAbbr(r.home_team)
        const away = normalizeNflAbbr(r.away_team)
        if ((home !== team && away !== team) || r.home_score === '' || r.away_score === '' || r.home_score === undefined) continue
        const us = Number(home === team ? r.home_score : r.away_score)
        const them = Number(home === team ? r.away_score : r.home_score)
        const roof = (r.roof ?? '').toLowerCase()
        const temp = Number(r.temp)
        if ((roof === 'outdoors' || roof === 'open') && r.temp !== '' && Number.isFinite(temp) && temp <= 45) us > them ? coldW++ : coldL++
        else if (roof === 'dome' || roof === 'closed') us > them ? domeW++ : domeL++
      }
    if (coldW + coldL < 2) return null
    const roofed = nflRoofedHome(team)
    return { rec: { w: coldW, l: coldL }, text: `${roofed ? `${team} plays its home games under a roof and is outdoors at ${Math.round(w.tempF)}°F tonight — ` : ''}${team} is ${coldW}-${coldL} in outdoor games at 45°F or colder over the last 2 seasons${domeW + domeL >= 2 ? ` against ${domeW}-${domeL} in dome games` : ''}` }
  } catch {
    return null
  }
}

function venueHistory(game: GameContext, team: string): { current: string | null; history: string | null; historyRec: { w: number; l: number } | null } {
  const homeTonight = team === game.home
  const cur = atVenue(currentSeason(game, team), homeTonight)
  const current = played(wins(cur)) >= 3 ? `${team} is ${recText(wins(cur))} ${homeTonight ? 'at home' : 'on the road'} this season` : null
  const three = recentSeasons(game, team, 2)
  const here = homeTonight ? atVenue(three, true) : three.filter((g) => !g.home && g.opp === game.home)
  const r = wins(here)
  const away = homeTonight ? wins(three.filter((g) => !g.home)) : null
  const history = played(r) >= (homeTonight ? 6 : 2) ? `${team} is ${recText(r)} ${homeTonight ? 'at home' : `at ${game.home}`} over the last ${plural(new Set(here.map((g) => g.season)).size, 'season')}${away && played(away) >= 4 ? ` vs ${recText(away)} on the road over the same stretch` : ''}` : null
  return { current, history, historyRec: played(r) >= (homeTonight ? 6 : 2) ? { w: r.w, l: r.l } : null }
}

// ---------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------

function weatherImpact(game: GameContext): WeatherImpact | null {
  const w = game.weather
  if (!w || w.indoor) return null
  const facts = game.facts.nfl
  if (game.sport === 'nfl' || game.sport === 'cfb') {
    const windy = (w.windMph ?? 0) >= 15
    const cold = w.tempF !== null && w.tempF <= 35
    const wet = w.precipitation
    if (!windy && !cold && !wet) return null
    const parts: string[] = []
    if (windy) parts.push(`${Math.round(w.windMph as number)} mph wind suppresses deep passing routes, which costs vertical route runners the most and short-route slot receivers the least`)
    if (cold) parts.push(`${Math.round(w.tempF as number)}°F affects ball handling and catching, which hurts pass-heavy offenses more than run-heavy ones`)
    if (wet) parts.push("rain or snow in the forecast affects receivers' catching and favors defenses and run games")
    const a = facts?.teamStyle[game.away]
    const h = facts?.teamStyle[game.home]
    let favors: string | null = null
    let tail = ''
    if (a && h && Math.abs(a.passPct - h.passPct) >= 0.03) {
      favors = a.passPct < h.passPct ? game.away : game.home
      const exposed = favors === game.away ? game.home : game.away
      const e = facts!.teamStyle[exposed]
      const f = facts!.teamStyle[favors]
      tail = ` — ${exposed} (${Math.round(e.passPct * 100)}% pass rate) is more exposed than ${favors} (${Math.round(f.passPct * 100)}%)`
    }
    return { text: `At ${game.home}'s stadium tonight: ${parts.join('; ')}${tail}`, windy, cold, wet, deepSuppressed: windy || wet, carry: null, favors }
  }
  if (game.sport === 'mlb') {
    const wind = w.windMph ?? 0
    const dir = w.windDirection ?? ''
    const out = wind >= 10 && /\bout\b/i.test(dir)
    const inward = wind >= 10 && /\bin\b/i.test(dir)
    const hot = (w.tempF ?? 0) >= 85
    const cold = w.tempF !== null && w.tempF <= 50
    if (!out && !inward && !hot && !cold && !w.precipitation) return null
    const bits: string[] = []
    if (out) bits.push(`wind ${Math.round(wind)} mph ${dir.toLowerCase()} helps fly balls carry, which supports home runs and the over`)
    if (inward) bits.push(`wind ${Math.round(wind)} mph ${dir.toLowerCase()} knocks down fly balls, which supports pitchers and the under`)
    if (hot) bits.push(`${Math.round(w.tempF as number)}°F heat helps the ball carry`)
    if (cold) bits.push(`${Math.round(w.tempF as number)}°F cold keeps the ball in the park`)
    if (w.precipitation) bits.push('rain in the forecast favors pitchers')
    return { text: `At ${game.home}'s park tonight: ${bits.join('; ')}`, windy: wind >= 10, cold, wet: w.precipitation, deepSuppressed: false, carry: out || hot ? 'out' : inward || cold ? 'in' : null, favors: null }
  }
  return null
}

// ---------------------------------------------------------------------------
// Roster context
// ---------------------------------------------------------------------------

const avgBy = (p: NflPlayerFacts | undefined, f: (g: NflPlayerFacts['games'][number]) => number, only?: (g: NflPlayerFacts['games'][number]) => boolean) => {
  const gs = (p?.games ?? []).filter((g) => (only ? only(g) : true))
  return gs.length ? mean(gs.map(f)) : 0
}

function nflRoster(game: GameContext): RosterNote[] {
  const facts = game.facts.nfl
  if (!facts) return []
  const notes: RosterNote[] = []
  for (const team of [game.away, game.home]) {
    const depth = facts.depth[team]
    const mine = Object.values(facts.players).filter((p) => p.team === team)
    const style = facts.teamStyle[team]
    const outNames = new Set((depth?.outStarters ?? []).map((x) => slugify(x.name)))
    const secondary: { x: { name: string; pos: string; status: string }; impact: 'high' | 'medium' }[] = []
    for (const x of depth?.outStarters ?? []) {
      const p = mine.find((q) => slugify(q.name) === slugify(x.name))
      const impact: 'high' | 'medium' = x.weight >= 0.9 ? 'high' : 'medium'
      if (x.weight < 0.6) continue
      if (x.pos === 'QB') {
        const backup = mine.filter((q) => q.position === 'QB' && slugify(q.name) !== slugify(x.name) && q.games.some((g) => g.att > 0)).sort((a, b) => avgBy(b, (g) => g.att) - avgBy(a, (g) => g.att))[0]
        const ypg = avgBy(p, (g) => g.passYds, (g) => g.att > 0)
        notes.push({ team, player: x.name, position: 'QB', kind: 'out', impact, affects: ['QB', 'WR', 'TE', 'RB', 'team'], text: `${x.name} (${team}'s starting QB${ypg > 0 ? `, averaging ${f1(ypg)} passing yards per game` : ''}) is ${x.status} tonight — ${backup ? `${backup.name} (${f1(avgBy(backup, (g) => g.passYds, (g) => g.att > 0))} passing yards per game when he has played)` : 'a backup'} runs the offense${style ? `, and ${team} passes on ${Math.round(style.passPct * 100)}% of plays` : ''}, so every pass catcher's volume depends on the replacement` })
      } else if (x.pos === 'RB') {
        const c = avgBy(p, (g) => g.carries)
        const next = mine.filter((q) => (q.position === 'RB' || q.position === 'HB' || q.position === 'FB') && slugify(q.name) !== slugify(x.name)).sort((a, b) => avgBy(b, (g) => g.carries) - avgBy(a, (g) => g.carries))[0]
        notes.push({ team, player: x.name, position: 'RB', kind: 'out', impact, affects: ['RB', 'team'], text: `${x.name} (RB${c > 0 ? `, averaging ${f1(c)} carries per game` : ''}) is ${x.status} tonight — his carries shift to ${next ? `${next.name} (currently ${f1(avgBy(next, (g) => g.carries))} per game)` : 'the backups'}, which raises that back's rushing ceiling and lowers ${team}'s lead-back volume` })
      } else if (x.pos === 'WR1' || x.pos === 'WR2' || x.pos === 'WR' || x.pos === 'TE') {
        const t = avgBy(p, (g) => g.targets)
        const next = mine.filter((q) => ['WR', 'TE'].includes(q.position) && slugify(q.name) !== slugify(x.name) && !outNames.has(slugify(q.name))).sort((a, b) => avgBy(b, (g) => g.targets) - avgBy(a, (g) => g.targets))[0]
        notes.push({ team, player: x.name, position: x.pos, kind: 'out', impact, affects: ['WR', 'TE', 'team'], text: `${x.name} (${x.pos}${t > 0 ? `, averaging ${f1(t)} targets per game` : ''}) is ${x.status} tonight — those targets redistribute, with ${next ? `${next.name} (${f1(avgBy(next, (g) => g.targets))} targets per game now)` : 'the remaining receivers'} first in line` })
      } else if (x.pos === 'CB' || x.pos === 'S') {
        secondary.push({ x, impact })
      } else if (x.pos === 'LT') {
        notes.push({ team, player: x.name, position: 'LT', kind: 'out', impact, affects: ['QB', 'RB', 'team'], text: `${x.name} (LT) is ${x.status} tonight — ${team}'s pass protection loses its left tackle${style ? ` while the offense passes on ${Math.round(style.passPct * 100)}% of plays (${ordinal(style.rank)} most pass-heavy of ${style.of})` : ''}, which pressures the quarterback and the passing volume behind his props` })
      } else {
        notes.push({ team, player: x.name, position: x.pos, kind: 'out', impact, affects: ['RB', 'team'], text: `${x.name} (${x.pos}) is ${x.status} tonight — ${team}'s front seven loses a starter, which opens running lanes for the opposing backs` })
      }
    }
    if (secondary.length > 0) {
      const v = facts.vsPosition[team]
      const names = secondary.map((s2) => `${s2.x.name} (${s2.x.pos})`)
      notes.push({ team, player: secondary[0].x.name, position: secondary[0].x.pos, kind: 'out', impact: secondary.some((s2) => s2.impact === 'high') || secondary.length > 1 ? 'high' : 'medium', affects: ['WR', 'TE', 'QB', 'team'], text: `${names.join(' and ')} ${secondary.length > 1 ? 'are' : 'is'} ${secondary[0].x.status} tonight — ${team}'s secondary, which already allows ${v ? `${f1(v.allowed.WR.recYdsPg)} receiving yards per game to wide receivers (${ordinal(v.rank.WR.recYds)}-most of ${v.of})` : 'yards through the air'}, plays without ${secondary.length > 1 ? 'them' : 'him'}, so the opposing receivers face backups in coverage` })
    }
    // Returning: a regular who missed the team's latest games and is not listed out tonight.
    const weeks = (facts.teamWeeks[team] ?? []).map((w) => w.week)
    if (weeks.length >= 3) {
      for (const p of mine) {
        const pos = p.position === 'HB' || p.position === 'FB' ? 'RB' : p.position
        if (!['RB', 'WR', 'TE'].includes(pos) || outNames.has(slugify(p.name))) continue
        const mark = pos === 'RB' ? (g: NflPlayerFacts['games'][number]) => g.carries : (g: NflPlayerFacts['games'][number]) => g.targets
        const played = p.games.filter((g) => mark(g) > 0).map((g) => g.week)
        if (played.length < 2) continue
        const missed = weeks.filter((w) => w > Math.max(...played))
        const avg = avgBy(p, mark, (g) => mark(g) > 0)
        if (missed.length < 2 || avg < (pos === 'RB' ? 8 : 4) || !depth?.slots[slugify(p.name)]) continue
        const label = pos === 'RB' ? 'carries' : 'targets'
        const withHim = mine.filter((q) => q !== p && (pos === 'RB' ? ['RB', 'HB', 'FB'] : ['WR', 'TE']).includes(q.position))
        const best = withHim.sort((a, b) => avgBy(b, mark, (g) => missed.includes(g.week)) - avgBy(a, mark, (g) => missed.includes(g.week)))[0]
        const shareWith = (weeksSet: number[]) => {
          const tot = withHim.reduce((n, q) => n + q.games.filter((g) => weeksSet.includes(g.week)).reduce((m, g) => m + mark(g), 0), 0) + p.games.filter((g) => weeksSet.includes(g.week)).reduce((m, g) => m + mark(g), 0)
          const mine2 = best ? best.games.filter((g) => weeksSet.includes(g.week)).reduce((m, g) => m + mark(g), 0) : 0
          return tot > 0 ? Math.round((mine2 / tot) * 100) : null
        }
        const withWeeks = played
        const a = shareWith(withWeeks)
        const b = shareWith(missed)
        notes.push({ team, player: p.name, position: pos, kind: 'returning', impact: 'medium', affects: [pos, 'team'], text: `${p.name} is back tonight after missing ${plural(missed.length, 'game')} (${f1(avg)} ${label} per game when healthy)${best && a !== null && b !== null ? ` — ${best.name}'s share of ${team}'s ${pos === 'RB' ? 'backfield carries' : 'targets among receivers'} was ${b}% without him and ${a}% with him, so the return trims ${best.name}'s volume and lifts ${p.name}'s` : ` — his ${label} come back at the expense of the players who filled in`}` })
      }
    }
  }
  return notes
}

function otherRoster(game: GameContext): RosterNote[] {
  const notes: RosterNote[] = []
  if (game.sport === 'mlb') {
    for (const side of ['away', 'home'] as const) {
      const team = side === 'away' ? game.away : game.home
      for (const b of game.facts.mlb?.keyBatsOut[side] ?? []) {
        notes.push({ team, player: b.name, position: b.position, kind: 'out', impact: 'high', affects: ['team'], text: `${b.name} (${b.position}, wRC+ ${b.wrcPlus} over ${b.pa} PA, ${b.wrcPlus - 100}% better than league average) is ${b.designation === 'ir' ? 'on the injured list' : b.designation} tonight — ${team} loses one of its most productive bats from the lineup tonight` })
      }
    }
  } else if (game.sport === 'nba' || game.sport === 'nhl' || game.sport === 'cbb') {
    const min = game.sport === 'nba' ? 25 : game.sport === 'nhl' ? 16 : 10
    for (const t of game.teammatesOut) {
      if (!t.usage || t.usage.value < min) continue
      const label = t.usage.label
      notes.push({ team: t.team, player: t.player, position: t.position, kind: 'out', impact: t.usage.value >= min * 1.3 ? 'high' : 'medium', affects: [t.position.toUpperCase() === 'D' ? 'D' : 'F', 'team'], text: `${t.player} (${t.position}, averaging ${t.usage.value} ${label} per game) is ${t.designation === 'ir' ? 'on injured reserve' : t.designation} tonight — ${t.team}'s rotation has to absorb those ${label}, which shifts usage to the players who replace him` })
    }
  }
  return notes
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

export async function buildGameFoundation(game: GameContext): Promise<GameFoundation> {
  const facts = game.facts.nfl
  const teams: Record<string, TeamFoundation> = {}
  const matchup: Record<string, string> = {}
  for (const team of [game.away, game.home]) {
    const opp = other(game, team)
    const off = offenseStyle(facts, team)
    const def = defenseStyle(facts, team)
    const form = formRead(game, team)
    const v = venueHistory(game, team)
    const climate = await climateRead(game, team)
    teams[team] = { offense: off?.text ?? null, offenseLabel: off?.label ?? null, defense: def?.text ?? null, defenseLabel: def?.label ?? null, form, venue: { current: v.current, history: v.history, climate: climate?.text ?? null, historyRec: v.historyRec, climateRec: climate?.rec ?? null } }
    const m = styleMatchup(facts, team, opp)
    if (m) matchup[team] = m
  }
  const roster = [...(game.sport === 'nfl' ? nflRoster(game) : []), ...otherRoster(game)]
  return { teams, styleMatchup: matchup, weather: weatherImpact(game), roster }
}

/** The single most useful sentence about the game for one bet, for the explanation's opening. */
export function foundationHeadline(game: GameContext, team: string | null, kind: 'team' | 'total' | 'prop'): string | null {
  const f = game.foundation
  if (!f) return null
  if (f.weather && (kind !== 'team')) return f.weather.text
  const t = team ? f.teams[team] : null
  if (kind === 'prop') {
    // A prop reads the conditions, the roster change that moves volume and the team's adjusted form; the team-level style matchup is about the game, not the player.
    const hi = f.roster.find((n) => n.impact === 'high' && n.kind === 'out' && (!team || n.team === team || n.team === other(game, team)))
    if (hi) return hi.text
    if (t?.form?.adjusted) return t.form.text
    if (t?.venue.climate) return t.venue.climate
    return t?.form ? t.form.text : null
  }
  if (t?.form?.adjusted) return t.form.text
  if (team && f.styleMatchup[team]) return f.styleMatchup[team]
  if (t?.venue.climate) return t.venue.climate
  if (f.weather) return f.weather.text
  const r = f.roster.find((n) => n.impact === 'high' && (!team || n.team === team || n.team === other(game, team)))
  if (r) return r.text
  if (t?.venue.history) return t.venue.history
  if (t?.form) return t.form.text
  return null
}
