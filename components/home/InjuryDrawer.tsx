import type { Injury, InjuryStatus } from '@/lib/home/injuries'
import { PlayerLink } from '@/components/players/PlayerLink'
import { TeamLink } from '@/components/teams/TeamLink'
import { Drawer } from '@/components/ui/Drawer'
import { sportMeta } from '@/lib/sport/meta'

const STATUS_STYLE: Record<InjuryStatus, { label: string; bg: string; text: string }> = {
  out: { label: 'OUT', bg: 'bg-loss/15', text: 'text-loss' },
  doubtful: { label: 'DOUBTFUL', bg: 'bg-orange-500/15', text: 'text-orange-400' },
  questionable: { label: 'QUESTIONABLE', bg: 'bg-yellow-400/15', text: 'text-yellow-300' },
  gtd: { label: 'GTD', bg: 'bg-warning/15', text: 'text-warning' },
  probable: { label: 'PROBABLE', bg: 'bg-win/15', text: 'text-win' },
  ir: { label: 'IR', bg: 'bg-loss/15', text: 'text-loss' },
}

function InjuryRow({ injury }: { injury: Injury }) {
  const meta = sportMeta(injury.sport)
  const status = STATUS_STYLE[injury.status]
  return (
    <div className="rounded-[14px] border border-border bg-card p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: `${meta.color}22`, color: meta.color }}>
            {meta.icon} {meta.label}
          </span>
          <span className="text-[10px] font-semibold text-muted">{injury.position}</span>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${status.bg} ${status.text}`}>{status.label}</span>
      </div>
      <div className="mb-1 text-[13px] font-bold text-text">
        <PlayerLink name={injury.player} team={injury.team} className="hover:text-accent hover:underline">
          {injury.player}
        </PlayerLink>{' '}
        <span className="font-semibold text-muted">
          ·{' '}
          <TeamLink sport={injury.sport} abbr={injury.team} className="hover:text-accent hover:underline">
            {injury.team}
          </TeamLink>
        </span>
      </div>
      <div className="mb-1.5 text-[11px] text-text2">
        {injury.injury}
        {injury.returnDate ? <span className="text-muted"> · est. return {injury.returnDate}</span> : null}
      </div>
      <p className="text-[10px] leading-relaxed text-muted">{injury.comment ?? injury.impact}</p>
    </div>
  )
}

export function InjuryDrawer({ injuries, onClose }: { injuries: Injury[]; onClose: () => void }) {
  return (
    <Drawer title="Injury Report" subtitle="Live designations from ESPN" onClose={onClose}>
      {injuries.length === 0 ? (
        <div className="rounded-[14px] border border-border bg-card3 py-10 text-center text-xs text-muted">No notable injury designations right now.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {injuries.map((i) => (
            <InjuryRow key={`${i.sport}-${i.team}-${i.player}`} injury={i} />
          ))}
        </div>
      )}
    </Drawer>
  )
}
