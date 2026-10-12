import type { BatterPropRow, BatterStats, TeamBatting } from './battingTypes'

interface RawBatter {
  name: string
  pos: string
  bats: 'L' | 'R' | 'S'
  hot: boolean
  cold: boolean
  std: { avg: string; obp: string; slg: string; ops: string; pa: number }
  adv: {
    woba: string
    wrc: number
    xba: string
    xslg: string
    hard: number
    barrel: number
    kpct: number
    bbpct: number
    chase: number
    whiff: number
  }
  splits: { vslAvg: string; vslOps: string; vsrAvg: string; vsrOps: string; homeOps: string; awayOps: string }
  note: string
}

const SPEED_BASE: Record<string, number> = {
  C: 25.8,
  '1B': 26.4,
  '2B': 27.6,
  SS: 27.9,
  '3B': 26.9,
  LF: 27.8,
  CF: 28.6,
  RF: 27.7,
  DH: 26.2,
}

function seed(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 97
  return h
}

function trimZero(n: number): string {
  return n.toFixed(3).replace(/^0/, '')
}

function enrich(list: RawBatter[]): BatterStats[] {
  return list.map((p) => {
    const s = seed(p.name)
    const hr = Math.max(2, Math.round(p.adv.barrel * 1.7))
    const rbi = Math.max(6, Math.round(parseFloat(p.std.ops) * p.std.pa * 0.135))
    const speedBase = SPEED_BASE[p.pos] ?? 27.0
    const sprintSpeed = `${(speedBase + ((s % 10) / 10 - 0.4)).toFixed(1)} ft/s`

    const avgNum = parseFloat(p.std.avg)
    const l7delta = p.hot ? 0.045 : p.cold ? -0.05 : (s % 5) * 0.004 - 0.008
    const l14delta = l7delta * 0.6
    const l7avg = trimZero(Math.max(0.1, avgNum + l7delta))
    const l14avg = trimZero(Math.max(0.1, avgNum + l14delta))
    const l7hr = p.hot ? 2 + (s % 2) : p.cold ? 0 : 1
    const l14hr = p.hot ? 4 + (s % 2) : p.cold ? 1 : 2
    const l7rbi = p.hot ? 6 + (s % 3) : p.cold ? 1 : 3

    return {
      ...p,
      std: { ...p.std, hr, rbi },
      adv: { ...p.adv, sprintSpeed },
      hotcold: { l7avg, l7hr, l7rbi, l14avg, l14hr },
    }
  })
}

function propsFor(lineup: BatterStats[], targets: string): BatterPropRow[] {
  return lineup.map((p) => {
    const label: BatterPropRow['label'] = p.hot ? 'Hot' : p.cold ? 'Cold' : 'Avg'
    const base = p.hot ? 68 : p.cold ? 34 : 52
    const pct = {
      anytimeHit: base + 6,
      totalBases: base - 4,
      hr: Math.max(15, base - 30),
      rbi: base - 12,
    }
    const rec = (v: number) => `${Math.round((v / 100) * 18)}-${18 - Math.round((v / 100) * 18)}`
    const streak = (v: number) => (v >= 65 ? 'W4' : v >= 50 ? 'W1' : v >= 35 ? 'L2' : 'L3')
    return {
      label,
      rec: {
        anytimeHit: rec(pct.anytimeHit),
        totalBases: rec(pct.totalBases),
        hr: rec(pct.hr),
        rbi: rec(pct.rbi),
      },
      pct,
      streak: {
        anytimeHit: streak(pct.anytimeHit),
        totalBases: streak(pct.totalBases),
        hr: streak(pct.hr),
        rbi: streak(pct.rbi),
      },
      targets: p.hot ? targets : '',
    }
  })
}

