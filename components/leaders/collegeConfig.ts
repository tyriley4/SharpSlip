import { CFB_BETTING_CATEGORIES, CFB_BETTING_SUBS, CFB_BETTING_THRESHOLDS, formatCfbThreshold, isCfbBettingSub } from '@/lib/college/cfbProps'
import { CBB_BETTING_CATEGORIES, CBB_BETTING_THRESHOLDS, formatCbbThreshold } from '@/lib/college/cbbProps'
import type { CollegeLeadersConfig } from './CollegeLeadersView'

export const CFB_LEADERS_CONFIG: CollegeLeadersConfig = {
  sport: 'cfb',
  label: 'CFB',
  color: '#8B0000',
  textOnColor: '#FFFFFF',
  icon: '🏈',
  apiPath: '/api/cfb-leaders',
  bettingSubs: [...CFB_BETTING_SUBS],
  bettingCategories: (sub) => (isCfbBettingSub(sub) ? CFB_BETTING_CATEGORIES[sub] : []),
  thresholds: CFB_BETTING_THRESHOLDS,
  formatThreshold: formatCfbThreshold,
  showConference: true,
  bettingExplainer: 'Betting stats cover QB, RB, WR and TE',
  teamsNote: 'Team boards are per-game averages across FBS games this season (Points Allowed ranks lowest first).',
}

export const CBB_LEADERS_CONFIG: CollegeLeadersConfig = {
  sport: 'cbb',
  label: 'CBB',
  color: '#FF9F1C',
  textOnColor: '#08090C',
  icon: '🏀',
  apiPath: '/api/cbb-leaders',
  bettingSubs: ['Players'],
  bettingCategories: (sub) => (sub === 'Players' ? CBB_BETTING_CATEGORIES : []),
  thresholds: CBB_BETTING_THRESHOLDS,
  formatThreshold: formatCbbThreshold,
  showConference: false,
  bettingExplainer: 'Betting stats cover individual players',
  teamsNote: 'Team boards are per-game averages from ESPN season team stats (Points Allowed ranks lowest first).',
}
