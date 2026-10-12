'use client'

import { useState } from 'react'
import { BetTracker } from '@/components/account/BetTracker'
import { Favorites } from '@/components/account/Favorites'
import { SettingsPanel } from '@/components/account/SettingsPanel'

const TABS = [
  { id: 'Bet Tracker', icon: '📋' },
  { id: 'Favorites', icon: '⭐' },
  { id: 'Settings', icon: '⚙️' },
]

/** Same segmented control as the Leaders Game/Betting Stats toggle: accent-blue glow when active. */
export function AccountTabs() {
  const [tab, setTab] = useState('Bet Tracker')

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-card p-1" role="tablist" aria-label="Account sections">
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-3 text-[13px] font-extrabold transition-all duration-200 ${
                active ? 'bg-accent text-white shadow-[0_0_16px_rgba(59,158,255,0.45)]' : 'bg-card text-text2 hover:text-text'
              }`}
            >
              <span>{t.icon}</span> {t.id}
            </button>
          )
        })}
      </div>

      {tab === 'Bet Tracker' && <BetTracker />}
      {tab === 'Favorites' && <Favorites />}
      {tab === 'Settings' && <SettingsPanel />}
    </div>
  )
}
