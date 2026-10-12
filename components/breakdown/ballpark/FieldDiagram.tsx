import type { FieldDimension } from '@/data/breakdown/ballparkTypes'

export function FieldDiagram({ dimensions }: { dimensions: FieldDimension[] }) {
  return (
    <svg viewBox="0 0 300 170" className="h-[170px] w-full">
      <path
        d="M 150 165 Q 20 165 25 60 Q 28 25 150 15 Q 272 25 275 60 Q 280 165 150 165 Z"
        fill="rgba(52,211,153,.06)"
        stroke="#253550"
        strokeWidth="1.5"
      />
      <path d="M 150 165 L 110 125 L 150 85 L 190 125 Z" fill="rgba(255,255,255,.04)" stroke="#253550" strokeWidth="1" />
      <line x1="150" y1="165" x2="25" y2="60" stroke="#253550" strokeWidth="1" strokeDasharray="3,3" />
      <line x1="150" y1="165" x2="275" y2="60" stroke="#253550" strokeWidth="1" strokeDasharray="3,3" />
      <line x1="150" y1="165" x2="150" y2="15" stroke="#253550" strokeWidth="1" strokeDasharray="2,4" opacity="0.5" />
      <circle cx="150" cy="165" r="3" fill="#4d9fff" />
      {dimensions.map((d) => (
        <g key={d.label}>
          <text x={d.x} y={d.y} fontSize="10" fontWeight="800" fill={d.short ? '#fbbf24' : '#8ba4c2'} textAnchor="middle">
            {d.label}
          </text>
          <text x={d.x} y={d.y + 12} fontSize="9" fill={d.short ? '#fbbf24' : '#7dd4fc'} textAnchor="middle">
            {d.dist}
          </text>
        </g>
      ))}
    </svg>
  )
}
