export const EDGE_DISCLAIMER_TEXT =
  'Edges represent statistical trends and historical patterns. SharpSlip does not provide betting advice. All betting decisions are your own responsibility.'

export function EdgeDisclaimer({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-[10px] border border-border bg-card2 p-3 ${className}`}>
      <div className="mb-1 text-[9px] font-extrabold tracking-[0.1em] text-muted">DISCLAIMER</div>
      <p className="text-[10px] leading-relaxed text-muted">{EDGE_DISCLAIMER_TEXT}</p>
    </div>
  )
}