const bos: RawBatter[] = [
  { name: 'Masataka Yoshida', pos: 'LF', bats: 'L', hot: true, cold: false, std: { avg: '.278', obp: '.348', slg: '.429', ops: '.777', pa: 312 }, adv: { woba: '.338', wrc: 108, xba: '.261', xslg: '.412', hard: 38.2, barrel: 6.1, kpct: 16.4, bbpct: 9.8, chase: 28.1, whiff: 22.4 }, splits: { vslAvg: '.301', vslOps: '.841', vsrAvg: '.264', vsrOps: '.741', homeOps: '.831', awayOps: '.711' }, note: 'Contact-first LHH. .311 AVG vs RHP in 2024.' },
  { name: 'Rafael Devers', pos: '3B', bats: 'L', hot: true, cold: false, std: { avg: '.281', obp: '.341', slg: '.521', ops: '.862', pa: 298 }, adv: { woba: '.361', wrc: 128, xba: '.264', xslg: '.512', hard: 48.1, barrel: 9.8, kpct: 18.2, bbpct: 8.4, chase: 32.1, whiff: 26.8 }, splits: { vslAvg: '.298', vslOps: '.912', vsrAvg: '.256', vsrOps: '.788', homeOps: '.871', awayOps: '.788' }, note: 'Elite power LHH. 2 HR in 16 AB vs Cole career.' },
  { name: 'Triston Casas', pos: '1B', bats: 'L', hot: false, cold: false, std: { avg: '.242', obp: '.341', slg: '.428', ops: '.769', pa: 278 }, adv: { woba: '.338', wrc: 112, xba: '.251', xslg: '.428', hard: 41.2, barrel: 7.4, kpct: 22.4, bbpct: 12.1, chase: 27.4, whiff: 24.1 }, splits: { vslAvg: '.264', vslOps: '.814', vsrAvg: '.228', vsrOps: '.714', homeOps: '.791', awayOps: '.704' }, note: 'Patient hitter. High walk rate reduces K exposure.' },
  { name: "Tyler O'Neill", pos: 'RF', bats: 'R', hot: false, cold: true, std: { avg: '.241', obp: '.301', slg: '.418', ops: '.719', pa: 241 }, adv: { woba: '.318', wrc: 98, xba: '.234', xslg: '.441', hard: 44.8, barrel: 8.1, kpct: 28.4, bbpct: 7.8, chase: 34.2, whiff: 28.4 }, splits: { vslAvg: '.198', vslOps: '.641', vsrAvg: '.244', vsrOps: '.754', homeOps: '.748', awayOps: '.678' }, note: 'High K risk vs elite RHP. 28.4% K rate last 14D.' },
]

const nyy: RawBatter[] = [
  { name: 'Aaron Judge', pos: 'RF', bats: 'R', hot: true, cold: false, std: { avg: '.298', obp: '.401', slg: '.594', ops: '.995', pa: 318 }, adv: { woba: '.421', wrc: 182, xba: '.281', xslg: '.571', hard: 52.4, barrel: 14.8, kpct: 28.4, bbpct: 18.2, chase: 24.1, whiff: 28.4 }, splits: { vslAvg: '.341', vslOps: '1.084', vsrAvg: '.278', vsrOps: '.941', homeOps: '1.021', awayOps: '.948' }, note: 'MVP-caliber. 3 HR last 5G. Elite vs all pitch types.' },
  { name: 'Juan Soto', pos: 'LF', bats: 'L', hot: true, cold: false, std: { avg: '.312', obp: '.421', slg: '.541', ops: '.962', pa: 308 }, adv: { woba: '.412', wrc: 174, xba: '.298', xslg: '.524', hard: 44.1, barrel: 11.2, kpct: 18.4, bbpct: 21.4, chase: 22.4, whiff: 18.1 }, splits: { vslAvg: '.338', vslOps: '.984', vsrAvg: '.294', vsrOps: '.924', homeOps: '.984', awayOps: '.934' }, note: 'Elite OBP machine. .412 BA last 14D vs BOS.' },
  { name: 'Giancarlo Stanton', pos: 'DH', bats: 'R', hot: false, cold: false, std: { avg: '.241', obp: '.318', slg: '.518', ops: '.836', pa: 284 }, adv: { woba: '.358', wrc: 132, xba: '.251', xslg: '.508', hard: 54.8, barrel: 13.1, kpct: 32.4, bbpct: 9.8, chase: 28.4, whiff: 32.1 }, splits: { vslAvg: '.264', vslOps: '.888', vsrAvg: '.228', vsrOps: '.804', homeOps: '.864', awayOps: '.804' }, note: 'Raw power. High K rate but elite damage on contact.' },
  { name: 'Anthony Rizzo', pos: '1B', bats: 'L', hot: false, cold: true, std: { avg: '.218', obp: '.311', slg: '.381', ops: '.692', pa: 264 }, adv: { woba: '.308', wrc: 94, xba: '.228', xslg: '.378', hard: 38.4, barrel: 6.8, kpct: 18.4, bbpct: 11.4, chase: 29.8, whiff: 22.4 }, splits: { vslAvg: '.241', vslOps: '.754', vsrAvg: '.208', vsrOps: '.661', homeOps: '.714', awayOps: '.664' }, note: 'Veteran presence. Below-average year vs RHP.' },
]

