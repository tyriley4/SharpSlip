import { horizonOf } from './horizon'
import type { BettingOutcome, Edge, GameContext, PlayerHistory } from './types'

/**
 * Evidence is only useful if it says why it matters tonight. Every item a module produces is a pattern ("MIL covers
 * +1.5 82% of the time on the road"); this pass completes the thought as "[pattern] — tonight [what is the same, and
 * the one real fact that makes tonight's version of it favorable]". Nothing is invented: the tonight clause is built from
 * the game's own context (venue, series game, probable starters, bullpen use, rest, injuries, weather, the line itself),
 * and the fact is left out when none of them points the right way.
 */

const f1 = (n: number) => n.toFixed(1)
const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}
const clean = (s: string) => s.replace(/\s+/g, ' ').replace(/[.\s]+$/, '')
const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

type Kind = 'h2h' | 'form' | 'venue' | 'rate' | 'matchup' | 'context' | 'role' | 'situational' | 'streak' | 'starters'

interface Who {
  /** The side the bet is on (team bets), or the player's team (props). */
  team: string | null
  opp: string | null
  home: boolean | null
  /** Subject of a prop. */
  player: string | null
}

function whoIs(o: BettingOutcome): Who {
  if (o.type === 'player_prop') return { team: o.player?.team || null, opp: o.opponent ?? null, home: o.homeAway ? o.homeAway === 'home' : null, player: o.player?.name ?? null }
  if (o.team) return { team: o.team.abbr, opp: o.team.opponent, home: o.team.home, player: null }
  return { team: null, opp: null, home: null, player: null }
}

function kindOf(e: Edge): Kind {
  const t = e.description
  if (e.category === 'h2h') return 'h2h'
  if (e.category === 'context') return 'context'
  if (e.category === 'matchup') return 'matchup'
  if (e.category === 'situational') return 'situational'
  if (e.category === 'role') return 'role'
  if (e.category === 'recent_form' && /ERA/.test(t)) return 'starters'
  if (e.category === 'recent_form') return /each of the last|in each of|straight/i.test(t) ? 'streak' : 'form'
  if (/^(at home|on the road)\b/i.test(t) || /\bat home,|\bon the road,/i.test(t)) return 'venue'
  return 'rate'
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)

/** ERA over a starter's last five starts, from the starts the MLB facts carry. */
function last5Era(st: { starts: { ip: number; er: number }[] } | null | undefined): number | null {
  if (!st) return null
  const s = st.starts.slice(0, 5)
  const ip = s.reduce((n, x) => n + x.ip, 0)
  return s.length >= 3 && ip > 0 ? (s.reduce((n, x) => n + x.er, 0) * 9) / ip : null
}

