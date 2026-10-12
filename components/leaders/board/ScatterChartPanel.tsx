'use client'

import { Cell, CartesianGrid, Label, LabelList, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'

export interface ScatterPoint {
  name: string
  label: string
  team: string
  x: number
  y: number
  color: string
}

/** Every piece of text in the plot uses this so nothing falls back to recharts' default dark fill. */
const TEXT = '#F0F2F5'
const TEXT_SOFT = '#C4C8D0'

function PointTooltip({ active, payload, xLabel, yLabel }: { active?: boolean; payload?: { payload: ScatterPoint }[]; xLabel: string; yLabel: string }) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0].payload
  return (
    <div className="rounded-xl border border-border2 bg-card3 px-3 py-2 text-[11px] shadow-[0_4px_16px_rgba(0,0,0,0.5)]" style={{ color: TEXT }}>
      <div className="font-extrabold" style={{ color: TEXT }}>
        {p.name}
      </div>
      <div className="mb-1 text-[10px] font-bold" style={{ color: p.color }}>
        {p.team}
      </div>
      <div style={{ color: TEXT_SOFT }}>
        {xLabel}: <span className="stat-number" style={{ color: TEXT }}>{p.x}</span>
      </div>
      <div style={{ color: TEXT_SOFT }}>
        {yLabel}: <span className="stat-number" style={{ color: TEXT }}>{p.y}</span>
      </div>
    </div>
  )
}

export interface Quadrants {
  tr: string
  tl: string
  br: string
  bl: string
}

function QuadrantLabels({ q }: { q: Quadrants }) {
  // Offsets match the chart margins so each label sits in its corner of the plot area.
  const base = 'pointer-events-none absolute max-w-[38%] text-[10px] font-extrabold leading-tight sm:text-[11px]'
  return (
    <>
      <div className={`${base} right-[40px] top-[28px] text-right`} style={{ color: '#00E5A0' }}>
        {q.tr}
      </div>
      <div className={`${base} left-[66px] top-[28px]`} style={{ color: '#FFB800' }}>
        {q.tl}
      </div>
      <div className={`${base} bottom-[62px] right-[40px] text-right`} style={{ color: '#EF4444' }}>
        {q.br}
      </div>
      <div className={`${base} bottom-[62px] left-[66px]`} style={{ color: '#C4C8D0' }}>
        {q.bl}
      </div>
    </>
  )
}

export function ScatterChartPanel({ points, xLabel, yLabel, quadrants }: { points: ScatterPoint[]; xLabel: string; yLabel: string; quadrants?: Quadrants }) {
  const avgX = points.reduce((s, p) => s + p.x, 0) / points.length
  const avgY = points.reduce((s, p) => s + p.y, 0) / points.length
  const showLabels = points.length <= 18
  const tick = { fill: TEXT, fontSize: 11 }

  return (
    <div className="relative h-full w-full">
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 22, right: 34, bottom: 34, left: 6 }}>
        <CartesianGrid stroke="#1F2229" strokeDasharray="3 3" />
        <XAxis type="number" dataKey="x" name={xLabel} stroke="#3A3E48" tick={tick} tickLine={{ stroke: '#3A3E48' }} domain={['auto', 'auto']}>
          <Label value={xLabel} position="bottom" offset={12} fill={TEXT} fontSize={12} fontWeight={700} />
        </XAxis>
        <YAxis type="number" dataKey="y" name={yLabel} stroke="#3A3E48" tick={tick} tickLine={{ stroke: '#3A3E48' }} domain={['auto', 'auto']} width={52}>
          <Label value={yLabel} angle={-90} position="insideLeft" offset={4} fill={TEXT} fontSize={12} fontWeight={700} style={{ textAnchor: 'middle' }} />
        </YAxis>
        <ZAxis range={[90, 90]} />
        <Tooltip cursor={{ strokeDasharray: '3 3', stroke: '#3A3E48' }} content={<PointTooltip xLabel={xLabel} yLabel={yLabel} />} />
        {/* The two average lines split the plot into quadrants; their labels name what each side means. */}
        <ReferenceLine x={avgX} stroke="#3B9EFF" strokeDasharray="4 4" strokeOpacity={0.6}>
          <Label value={`Avg ${xLabel}`} position="top" fill={TEXT} fontSize={10} fontWeight={700} />
        </ReferenceLine>
        <ReferenceLine y={avgY} stroke="#3B9EFF" strokeDasharray="4 4" strokeOpacity={0.6}>
          <Label value={`Avg ${yLabel}`} position="insideTopRight" fill={TEXT} fontSize={10} fontWeight={700} />
        </ReferenceLine>
        <Scatter data={points} isAnimationActive={false}>
          {points.map((p) => (
            <Cell key={`${p.name}-${p.team}`} fill={p.color} fillOpacity={0.9} stroke="#F0F2F5" strokeOpacity={0.35} />
          ))}
          {showLabels && <LabelList dataKey="label" position="top" fill={TEXT} fontSize={10} fontWeight={600} />}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
    {quadrants && <QuadrantLabels q={quadrants} />}
    </div>
  )
}
