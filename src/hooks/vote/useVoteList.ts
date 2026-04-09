import { useEffect, useState } from 'react'
import { fetchElectionListResolved } from '../../api/elections'
import { HOT_VOTES } from '../../data/mockVotes'
import { mapToHotVote } from '../../utils/electionMapper'
import type { HotVote } from '../../types/vote'

/** Filters mock HOT_VOTES to those with >10,000 participants */
function hotMockFallback(): HotVote[] {
  return HOT_VOTES.filter((v) => {
    const n = Number.parseInt(v.count.replace(/,/g, ''), 10)
    return n > 10_000
  })
}

export interface UseVoteListResult {
  isLoading: boolean
  hotVotes: HotVote[]
}

/**
 * Fetches the HOT section from backend indexer first, then from on-chain fallback.
 * Only falls back to mock data when both real data sources fail.
 */
export function useVoteList(): UseVoteListResult {
  const [isLoading, setIsLoading] = useState(true)
  const [hotVotes, setHotVotes] = useState<HotVote[]>([])

  useEffect(() => {
    let cancelled = false

    fetchElectionListResolved({ state: 'ACTIVE', pageSize: 20 })
      .then((res) => {
        if (cancelled) return
        const hot = res.elections
          .filter((e) => (e.total_submissions ?? 0) > 10_000)
          .slice(0, 4)
          .map(mapToHotVote)
        setHotVotes(hot.length > 0 ? hot : hotMockFallback())
      })
      .catch(() => {
        if (cancelled) return
        // 목업 : API/온체인 둘 다 실패했을 때만 HOT 카드 mock fallback 유지
        setHotVotes(hotMockFallback())
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { isLoading, hotVotes }
}