const lad: RawBatter[] = [
  { name: 'Mookie Betts', pos: 'RF', bats: 'R', hot: true, cold: false, std: { avg: '.301', obp: '.389', slg: '.541', ops: '.930', pa: 322 }, adv: { woba: '.402', wrc: 164, xba: '.288', xslg: '.518', hard: 46.2, barrel: 10.4, kpct: 14.8, bbpct: 13.4, chase: 21.4, whiff: 17.8 }, splits: { vslAvg: '.318', vslOps: '.964', vsrAvg: '.291', vsrOps: '.911', homeOps: '.948', awayOps: '.911' }, note: 'Elite all-around hitter. Rarely slumps for long.' },
  { name: 'Freddie Freeman', pos: '1B', bats: 'L', hot: true, cold: false, std: { avg: '.311', obp: '.398', slg: '.518', ops: '.916', pa: 315 }, adv: { woba: '.398', wrc: 158, xba: '.294', xslg: '.501', hard: 45.1, barrel: 9.1, kpct: 13.4, bbpct: 12.8, chase: 20.8, whiff: 16.4 }, splits: { vslAvg: '.291', vslOps: '.861', vsrAvg: '.318', vsrOps: '.941', homeOps: '.941', awayOps: '.891' }, note: 'Consistent contact machine. Rarely cold.' },
  { name: 'Shohei Ohtani', pos: 'DH', bats: 'L', hot: true, cold: false, std: { avg: '.304', obp: '.398', slg: '.611', ops: '1.009', pa: 328 }, adv: { woba: '.428', wrc: 188, xba: '.296', xslg: '.588', hard: 51.4, barrel: 15.1, kpct: 24.1, bbpct: 14.8, chase: 26.4, whiff: 24.8 }, splits: { vslAvg: '.284', vslOps: '.921', vsrAvg: '.311', vsrOps: '1.041', homeOps: '1.021', awayOps: '.994' }, note: 'MVP-caliber power/speed combo. Elite vs everything.' },
  { name: 'Will Smith', pos: 'C', bats: 'R', hot: false, cold: false, std: { avg: '.264', obp: '.358', slg: '.438', ops: '.796', pa: 268 }, adv: { woba: '.348', wrc: 118, xba: '.254', xslg: '.421', hard: 39.8, barrel: 7.8, kpct: 16.8, bbpct: 12.4, chase: 24.1, whiff: 19.8 }, splits: { vslAvg: '.281', vslOps: '.821', vsrAvg: '.258', vsrOps: '.784', homeOps: '.814', awayOps: '.771' }, note: 'Solid two-way catcher. Reliable OBP.' },
]

