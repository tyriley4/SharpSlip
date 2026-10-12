import type { LogRow } from './summaryTypes'

export const mlbLogColumns = [
  { key: 'date', label: 'DATE' },
  { key: 'opp', label: 'OPP' },
  { key: 'wl', label: 'W/L' },
  { key: 'venue', label: 'VENUE' },
  { key: 'rs', label: 'RS' },
  { key: 'ra', label: 'RA' },
  { key: 'sp', label: 'SP' },
  { key: 'ats', label: 'ATS' },
  { key: 'ou', label: 'O/U' },
]

export function mlbLogRow(
  date: string,
  opp: string,
  wl: 'W' | 'L',
  venue: string,
  rs: number,
  ra: number,
  sp: string,
  ats: 'W' | 'L',
  ou: 'O' | 'U' | 'P'
): LogRow {
  return {
    cells: [
      { value: date },
      { value: opp },
      { value: wl, tone: wl === 'W' ? 'positive' : 'negative' },
      { value: venue },
      { value: String(rs) },
      { value: String(ra) },
      { value: sp },
      { value: ats, tone: ats === 'W' ? 'positive' : 'negative' },
      { value: ou, tone: ou === 'O' ? 'warning' : ou === 'U' ? 'accent' : 'neutral' },
    ],
  }
}

export const nflLogColumns = [
  { key: 'date', label: 'DATE' },
  { key: 'opp', label: 'OPP' },
  { key: 'wl', label: 'W/L' },
  { key: 'pts', label: 'PTS' },
  { key: 'oppPts', label: 'OPP PTS' },
  { key: 'pass', label: 'PASS' },
  { key: 'rush', label: 'RUSH' },
  { key: 'ats', label: 'ATS' },
  { key: 'ou', label: 'O/U' },
]

export function nflLogRow(
  date: string,
  opp: string,
  wl: 'W' | 'L',
  pts: number,
  oppPts: number,
  pass: number,
  rush: number,
  ats: 'W' | 'L',
  ou: 'O' | 'U'
): LogRow {
  return {
    cells: [
      { value: date },
      { value: opp },
      { value: wl, tone: wl === 'W' ? 'positive' : 'negative' },
      { value: String(pts) },
      { value: String(oppPts) },
      { value: String(pass) },
      { value: String(rush) },
      { value: ats, tone: ats === 'W' ? 'positive' : 'negative' },
      { value: ou, tone: ou === 'O' ? 'warning' : 'accent' },
    ],
  }
}
