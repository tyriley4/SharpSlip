export interface StadiumHistoryRow {
  season: string
  w: number
  l: number
  pf: number
  pa: number
  ats: string
  ou: string
}

export interface StadiumBetImpact {
  bet: string
  direction: 'for' | 'against' | 'neutral'
  icon: string
  headline: string
  body: string
}

export interface StadiumData {
  name: string
  location: string
  surface: string
  roof: string
  capacity: number
  crowdNoise: number
  weather: {
    temp: string
    wind: string
    humidity: string
    precip: string
    conditions: string
    impact: string
  }
  homeEdge: {
    rating: number
    ats: string
    atsPct: number
    ou: string
    ouPct: number
    homeWinPct: number
  }
  history: StadiumHistoryRow[]
  betImpact: StadiumBetImpact[]
}