const sf: RawBatter[] = [
  { name: 'Matt Chapman', pos: '3B', bats: 'R', hot: false, cold: false, std: { avg: '.251', obp: '.328', slg: '.448', ops: '.776', pa: 291 }, adv: { woba: '.341', wrc: 114, xba: '.244', xslg: '.431', hard: 43.1, barrel: 9.4, kpct: 24.8, bbpct: 9.8, chase: 27.1, whiff: 25.4 }, splits: { vslAvg: '.238', vslOps: '.741', vsrAvg: '.258', vsrOps: '.798', homeOps: '.764', awayOps: '.788' }, note: 'Power bat, streaky. Solid defender at 3B.' },
  { name: 'Jung Hoo Lee', pos: 'CF', bats: 'L', hot: true, cold: false, std: { avg: '.271', obp: '.339', slg: '.401', ops: '.740', pa: 274 }, adv: { woba: '.328', wrc: 106, xba: '.264', xslg: '.394', hard: 36.4, barrel: 5.8, kpct: 15.4, bbpct: 8.1, chase: 25.8, whiff: 18.4 }, splits: { vslAvg: '.298', vslOps: '.788', vsrAvg: '.254', vsrOps: '.711', homeOps: '.724', awayOps: '.751' }, note: 'Contact-oriented rookie. On a 6-game hit streak.' },
  { name: 'Wilmer Flores', pos: '1B', bats: 'R', hot: false, cold: false, std: { avg: '.258', obp: '.311', slg: '.418', ops: '.729', pa: 248 }, adv: { woba: '.318', wrc: 98, xba: '.248', xslg: '.401', hard: 38.4, barrel: 6.1, kpct: 17.8, bbpct: 6.4, chase: 31.4, whiff: 21.8 }, splits: { vslAvg: '.271', vslOps: '.761', vsrAvg: '.251', vsrOps: '.714', homeOps: '.738', awayOps: '.718' }, note: 'Veteran contact bat. Limited power upside.' },
  { name: 'Patrick Bailey', pos: 'C', bats: 'S', hot: false, cold: true, std: { avg: '.221', obp: '.284', slg: '.371', ops: '.655', pa: 231 }, adv: { woba: '.288', wrc: 82, xba: '.228', xslg: '.368', hard: 34.1, barrel: 4.8, kpct: 26.4, bbpct: 6.8, chase: 33.8, whiff: 27.1 }, splits: { vslAvg: '.238', vslOps: '.688', vsrAvg: '.214', vsrOps: '.638', homeOps: '.671', awayOps: '.638' }, note: 'Defense-first catcher. Cold at the plate lately.' },
]

const hou: RawBatter[] = [
  { name: 'Yordan Alvarez', pos: 'DH', bats: 'L', hot: true, cold: false, std: { avg: '.294', obp: '.391', slg: '.571', ops: '.962', pa: 301 }, adv: { woba: '.408', wrc: 172, xba: '.284', xslg: '.548', hard: 49.8, barrel: 13.4, kpct: 20.1, bbpct: 14.1, chase: 23.8, whiff: 22.4 }, splits: { vslAvg: '.268', vslOps: '.881', vsrAvg: '.304', vsrOps: '.994', homeOps: '.984', awayOps: '.941' }, note: 'Elite power LHH. Locked in against right-handers.' },
  { name: 'Jose Altuve', pos: '2B', bats: 'R', hot: false, cold: false, std: { avg: '.271', obp: '.331', slg: '.428', ops: '.759', pa: 312 }, adv: { woba: '.334', wrc: 112, xba: '.261', xslg: '.418', hard: 38.8, barrel: 7.1, kpct: 13.4, bbpct: 7.8, chase: 30.4, whiff: 18.1 }, splits: { vslAvg: '.288', vslOps: '.798', vsrAvg: '.264', vsrOps: '.744', homeOps: '.771', awayOps: '.744' }, note: 'Steady leadoff bat. Low K rate.' },
  { name: 'Alex Bregman', pos: '3B', bats: 'R', hot: false, cold: false, std: { avg: '.261', obp: '.348', slg: '.451', ops: '.799', pa: 298 }, adv: { woba: '.348', wrc: 122, xba: '.251', xslg: '.428', hard: 41.4, barrel: 8.4, kpct: 15.8, bbpct: 12.1, chase: 24.8, whiff: 19.4 }, splits: { vslAvg: '.278', vslOps: '.844', vsrAvg: '.254', vsrOps: '.774', homeOps: '.811', awayOps: '.784' }, note: 'Disciplined approach. Clutch hitter in big spots.' },
  { name: 'Kyle Tucker', pos: 'RF', bats: 'L', hot: true, cold: false, std: { avg: '.288', obp: '.368', slg: '.541', ops: '.909', pa: 291 }, adv: { woba: '.388', wrc: 154, xba: '.278', xslg: '.518', hard: 44.8, barrel: 11.8, kpct: 17.4, bbpct: 11.4, chase: 22.1, whiff: 20.8 }, splits: { vslAvg: '.264', vslOps: '.841', vsrAvg: '.298', vsrOps: '.941', homeOps: '.921', awayOps: '.898' }, note: 'Five-tool talent. Riding a hot streak on the road.' },
]

