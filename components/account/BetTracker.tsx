'use client'

import { useState } from 'react'
import { BetForm } from '@/components/account/BetForm'
import { BetEntryForm } from '@/components/account/tracker/BetEntryForm'
import { BetHistory } from '@/components/account/tracker/BetHistory'
import { StatsGrid } from '@/components/account/tracker/StatsGrid'
import { betDetailsSupported } from '@/lib/account/bets'
import { useAccountData } from '@/lib/account/AccountDataContext'
import { useBets } from '@/lib/account/BetsContext'
import type { Bet } from '@/lib/account/types'
import { useAuth } from '@/lib/auth/AuthContext'

export function BetTracker() {
  const { user } = useAuth()
  const { settings } = useAccountData()
  const { bets, loading, upsert, remove } = useBets()
  const [formOpen, setFormOpen] = useState(false)
  const [editingBet, setEditingBet] = useState<Bet | undefined>(undefined)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function closeForm() {
    setFormOpen(false)
    setEditingBet(undefined)
  }

  if (!user) {
    return <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">Log in to track your bets.</div>
  }

  const pendingCount = bets.filter((b) => b.result === 'pending').length

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => {
          setEditingBet(undefined)
          setFormOpen(true)
        }}
        className="w-full rounded-xl bg-accent py-3.5 text-[14px] font-extrabold text-white shadow-[0_0_18px_rgba(59,158,255,0.4)] transition-transform active:scale-[0.99]"
      >
        + Log a Bet
      </button>

      <StatsGrid bets={bets} />

      {betDetailsSupported() === false && (
        <div className="rounded-xl border border-warning/25 bg-warning/[0.07] p-3 text-[11px] leading-relaxed text-text2">
          Your database doesn&apos;t have the <code className="text-warning">details</code> column yet, so parlay legs can&apos;t be expanded after saving. Run{' '}
          <code className="text-warning">supabase/migrations/0006_bet_details.sql</code> in the Supabase SQL editor to turn that on.
        </div>
      )}

      <div className="rounded-xl border border-warning/15 bg-warning/[0.06] p-2.5 text-center text-[10px] leading-relaxed text-text2">
        Track responsibly. If betting is affecting your daily life, contact{' '}
        <a href="tel:18005224700" className="font-semibold text-warning">
          1-800-522-4700
        </a>
        .
      </div>

      <div className="flex items-center justify-between">
        <h2 className="section-header text-sm text-text md:text-base">Bet History</h2>
        {pendingCount > 0 && <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[10px] font-extrabold text-accent">{pendingCount} pending</span>}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-xs text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-accent" />
          Loading your bets…
        </div>
      ) : bets.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-10 text-center text-xs text-muted">No bets logged yet — tap &quot;+ Log a Bet&quot; to track your first pick.</div>
      ) : (
        <BetHistory
          bets={bets}
          oddsFormat={settings.oddsFormat}
          onEdit={(b) => {
            setEditingBet(b)
            setFormOpen(true)
          }}
          onDelete={setDeletingId}
        />
      )}

      {formOpen &&
        // Bets saved before structured tracking have no legs to edit, so they open in the simple form.
        (editingBet && !editingBet.details?.legs?.length ? (
          <BetForm
            bet={editingBet}
            onClose={closeForm}
            onSaved={(b) => {
              upsert(b)
              closeForm()
            }}
          />
        ) : (
          <BetEntryForm
            bet={editingBet}
            onClose={closeForm}
            onSaved={(b) => {
              upsert(b)
              closeForm()
            }}
          />
        ))}

      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDeletingId(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 text-sm font-bold text-text">Delete this bet?</div>
            <p className="mb-4 text-xs text-muted">This can&apos;t be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeletingId(null)} className="flex-1 rounded-lg border border-border py-2 text-xs font-semibold text-text2">
                Cancel
              </button>
              <button
                onClick={async () => {
                  await remove(deletingId)
                  setDeletingId(null)
                }}
                className="flex-1 rounded-lg bg-negative py-2 text-xs font-bold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
