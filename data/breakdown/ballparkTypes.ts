export interface ParkFactor {
  val: number
  label: string
  icon: string
  good: boolean
  note: string
}

export interface FieldDimension {
  loc: string
  dist: number
  x: number
  y: number
  label: string
  short: boolean
}

export interface BallparkData {
  name: string
  location: string
  opened: number
  surface: string
  capacity: number
  roof: string
  factors: Record<string, ParkFactor>
  dimensions: FieldDimension[]
  weather: {
    temp: number
    condition: string
    icon: string
    wind: { speed: number; dir: 'IN' | 'OUT'; dirFull: string }
    humidity: number
    dewPoint: number
    visibility: number
  }
  historical: { season: string; games: number; avgTotal: number; overRate: number; hrPerGame: number }[]
  impacts: {
    bet: string
    direction: 'for' | 'against' | 'neutral'
    icon: string
    headline: string
    body: string
  }[]
}