const atl: RawBatter[] = [
  { name: 'Ronald Acuña Jr.', pos: 'RF', bats: 'R', hot: true, cold: false, std: { avg: '.318', obp: '.408', slg: '.598', ops: '1.006', pa: 331 }, adv: { woba: '.428', wrc: 192, xba: '.301', xslg: '.571', hard: 48.8, barrel: 12.8, kpct: 16.4, bbpct: 13.8, chase: 22.4, whiff: 19.1 }, splits: { vslAvg: '.298', vslOps: '.944', vsrAvg: '.328', vsrOps: '1.041', homeOps: '1.041', awayOps: '.971' }, note: 'MVP-caliber. Elite power-speed combo.' },
  { name: 'Matt Olson', pos: '1B', bats: 'L', hot: true, cold: false, std: { avg: '.276', obp: '.361', slg: '.538', ops: '.899', pa: 318 }, adv: { woba: '.378', wrc: 148, xba: '.268', xslg: '.518', hard: 46.4, barrel: 12.1, kpct: 19.8, bbpct: 11.4, chase: 26.1, whiff: 21.4 }, splits: { vslAvg: '.258', vslOps: '.844', vsrAvg: '.284', vsrOps: '.921', homeOps: '.921', awayOps: '.878' }, note: 'Power-first 1B. 5 HR in last 10 games.' },
  { name: 'Austin Riley', pos: '3B', bats: 'R', hot: false, cold: false, std: { avg: '.268', obp: '.338', slg: '.478', ops: '.816', pa: 304 }, adv: { woba: '.351', wrc: 128, xba: '.258', xslg: '.461', hard: 42.1, barrel: 9.8, kpct: 22.4, bbpct: 8.8, chase: 28.4, whiff: 24.1 }, splits: { vslAvg: '.244', vslOps: '.771', vsrAvg: '.278', vsrOps: '.841', homeOps: '.841', awayOps: '.791' }, note: 'Consistent power bat. Streaky vs LHP.' },
  { name: 'Ozzie Albies', pos: '2B', bats: 'S', hot: false, cold: false, std: { avg: '.264', obp: '.318', slg: '.428', ops: '.746', pa: 292 }, adv: { woba: '.328', wrc: 108, xba: '.254', xslg: '.414', hard: 37.8, barrel: 6.4, kpct: 14.1, bbpct: 6.8, chase: 29.8, whiff: 17.4 }, splits: { vslAvg: '.271', vslOps: '.761', vsrAvg: '.261', vsrOps: '.741', homeOps: '.764', awayOps: '.728' }, note: 'Switch hitter. Solid table-setter atop lineup.' },
]

