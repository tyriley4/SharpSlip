export function avgColor(avg: string) {
  const n = parseFloat(avg)
  return n >= 0.29 ? 'text-positive' : n <= 0.23 ? 'text-negative' : 'text-text2'
}

export function opsColor(ops: string) {
  const n = parseFloat(ops)
  return n >= 0.85 ? 'text-positive' : n <= 0.68 ? 'text-negative' : 'text-text2'
}

export function wrcColor(wrc: number) {
  return wrc >= 130 ? 'text-positive' : wrc <= 85 ? 'text-negative' : 'text-text2'
}

export function hardColor(pct: number) {
  return pct >= 45 ? 'text-positive' : pct <= 33 ? 'text-negative' : 'text-text2'
}

export function lowIsGoodColor(val: number, goodBelow: number, badAbove: number) {
  return val <= goodBelow ? 'text-positive' : val >= badAbove ? 'text-negative' : 'text-text2'
}

export function highIsGoodColor(val: number, goodAbove: number, badBelow: number) {
  return val >= goodAbove ? 'text-positive' : val <= badBelow ? 'text-negative' : 'text-text2'
}

export function pctToneClasses(pct: number) {
  if (pct >= 60) return { text: 'text-positive', border: 'border-positive/20', bg: 'bg-positive/[0.07]' }
  if (pct <= 40) return { text: 'text-negative', border: 'border-negative/20', bg: 'bg-negative/[0.07]' }
  return { text: 'text-text2', border: 'border-border', bg: 'bg-white/[0.03]' }
}
