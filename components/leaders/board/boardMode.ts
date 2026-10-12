'use client'

import { useCallback, useSyncExternalStore } from 'react'

export type BoardMode = 'board' | 'chart'

// Shared across every leaders board so the choice survives sport/tab switches and loading states that remount the board.
let current: BoardMode = 'board'
const listeners = new Set<() => void>()

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function useBoardMode(): [BoardMode, (m: BoardMode) => void] {
  const mode = useSyncExternalStore(
    subscribe,
    () => current,
    () => 'board' as BoardMode
  )
  const set = useCallback((m: BoardMode) => {
    current = m
    listeners.forEach((l) => l())
  }, [])
  return [mode, set]
}