const tor: RawBatter[] = [
  { name: 'Bo Bichette', pos: 'SS', bats: 'R', hot: false, cold: false, std: { avg: '.271', obp: '.324', slg: '.421', ops: '.745', pa: 301 }, adv: { woba: '.328', wrc: 106, xba: '.261', xslg: '.408', hard: 38.4, barrel: 7.1, kpct: 18.4, bbpct: 6.4, chase: 31.4, whiff: 22.1 }, splits: { vslAvg: '.284', vslOps: '.774', vsrAvg: '.264', vsrOps: '.731', homeOps: '.751', awayOps: '.738' }, note: 'Contact-first shortstop. Down year at the plate.' },
  { name: 'Vladimir Guerrero Jr.', pos: '1B', bats: 'R', hot: true, cold: false, std: { avg: '.301', obp: '.381', slg: '.538', ops: '.919', pa: 314 }, adv: { woba: '.398', wrc: 158, xba: '.291', xslg: '.518', hard: 47.8, barrel: 11.4, kpct: 15.8, bbpct: 11.8, chase: 24.8, whiff: 18.8 }, splits: { vslAvg: '.284', vslOps: '.868', vsrAvg: '.311', vsrOps: '.951', homeOps: '.941', awayOps: '.898' }, note: 'Elite hitter. Locked in over last 2 weeks.' },
  { name: 'George Springer', pos: 'CF', bats: 'R', hot: false, cold: true, std: { avg: '.221', obp: '.298', slg: '.378', ops: '.676', pa: 288 }, adv: { woba: '.298', wrc: 88, xba: '.231', xslg: '.381', hard: 39.1, barrel: 7.4, kpct: 21.4, bbpct: 9.1, chase: 27.8, whiff: 23.4 }, splits: { vslAvg: '.198', vslOps: '.611', vsrAvg: '.234', vsrOps: '.704', homeOps: '.698', awayOps: '.654' }, note: 'Struggling veteran. Cold over last 2 weeks.' },
  { name: 'Daulton Varsho', pos: 'LF', bats: 'L', hot: false, cold: false, std: { avg: '.238', obp: '.301', slg: '.408', ops: '.709', pa: 271 }, adv: { woba: '.311', wrc: 96, xba: '.228', xslg: '.398', hard: 37.4, barrel: 6.8, kpct: 24.1, bbpct: 7.4, chase: 29.1, whiff: 24.8 }, splits: { vslAvg: '.211', vslOps: '.641', vsrAvg: '.248', vsrOps: '.734', homeOps: '.721', awayOps: '.694' }, note: 'Solid defender. Streaky power bat.' },
]

const bal: RawBatter[] = [
  { name: 'Gunnar Henderson', pos: 'SS', bats: 'L', hot: true, cold: false, std: { avg: '.291', obp: '.368', slg: '.548', ops: '.916', pa: 322 }, adv: { woba: '.394', wrc: 156, xba: '.281', xslg: '.528', hard: 45.8, barrel: 11.1, kpct: 17.8, bbpct: 10.4, chase: 23.4, whiff: 20.1 }, splits: { vslAvg: '.271', vslOps: '.858', vsrAvg: '.298', vsrOps: '.941', homeOps: '.938', awayOps: '.894' }, note: 'Emerging star. Elite power-speed profile.' },
  { name: 'Adley Rutschman', pos: 'C', bats: 'S', hot: false, cold: false, std: { avg: '.264', obp: '.354', slg: '.428', ops: '.782', pa: 298 }, adv: { woba: '.348', wrc: 122, xba: '.258', xslg: '.418', hard: 40.1, barrel: 8.1, kpct: 16.4, bbpct: 12.8, chase: 24.1, whiff: 19.4 }, splits: { vslAvg: '.278', vslOps: '.798', vsrAvg: '.258', vsrOps: '.774', homeOps: '.788', awayOps: '.774' }, note: 'Switch-hitting star catcher. Consistent all season.' },
  { name: 'Anthony Santander', pos: 'RF', bats: 'S', hot: false, cold: false, std: { avg: '.251', obp: '.311', slg: '.478', ops: '.789', pa: 308 }, adv: { woba: '.341', wrc: 118, xba: '.244', xslg: '.461', hard: 43.8, barrel: 10.4, kpct: 20.8, bbpct: 7.4, chase: 28.8, whiff: 22.1 }, splits: { vslAvg: '.238', vslOps: '.741', vsrAvg: '.258', vsrOps: '.811', homeOps: '.798', awayOps: '.778' }, note: 'Power bat. Big HR threat vs RHP.' },
  { name: 'Ryan Mountcastle', pos: '1B', bats: 'R', hot: false, cold: true, std: { avg: '.228', obp: '.281', slg: '.401', ops: '.682', pa: 264 }, adv: { woba: '.298', wrc: 89, xba: '.224', xslg: '.394', hard: 38.4, barrel: 7.1, kpct: 26.1, bbpct: 5.8, chase: 33.4, whiff: 26.4 }, splits: { vslAvg: '.211', vslOps: '.638', vsrAvg: '.238', vsrOps: '.708', homeOps: '.701', awayOps: '.664' }, note: 'Streaky power bat. Cold last 2 weeks.' },
]

