import type { HTMLAttributes, ReactNode } from 'react'
import { sportMeta } from '@/lib/sport/meta'
import type { Sport } from '@/lib/sport/SportContext'

type DivProps = HTMLAttributes<HTMLDivElement>

/** Default card — the baseline surface used throughout the app. */
export function BaseCard({ className = '', style, ...props }: DivProps) {
  return (
    <div
      className={`rounded-[14px] border border-border bg-card p-4 shadow-[0_2px_8px_rgba(0,0,0,0.4)] ${className}`}
      style={style}
      {...props}
    />
  )
}

/** Grade A edge card — green gradient wash, left accent bar, soft glow. */
export function GradeACard({ className = '', style, ...props }: DivProps) {
  return (
    <div
      className={`rounded-[14px] border border-[#1A3028] border-l-[3px] border-l-grade-a p-4 shadow-[0_0_20px_rgba(0,229,160,0.08)] ${className}`}
      style={{ background: 'linear-gradient(135deg, #111318 0%, #0D1A14 100%)', ...style }}
      {...props}
    />
  )
}

/** Grade B edge card — teal gradient wash, left accent bar, soft glow. */
export function GradeBCard({ className = '', style, ...props }: DivProps) {
  return (
    <div
      className={`rounded-[14px] border border-[#1A2A35] border-l-[3px] border-l-grade-b p-4 shadow-[0_0_16px_rgba(0,180,216,0.06)] ${className}`}
      style={{ background: 'linear-gradient(135deg, #111318 0%, #0D1520 100%)', ...style }}
      {...props}
    />
  )
}

/** Grade C edge card — flat card with amber left accent bar, no glow. */
export function GradeCCard({ className = '', style, ...props }: DivProps) {
  return (
    <div
      className={`rounded-[14px] border border-[#2A2416] border-l-[3px] border-l-grade-c bg-card p-4 ${className}`}
      style={style}
      {...props}
    />
  )
}

/** Hot player/trend card — orange gradient wash + left accent bar. */
export function HotCard({ className = '', style, ...props }: DivProps) {
  return (
    <div
      className={`rounded-[14px] border border-[#2A1E16] border-l-[3px] border-l-hot p-4 shadow-[0_0_16px_rgba(255,107,53,0.06)] ${className}`}
      style={{ background: 'linear-gradient(135deg, #111318 0%, #1A1210 100%)', ...style }}
      {...props}
    />
  )
}

/** Cold player/trend card — blue gradient wash + left accent bar. */
export function ColdCard({ className = '', style, ...props }: DivProps) {
  return (
    <div
      className={`rounded-[14px] border border-[#1A2040] border-l-[3px] border-l-cold p-4 ${className}`}
      style={{ background: 'linear-gradient(135deg, #111318 0%, #0D1220 100%)', ...style }}
      {...props}
    />
  )
}

/** Live game card — flat card with a subtle red-tinted border and a pulsing LIVE badge slot. */
export function LiveCard({ className = '', children, ...props }: DivProps) {
  return (
    <div className={`rounded-[14px] border border-[#2A1A1A] bg-card p-4 ${className}`} {...props}>
      {children}
    </div>
  )
}

export function LiveBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`live-pulse rounded-lg bg-loss px-2.5 py-1 text-[10px] font-bold text-white ${className}`}>LIVE</span>
  )
}

/** Sport-colored card — left accent bar + very subtle background tint matching the sport's color. */
export function SportCard({
  sport,
  className = '',
  style,
  children,
  ...props
}: DivProps & { sport: Sport; children?: ReactNode }) {
  const meta = sportMeta(sport)
  return (
    <div
      className={`rounded-[14px] border border-border p-4 ${className}`}
      style={{
        borderLeft: `3px solid ${meta.color}`,
        background: `linear-gradient(135deg, #111318 0%, ${meta.color}0D 100%)`,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}