/** The one fact about tonight that points the way the bet needs, or null. Everything here is read from the game context. */
function favorableFact(o: BettingOutcome, g: GameContext, w: Who): string | null {
  const side = (abbr: string | null): 'away' | 'home' | null => (abbr === g.away ? 'away' : abbr === g.home ? 'home' : null)
  const mine = side(w.team)
  const theirs = side(w.opp)
  const over = o.type === 'total' ? o.direction === 'over' : null
  const forTeam = (o.type === 'moneyline' || o.type === 'spread') && !!w.team
  const hitterOrTeam = forTeam || (o.type === 'player_prop' && o.direction !== 'under')
  const T = w.team ?? ''
  const O = w.opp ?? ''
  const mlb = g.facts.mlb

  if (mlb) {
    // The opposing bullpen carries a heavy recent load: late innings go to tired arms.
    const pen = theirs && hitterOrTeam ? mlb.bullpen[theirs] : null
    if (pen && pen.lastTwoDaysInnings >= 5) return `${O}'s bullpen arrives having thrown ${f1(pen.lastTwoDaysInnings)} innings over the last two days, which leaves its late innings thinner`
    if (over !== null) {
      const tired = (['away', 'home'] as const).map((s) => ({ s, p: mlb.bullpen[s] })).filter((x) => x.p && x.p.lastTwoDaysInnings >= 5)
      if (over && tired.length) return `${tired.map((x) => `${x.p!.team}'s bullpen (${f1(x.p!.lastTwoDaysInnings)} innings over the last two days)`).join(' and ')} enter${tired.length === 1 ? 's' : ''} worn, which raises late-inning scoring odds`
    }
    const eraA = last5Era(mlb.starters.away)
    const eraH = last5Era(mlb.starters.home)
    if (over !== null && eraA !== null && eraH !== null && mlb.starters.away && mlb.starters.home) {
      if (over && eraA >= 4.5 && eraH >= 4.5) return `neither probable starter has been sharp (${mlb.starters.away.name} ${eraA.toFixed(2)} and ${mlb.starters.home.name} ${eraH.toFixed(2)} ERA over the last five starts)`
      if (!over && eraA <= 3.5 && eraH <= 3.5) return `both probable starters have been sharp (${mlb.starters.away.name} ${eraA.toFixed(2)} and ${mlb.starters.home.name} ${eraH.toFixed(2)} ERA over the last five starts)`
    }
    if (forTeam && mine && theirs) {
      const myS = mlb.starters[mine]
      const opS = mlb.starters[theirs]
      const a = last5Era(myS)
      const b = last5Era(opS)
      if (myS && opS && a !== null && b !== null && b - a >= 0.75) return `${myS.name} (${a.toFixed(2)} ERA over his last five starts) is lined up against ${opS.name} (${b.toFixed(2)})`
    }
  }

  const wx = g.weather
  if (over !== null && wx && !wx.indoor) {
    if (over && ((wx.windMph ?? 0) >= 10 && /out/i.test(wx.windDirection ?? '') || (wx.tempF ?? 0) >= 85)) return `the forecast (${wx.tempF !== null ? `${Math.round(wx.tempF)}°F` : ''}${wx.windMph !== null ? `${wx.tempF !== null ? ', ' : ''}${Math.round(wx.windMph)} mph wind${wx.windDirection ? ` ${wx.windDirection}` : ''}` : ''}) favors scoring`
    if (!over && ((wx.windMph ?? 0) >= 10 && /in\b/i.test(wx.windDirection ?? '') || ((wx.tempF ?? 99) <= 45) || wx.precipitation)) return `the forecast (${wx.tempF !== null ? `${Math.round(wx.tempF)}°F` : ''}${wx.windMph !== null ? `${wx.tempF !== null ? ', ' : ''}${Math.round(wx.windMph)} mph wind${wx.windDirection ? ` ${wx.windDirection}` : ''}` : ''}${wx.precipitation ? ', precipitation' : ''}) suppresses scoring`
  }

  if (hitterOrTeam && w.opp) {
    // Relievers are left out for baseball: one arm missing from a bullpen of a dozen is not a reason.
    const out = g.injuries.filter((i) => i.team === w.opp && (i.designation === 'out' || i.designation === 'ir' || i.designation === 'doubtful') && !(g.sport === 'mlb' && i.position === 'RP')).slice(0, 2)
    if (out.length) return `${O} is without ${list(out.map((i) => `${i.player} (${i.position})`))}`
    const nfl = g.facts.nfl?.depth?.[w.opp]
    if (nfl && nfl.outStarters.length) return `${O} is missing ${list(nfl.outStarters.slice(0, 2).map((s) => `${s.name} (${s.pos})`))} from its starting group`
  }

  if (hitterOrTeam && mine && theirs) {
    const rm = g.rest[w.team!]
    const ro = g.rest[w.opp!]
    if (rm !== null && ro !== null && rm !== undefined && ro !== undefined && rm - ro >= 2) return `${T} has had ${rm} days of rest against ${ro} for ${O}`
    if (g.sport === 'nba' && g.facts.nba && (g.facts.nba.gamesInFour[w.opp!] ?? 0) >= 3) return `${O} is playing its third game in four nights`
  }
  if (g.sport === 'nhl' && hitterOrTeam && g.facts.nhl && theirs) {
    const gl = g.facts.nhl.goalies[theirs]
    if (gl && gl.last5SvPct != null && gl.seasonSavePct != null && gl.seasonSavePct - gl.last5SvPct >= 0.015) return `${O}'s likely starter ${gl.name} has stopped just ${(gl.last5SvPct as number).toFixed(3).replace(/^0/, '')} over his last five starts`
  }

  const oppPct = w.opp ? g.winPct[w.opp] ?? g.leagueWinPct[w.opp] : undefined
  if (hitterOrTeam && oppPct !== undefined && oppPct <= 0.42) return `${O} is winning just ${Math.round(oppPct * 100)}% of its games`
  return null
}

