'use client'

import { useState } from 'react'
import { HistorySection } from '@/components/breakdown/ballpark/HistorySection'
import { ImpactSection } from '@/components/breakdown/ballpark/ImpactSection'
import { StadiumSection } from '@/components/breakdown/ballpark/StadiumSection'
import { PillTabs } from '@/components/ui/PillTabs'
import type { BallparkData } from '@/data/breakdown/ballparkTypes'

const SECTIONS = ['🏟 Stadium', '📈 History', '🎯 Tonight']

export function BallparkContent({ bp }: { bp: BallparkData }) {
  const [section, setSection] = useState(SECTIONS[0])

  return (
    <div className="flex flex-col gap-3 px-3.5 pt-3 md:px-8 md:pt-5">
      <div className="rounded-2xl border border-border bg-card p-3.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[15px] font-black text-text">{bp.name}</div>
            <div className="mt-0.5 text-[10px] text-muted">
              {bp.location} · {bp.opened} · {bp.surface} · {bp.roof}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-black text-accent">{bp.capacity.toLocaleString()}</div>
            <div className="text-[9px] text-muted">Capacity</div>
          </div>
        </div>
      </div>

      <PillTabs options={SECTIONS} active={section} onChange={setSection} />

      {section === '🏟 Stadium' && <StadiumSection bp={bp} />}
      {section === '📈 History' && <HistorySection bp={bp} />}
      {section === '🎯 Tonight' && <ImpactSection bp={bp} />}
    </div>
  )
}
