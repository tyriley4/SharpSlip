import { createClient } from '@/lib/supabase/client'
import { profitFor } from './parlay'
import type { Bet, NewBetInput } from './types'

/**
 * Whether the optional `details` JSON column exists. Unknown until the first write; flips to false
 * if Postgres rejects it (migration 0006 not run yet), after which bets save without structure.
 */
let detailsColumn: boolean | null = null

export function betDetailsSupported(): boolean | null {
  return detailsColumn
}

function missingDetailsColumn(message: string): boolean {
  return /details/i.test(message) && /(column|schema cache)/i.test(message)
}

export async function fetchBets(userId: string): Promise<Bet[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('bets')
    .select('*')
    .eq('user_id', userId)
    .order('game_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[account/bets] fetchBets failed:', error.message)
    return []
  }
  const rows = (data ?? []) as Bet[]
  if (rows.length > 0 && detailsColumn === null) detailsColumn = 'details' in rows[0]
  return rows
}

export async function createBet(userId: string, input: NewBetInput): Promise<Bet | null> {
  const supabase = createClient()
  const profit = profitFor(input.bet_type, input.result, input.odds, input.stake, input.details)
  const { details, ...base } = input

  const attempt = async (withDetails: boolean) =>
    supabase
      .from('bets')
      .insert({ user_id: userId, ...base, ...(withDetails && details ? { details } : {}), profit })
      .select()
      .single()

  let { data, error } = await attempt(detailsColumn !== false)
  if (error && missingDetailsColumn(error.message)) {
    detailsColumn = false
    ;({ data, error } = await attempt(false))
  } else if (!error && details) {
    detailsColumn = true
  }

  if (error) {
    console.error('[account/bets] createBet failed:', error.message)
    return null
  }
  return data as Bet
}

export type BetEditInput = NewBetInput

export async function updateBet(id: string, patch: BetEditInput): Promise<Bet | null> {
  const supabase = createClient()
  const profit = profitFor(patch.bet_type, patch.result, patch.odds, patch.stake, patch.details)
  const { details, ...base } = patch

  const attempt = async (withDetails: boolean) =>
    supabase
      .from('bets')
      .update({ ...base, ...(withDetails && details ? { details } : {}), profit })
      .eq('id', id)
      .select()
      .single()

  let { data, error } = await attempt(detailsColumn !== false)
  if (error && missingDetailsColumn(error.message)) {
    detailsColumn = false
    ;({ data, error } = await attempt(false))
  } else if (!error && details) {
    detailsColumn = true
  }

  if (error) {
    console.error('[account/bets] updateBet failed:', error.message)
    return null
  }
  return data as Bet
}

export async function deleteBet(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('bets').delete().eq('id', id)
  if (error) {
    console.error('[account/bets] deleteBet failed:', error.message)
    return false
  }
  return true
}