/** What tonight is, in the terms the pattern was measured in. */
function sameSpot(kind: Kind, o: BettingOutcome, g: GameContext, w: Who): string {
  const T = w.team ?? ''
  const O = w.opp ?? ''
  const venue = w.home === null ? '' : w.home ? 'at home' : 'on the road'
  const matchup = `${g.away} at ${g.home}`
  const line = o.threshold !== undefined ? o.threshold : null
  const role = o.type === 'spread' && line !== null ? (line > 0 ? `as a ${line}-point underdog` : `as a ${Math.abs(line)}-point favorite`) : ''
  const series = g.facts.mlb?.series
  const seriesName = series ? (series.short || series.description).replace(/\s*Game \d+$/i, '') : ''
  const meetingNo = (() => {
    if (!w.team || !w.opp) return null
    const count = (a: string, b: string) => {
      const rows = g.results[a] ?? []
      const cur = Math.max(0, ...rows.map((r) => r.season))
      return rows.filter((r) => r.season === cur && r.opp === b).length
    }
    // Either side's schedule can be the more complete one.
    return Math.max(count(w.team, w.opp), count(w.opp, w.team)) + 1
  })()

  switch (kind) {
    case 'h2h': {
      const base = meetingNo ? `tonight is the ${ordinal(meetingNo)} meeting between ${g.away} and ${g.home} this season` : `tonight ${g.away} and ${g.home} meet again`
      return series ? `${base}, Game ${series.gameNumber} of the ${seriesName}` : base
    }
    case 'starters':
      return g.facts.mlb?.starters.away && g.facts.mlb?.starters.home
        ? `tonight ${g.facts.mlb.starters.away.name} (${g.away}) and ${g.facts.mlb.starters.home.name} (${g.home}) are the probable starters, so these recent starts are the matchup on the mound`
        : 'tonight those starters are the probable starters, so these recent starts are the matchup on the mound'
    case 'form':
    case 'streak':
      return o.type === 'total' ? `tonight ${g.away} and ${g.home} bring that form into the line of ${line}` : w.player ? `tonight ${w.player} brings that form into the game ${venue} against ${O}` : `tonight ${T} carries that form into the game ${venue} against ${O}`
    case 'venue':
      return `tonight ${w.player ? w.player : T} plays ${venue} against ${O}${role ? ` ${role}` : ''}, the same split`
    case 'matchup':
      return o.type === 'total' ? `tonight ${g.away} visits ${g.home}${line !== null ? ` with the line at ${line}` : ''}` : `tonight ${T} is ${venue} against ${O}${role ? ` ${role}` : ''}`
    case 'role':
      return w.player ? `tonight ${w.player} carries that role into the game ${venue} against ${O}${line !== null ? `, with the line at ${line}` : ''}` : `tonight's ${matchup} game is where that applies`
    case 'context':
      return series ? `tonight is Game ${series.gameNumber} of the ${seriesName}, which starts from that series state` : `tonight's ${matchup} game starts from that context`
    case 'situational':
      return `that is the state heading into tonight's ${matchup} game`
    case 'rate':
    default:
      return o.type === 'total'
        ? `tonight the line is ${line}, the exact wager that rate measures`
        : o.type === 'player_prop'
          ? `tonight ${w.player ?? 'the player'} faces ${O} ${venue}${line !== null ? ` with the line at ${line}` : ''}, the exact wager that rate measures`
          : `tonight ${T} is ${venue} against ${O}${role ? ` ${role}` : ''}, the exact wager that rate measures`
  }
}

/** Completes every evidence item with its tonight clause. Items that already say what tonight looks like are left alone. */
export function connectToTonight(edges: Edge[], o: BettingOutcome, g: GameContext, _history?: PlayerHistory | null): Edge[] {
  const w = whoIs(o)
  const fact = favorableFact(o, g, w)
  void _history
  let usedFact = false
  return edges.map((e) => {
    // Keep the time horizon read from the original wording before the clause is added.
    const horizon = horizonOf(e)
    if (/\btonight|\btoday\b/i.test(e.description)) return e.horizon ? e : { ...e, horizon }
    const kind = kindOf(e)
    const spot = sameSpot(kind, o, g, w)
    // The fact rides on the strongest item only, so the list does not repeat it.
    // Skip a fact the item already states (it names the same people).
    const names = (fact ?? '').match(/[A-Z][a-z]{4,}/g) ?? []
    const repeats = names.some((n) => e.description.includes(n))
    const withFact = !!fact && !usedFact && !repeats && ['rate', 'venue', 'form', 'h2h', 'matchup', 'streak'].includes(kind)
    if (withFact) usedFact = true
    return { ...e, horizon, description: `${clean(e.description)} — ${spot}${withFact ? `; ${fact}` : ''}` }
  })
}