const tex: RawBatter[] = [
  { name: 'Corey Seager', pos: 'SS', bats: 'L', hot: false, cold: true, std: { avg: '.251', obp: '.328', slg: '.441', ops: '.769', pa: 291 }, adv: { woba: '.338', wrc: 114, xba: '.248', xslg: '.438', hard: 43.1, barrel: 9.8, kpct: 18.4, bbpct: 9.8, chase: 26.4, whiff: 21.1 }, splits: { vslAvg: '.228', vslOps: '.701', vsrAvg: '.264', vsrOps: '.811', homeOps: '.798', awayOps: '.738' }, note: 'Elite talent, currently in a slump.' },
  { name: 'Marcus Semien', pos: '2B', bats: 'R', hot: false, cold: false, std: { avg: '.248', obp: '.318', slg: '.408', ops: '.726', pa: 328 }, adv: { woba: '.318', wrc: 102, xba: '.241', xslg: '.398', hard: 38.4, barrel: 6.8, kpct: 16.8, bbpct: 8.8, chase: 27.4, whiff: 18.4 }, splits: { vslAvg: '.261', vslOps: '.754', vsrAvg: '.244', vsrOps: '.711', homeOps: '.734', awayOps: '.718' }, note: 'Durable leadoff bat. Consistent all year.' },
  { name: 'Adolis García', pos: 'CF', bats: 'R', hot: false, cold: false, std: { avg: '.244', obp: '.291', slg: '.438', ops: '.729', pa: 301 }, adv: { woba: '.318', wrc: 101, xba: '.238', xslg: '.428', hard: 41.4, barrel: 9.4, kpct: 24.8, bbpct: 5.1, chase: 34.1, whiff: 25.8 }, splits: { vslAvg: '.271', vslOps: '.784', vsrAvg: '.231', vsrOps: '.701', homeOps: '.718', awayOps: '.741' }, note: 'Aggressive power hitter. Free swinger.' },
  { name: 'Nathaniel Lowe', pos: '1B', bats: 'L', hot: false, cold: false, std: { avg: '.258', obp: '.348', slg: '.421', ops: '.769', pa: 294 }, adv: { woba: '.341', wrc: 116, xba: '.251', xslg: '.411', hard: 39.8, barrel: 7.4, kpct: 17.4, bbpct: 11.8, chase: 25.1, whiff: 19.8 }, splits: { vslAvg: '.238', vslOps: '.711', vsrAvg: '.271', vsrOps: '.798', homeOps: '.784', awayOps: '.751' }, note: 'Patient hitter. Solid on-base skills.' },
]

