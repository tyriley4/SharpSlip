'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** Horizontal pill row with soft fades on the edges that still have content to scroll to. */
export function ScrollPills({
  options,
  active,
  onChange,
  size = 'md',
  activeColor = '#3B9EFF',
  activeText = '#FFFFFF',
}: {
  options: string[]
  active: string
  onChange: (value: string) => void
  size?: 'md' | 'sm' | 'lg'
  activeColor?: string
  activeText?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [fade, setFade] = useState({ left: false, right: false })

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    setFade({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }, [])

  useEffect(() => {
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [update, options.length])

  const pad = size === 'lg' ? 'px-5 py-2.5 text-[13px]' : size === 'md' ? 'px-4 py-2 text-[12px]' : 'px-3 py-1.5 text-[11px]'

  return (
    <div className="relative">
      <div ref={ref} onScroll={update} className="flex gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {options.map((o) => {
          const isActive = active === o
          return (
            <button
              key={o}
              onClick={() => onChange(o)}
              className={`shrink-0 whitespace-nowrap rounded-full border font-semibold transition-all duration-200 ${pad} ${
                isActive ? 'font-extrabold' : 'border-border bg-card text-text2 hover:border-border2 hover:text-text'
              }`}
              style={
                isActive
                  ? { background: activeColor, color: activeText, borderColor: activeColor, boxShadow: size === 'lg' ? `0 0 20px ${activeColor}88, 0 0 6px ${activeColor}66` : `0 0 ${size === 'md' ? 10 : 12}px ${activeColor}55` }
                  : undefined
              }
            >
              {o}
            </button>
          )
        })}
      </div>
      <div
        className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-bg to-transparent transition-opacity ${fade.left ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-bg to-transparent transition-opacity ${fade.right ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  )
}
