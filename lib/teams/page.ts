import type { Sport } from '@/lib/sport/SportContext'
import { getCbbTeamPage } from './cbb'
import { getCfbTeamPage } from './cfb'
import { getMlbTeamPage } from './mlb'
import { getNbaTeamPage } from './nba'
import { getNflTeamPage } from './nfl'
import { getNhlTeamPage } from './nhl'
import type { TeamPageData } from './types'

/** Builds a team page for any sport; returns null when the team is unknown or its data can't be loaded at all. */
export async function getTeamPage(sport: Sport, abbr: string): Promise<TeamPageData | null> {
  try {
    switch (sport) {
      case 'mlb':
        return await getMlbTeamPage(abbr)
      case 'nfl':
        return await getNflTeamPage(abbr)
      case 'cfb':
        return await getCfbTeamPage(abbr)
      case 'cbb':
        return await getCbbTeamPage(abbr)
      case 'nba':
        return await getNbaTeamPage(abbr)
      case 'nhl':
        return await getNhlTeamPage(abbr)
      default:
        return null
    }
  } catch (err) {
    console.error(`[teams/page] ${sport} ${abbr} failed:`, err)
    return null
  }
}
