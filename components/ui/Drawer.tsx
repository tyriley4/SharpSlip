'use client'

export function Drawer({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-stretch md:justify-end" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl border border-border bg-card p-4 md:h-screen md:max-h-none md:w-[420px] md:rounded-none md:rounded-l-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold text-text">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[11px] text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="shrink-0 text-lg text-muted hover:text-text" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="mt-3 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
