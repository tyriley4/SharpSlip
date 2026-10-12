export function StatBox({ label, val, good }: { label: string; val: string; good: boolean }) {
  return (
    <div
      className={`rounded-[10px] border p-2 text-center ${
        good ? 'border-positive/20 bg-positive/[0.08]' : 'border-negative/20 bg-negative/[0.08]'
      }`}
    >
      <div className="mb-1 text-[9px] text-muted">{label}</div>
      <div className={`text-lg font-black ${good ? 'text-positive' : 'text-negative'}`}>{val}</div>
    </div>
  )
}

export function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-1 flex items-center justify-between">
      <span className="text-[9px] text-muted">{label}</span>
      <span className="text-[10px] font-bold text-text2">{value}</span>
    </div>
  )
}