const tb: RawBatter[] = [
  { name: 'Yandy Díaz', pos: '1B', bats: 'R', hot: true, cold: false, std: { avg: '.294', obp: '.381', slg: '.461', ops: '.842', pa: 311 }, adv: { woba: '.378', wrc: 144, xba: '.284', xslg: '.448', hard: 41.4, barrel: 8.1, kpct: 15.4, bbpct: 12.4, chase: 22.1, whiff: 17.1 }, splits: { vslAvg: '.278', vslOps: '.804', vsrAvg: '.298', vsrOps: '.858', homeOps: '.864', awayOps: '.821' }, note: 'Elite contact hitter. On-base machine.' },
  { name: 'Randy Arozarena', pos: 'LF', bats: 'R', hot: false, cold: false, std: { avg: '.251', obp: '.328', slg: '.428', ops: '.756', pa: 302 }, adv: { woba: '.328', wrc: 108, xba: '.244', xslg: '.418', hard: 39.8, barrel: 8.4, kpct: 22.1, bbpct: 8.8, chase: 27.8, whiff: 23.1 }, splits: { vslAvg: '.264', vslOps: '.788', vsrAvg: '.244', vsrOps: '.741', homeOps: '.771', awayOps: '.741' }, note: 'Postseason hero. Streaky but explosive.' },
  { name: 'Isaac Paredes', pos: '3B', bats: 'R', hot: false, cold: false, std: { avg: '.238', obp: '.324', slg: '.451', ops: '.775', pa: 294 }, adv: { woba: '.338', wrc: 116, xba: '.231', xslg: '.438', hard: 40.4, barrel: 9.1, kpct: 19.8, bbpct: 11.1, chase: 25.8, whiff: 20.4 }, splits: { vslAvg: '.221', vslOps: '.718', vsrAvg: '.248', vsrOps: '.804', homeOps: '.798', awayOps: '.751' }, note: 'Pull-heavy power bat. Underrated OBP skills.' },
  { name: 'Brandon Lowe', pos: '2B', bats: 'L', hot: false, cold: true, std: { avg: '.218', obp: '.291', slg: '.371', ops: '.662', pa: 268 }, adv: { woba: '.288', wrc: 84, xba: '.214', xslg: '.368', hard: 36.1, barrel: 6.1, kpct: 25.4, bbpct: 8.4, chase: 30.1, whiff: 25.8 }, splits: { vslAvg: '.194', vslOps: '.601', vsrAvg: '.228', vsrOps: '.694', homeOps: '.681', awayOps: '.644' }, note: 'Injury-plagued. Cold since return from IL.' },
]

const enrichedBos = enrich(bos)
const enrichedNyy = enrich(nyy)
const enrichedLad = enrich(lad)
const enrichedSf = enrich(sf)
const enrichedHou = enrich(hou)
const enrichedAtl = enrich(atl)
const enrichedTor = enrich(tor)
const enrichedBal = enrich(bal)
const enrichedTex = enrich(tex)
const enrichedTb = enrich(tb)

export const mlbBattingData: Record<string, { away: TeamBatting; home: TeamBatting }> = {
  '1': {
    away: { lineup: enrichedBos, props: propsFor(enrichedBos, 'consistently hits early in the count vs RHP') },
    home: { lineup: enrichedNyy, props: propsFor(enrichedNyy, 'elite pitch selection driving hot streak') },
  },
  '2': {
    away: { lineup: enrichedLad, props: propsFor(enrichedLad, 'crushing fastballs middle-in') },
    home: { lineup: enrichedSf, props: propsFor(enrichedSf, 'hitting to all fields recently') },
  },
  '3': {
    away: { lineup: enrichedHou, props: propsFor(enrichedHou, 'punishing mistakes over the plate') },
    home: { lineup: enrichedAtl, props: propsFor(enrichedAtl, 'seeing the ball extremely well') },
  },
  '4': {
    away: { lineup: enrichedTor, props: propsFor(enrichedTor, 'finding gaps against RHP') },
    home: { lineup: enrichedBal, props: propsFor(enrichedBal, 'driving the ball with authority') },
  },
  '5': {
    away: { lineup: enrichedTex, props: propsFor(enrichedTex, 'making consistent hard contact') },
    home: { lineup: enrichedTb, props: propsFor(enrichedTb, 'working deep counts effectively') },
  },
}
