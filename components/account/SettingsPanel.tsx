'use client'

import { PillTabs } from '@/components/ui/PillTabs'
import { useAccountData } from '@/lib/account/AccountDataContext'
import {
  BET_TYPE_PREFERENCES,
  EDGE_THRESHOLDS,
  ODDS_FORMATS,
  RISK_TOLERANCES,
  SPORTSBOOKS,
  type OddsFormat,
  type RiskTolerance,
} from '@/lib/account/types'
import { useAuth } from '@/lib/auth/AuthContext'

const RISK_LABEL: Record<(typeof RISK_TOLERANCES)[number], string> = {
  conservative: 'Conservative',
  moderate: 'Moderate',
  aggressive: 'Aggressive',
}

function SettingsBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-extrabold tracking-[0.1em] text-muted">{label}</div>
      <div className="rounded-2xl border border-border bg-card p-3.5">{children}</div>
    </div>
  )
}

function Toggle({ on, onClick }: { on: boolean; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-border2'} ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-[3px]'}`} />
    </div>
  )
}

export function SettingsPanel() {
  const { user } = useAuth()
  const { settings, loading, updateSettings } = useAccountData()

  if (!user) {
    return <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">Log in to save your settings.</div>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
        Loading your settings…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      <SettingsBlock label="SPORTSBOOK">
        <PillTabs options={[...SPORTSBOOKS]} active={settings.sportsbook} onChange={(v) => updateSettings({ sportsbook: v })} />
        <p className="mt-2 text-[10px] leading-relaxed text-muted">Shown as a reference tag on edge cards throughout the app.</p>
      </SettingsBlock>

      <SettingsBlock label="ODDS FORMAT">
        <div className="flex gap-2">
          {ODDS_FORMATS.map((fmt) => {
            const active = settings.oddsFormat === fmt
            return (
              <button
                key={fmt}
                onClick={() => updateSettings({ oddsFormat: fmt as OddsFormat })}
                className={`flex-1 rounded-xl border px-1 py-2 text-[11px] font-semibold ${active ? 'border-accent bg-accent text-white' : 'border-border text-text2'}`}
              >
                {fmt}
              </button>
            )
          })}
        </div>
      </SettingsBlock>

      <SettingsBlock label="EDGE ALERT THRESHOLD">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-text2">Only show edges with confidence above:</span>
          <span className="text-base font-extrabold text-accent">{settings.edgeThreshold}%</span>
        </div>
        <div className="flex gap-1.5">
          {EDGE_THRESHOLDS.map((t) => {
            const active = settings.edgeThreshold === t
            return (
              <button
                key={t}
                onClick={() => updateSettings({ edgeThreshold: t })}
                className={`flex-1 rounded-lg border px-1 py-1.5 text-[11px] font-semibold ${active ? 'border-accent bg-accent/15 text-accent' : 'border-border text-text2'}`}
              >
                {t}%
              </button>
            )
          })}
        </div>
      </SettingsBlock>

      <SettingsBlock label="NOTIFICATIONS">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-text">Edge Alerts</div>
            <div className="mt-0.5 text-[10px] text-muted">Notify when new edges are found</div>
          </div>
          <Toggle on={settings.notifications.edgeAlerts} onClick={() => updateSettings({ notifications: { ...settings.notifications, edgeAlerts: !settings.notifications.edgeAlerts } })} />
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <div>
            <div className="text-xs font-semibold text-text">Game Reminders</div>
            <div className="mt-0.5 text-[10px] text-muted">30 min before games you&apos;re tracking</div>
          </div>
          <Toggle on={settings.notifications.gameReminders} onClick={() => updateSettings({ notifications: { ...settings.notifications, gameReminders: !settings.notifications.gameReminders } })} />
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <div>
            <div className="text-xs font-semibold text-text">Result Updates</div>
            <div className="mt-0.5 text-[10px] text-muted">Notify when tracked bets are graded</div>
          </div>
          <Toggle on={settings.notifications.resultUpdates} onClick={() => updateSettings({ notifications: { ...settings.notifications, resultUpdates: !settings.notifications.resultUpdates } })} />
        </div>
      </SettingsBlock>

      <SettingsBlock label="BET TYPE PREFERENCES">
        <div className="flex flex-wrap gap-1.5">
          {BET_TYPE_PREFERENCES.map((t) => {
            const active = settings.betTypePreferences.includes(t)
            return (
              <button
                key={t}
                aria-pressed={active}
                onClick={() =>
                  updateSettings({
                    betTypePreferences: active ? settings.betTypePreferences.filter((x) => x !== t) : [...settings.betTypePreferences, t],
                  })
                }
                className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  active ? 'border-accent bg-accent text-white' : 'border-border bg-card text-text2 hover:border-border2'
                }`}
              >
                {t}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-muted">
          Pick as many as you like. Moneyline, Spread, Total and Player Props narrow your &quot;Best Bets for You&quot;; none selected shows everything.
        </p>
      </SettingsBlock>

      <SettingsBlock label="RISK TOLERANCE">
        <div className="flex gap-1.5">
          <button
            onClick={() => updateSettings({ riskTolerance: 'none' })}
            className={`flex-1 rounded-xl border px-1 py-1.5 text-[11px] font-semibold ${settings.riskTolerance === 'none' ? 'border-accent bg-accent text-white' : 'border-border text-text2'}`}
          >
            Any
          </button>
          {RISK_TOLERANCES.map((r) => (
            <button
              key={r}
              onClick={() => updateSettings({ riskTolerance: r as RiskTolerance })}
              className={`flex-1 rounded-xl border px-1 py-1.5 text-[11px] font-semibold ${settings.riskTolerance === r ? 'border-accent bg-accent text-white' : 'border-border text-text2'}`}
            >
              {RISK_LABEL[r]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-muted">
          Conservative shows Grade A edges only · Moderate shows A and B · Aggressive shows every grade.
        </p>
      </SettingsBlock>
    </div>
  )
}
