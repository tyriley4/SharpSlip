import { cached } from '@/lib/net/ttlCache'
import { slugify } from '@/lib/players/slug'

/** Everything the MLB schedule feed knows about one game: type, series, roof and weather, lineups and probable starters. */
export interface MlbGameInfo {
  gameType: string
  seriesGame?: number
  seriesDescription?: string
  roofType: string
  /** Game-time weather as the league publishes it; condition reads "Roof Closed" or "Dome" under a roof. */
  weather: { condition: string; tempF: number | null; windMph: number | null; windDirection: string | null } | null
  /** Batting order by team side, as player-name slugs (empty until the lineup is posted). */
  lineups: { away: string[]; home: string[] }
  probables: { away: { id: number; name: string } | null; home: { id: number; name: string } | null }
  teamIds: { away: number; home: number }
  /** Batting order with MLB person ids (empty until the lineup is posted). */
  lineupPlayers: { away: { id: number; name: string }[]; home: { id: number; name: string }[] }
  officialDate: string
  series: { description: string; short: string; result: string; gameNumber: number; totalGames: number; isOver: boolean; isTied: boolean; wins: number; losses: number; leaderId: number | null } | null
}

interface RawGame {
  gameType?: string
  seriesGameNumber?: number
  seriesDescription?: string
  venue?: { fieldInfo?: { roofType?: string } }
  weather?: { condition?: string; temp?: string; wind?: string }
  lineups?: { awayPlayers?: { id: number; fullName: string }[]; homePlayers?: { id: number; fullName: string }[] }
  teams?: { away?: { team?: { id: number }; probablePitcher?: { id: number; fullName: string } }; home?: { team?: { id: number }; probablePitcher?: { id: number; fullName: string } } }
  officialDate?: string
  seriesStatus?: { description?: string; shortDescription?: string; result?: string; gameNumber?: number; totalGames?: number; isOver?: boolean; isTied?: boolean; wins?: number; losses?: number; winningTeam?: { id: number } }
}

function parseWeather(w: RawGame['weather']): MlbGameInfo['weather'] {
  if (!w?.condition) return null
  const wind = /(\d+)\s*mph,?\s*(.*)/i.exec(w.wind ?? '')
  const temp = Number(w.temp)
  return { condition: w.condition, tempF: Number.isFinite(temp) ? temp : null, windMph: wind ? Number(wind[1]) : null, windDirection: wind?.[2]?.trim() || null }
}

export async function loadMlbGameInfo(gamePk: string): Promise<MlbGameInfo | null> {
  return cached(`edges:mlbgame:${gamePk}`, 3600, async () => {
    try {
      const res = await fetch(`https://statsapi.mlb.com/api/v1/schedule?gamePk=${gamePk}&hydrate=probablePitcher,lineups,weather,venue(fieldInfo),seriesStatus`, { next: { revalidate: 1800 } })
      if (!res.ok) return null
      const g = ((await res.json()) as { dates?: { games?: RawGame[] }[] }).dates?.[0]?.games?.[0]
      if (!g) return null
      const names = (list?: { fullName: string }[]) => (list ?? []).map((p) => slugify(p.fullName))
      const pick = (p?: { id: number; fullName: string }) => (p ? { id: p.id, name: p.fullName } : null)
      return {
        gameType: g.gameType ?? 'R',
        seriesGame: g.seriesGameNumber,
        seriesDescription: g.seriesDescription,
        roofType: g.venue?.fieldInfo?.roofType ?? 'Open',
        weather: parseWeather(g.weather),
        lineups: { away: names(g.lineups?.awayPlayers), home: names(g.lineups?.homePlayers) },
        probables: { away: pick(g.teams?.away?.probablePitcher), home: pick(g.teams?.home?.probablePitcher) },
        teamIds: { away: g.teams?.away?.team?.id ?? 0, home: g.teams?.home?.team?.id ?? 0 },
        lineupPlayers: { away: (g.lineups?.awayPlayers ?? []).map((p) => ({ id: p.id, name: p.fullName })), home: (g.lineups?.homePlayers ?? []).map((p) => ({ id: p.id, name: p.fullName })) },
        officialDate: g.officialDate ?? '',
        series: g.seriesStatus
          ? { description: g.seriesStatus.description ?? '', short: g.seriesStatus.shortDescription ?? '', result: g.seriesStatus.result ?? '', gameNumber: g.seriesStatus.gameNumber ?? 0, totalGames: g.seriesStatus.totalGames ?? 0, isOver: !!g.seriesStatus.isOver, isTied: !!g.seriesStatus.isTied, wins: g.seriesStatus.wins ?? 0, losses: g.seriesStatus.losses ?? 0, leaderId: g.seriesStatus.isTied ? null : (g.seriesStatus.winningTeam?.id ?? null) }
          : null,
      } satisfies MlbGameInfo
    } catch {
      return null
    }
  })
}

/** True when the MLB game is played under a closed roof or dome (a forecast would be meaningless). */
export function mlbIndoors(info: MlbGameInfo | null): boolean {
  if (!info) return false
  if (info.roofType === 'Dome') return true
  const c = info.weather?.condition ?? ''
  if (/roof closed|dome/i.test(c)) return true
  // A retractable roof with no game-time status is treated as closed: a forecast would not describe the park.
  return info.roofType === 'Retractable' && !info.weather
}
