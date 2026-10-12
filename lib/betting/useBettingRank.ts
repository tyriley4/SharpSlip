'use client'

import { useMemo, useState } from 'react'
import { DEFAULT_SAMPLE_MIN, rankBetting, type BettingSort, type RankableRow, type SampleMin } from './rank'

/** Sort + minimum-sample state for a Betting Stats board, applied to the rows the API returned. */
export function useBettingRank<T extends RankableRow>(rows: T[]) {
  const [sort, setSort] = useState<BettingSort>('Hit Rate')
  const [minGames, setMinGames] = useState<SampleMin>(DEFAULT_SAMPLE_MIN)
  const ranked = useMemo(() => rankBetting(rows, sort, minGames), [rows, sort, minGames])
  return { sort, setSort, minGames, setMinGames, ...ranked }
}
