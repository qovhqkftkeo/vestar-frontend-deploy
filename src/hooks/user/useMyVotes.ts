import { useCallback, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { fetchCandidateManifest } from '../../api/candidateManifest'
import { fetchMoreVoteHistory, fetchVoteHistory } from '../../api/elections'
import type {
  ApiElectionState,
  ApiVoteHistoryCursor,
  ApiVoteHistoryItem,
} from '../../api/types'
import { useLanguage } from '../../providers/LanguageProvider'
import type { MyVoteItem } from '../../types/user'
import {
  getCandidateManifestSeriesPreimage,
  getCandidateManifestTitle,
} from '../../utils/candidateManifest'

export interface UseMyVotesResult {
  votes: MyVoteItem[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  loadMore: () => void
}

function formatDate(dateValue: string): string {
  const date = new Date(dateValue)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${year}.${month}.${day}`
}

function mapBadge(state: ApiElectionState): MyVoteItem['badge'] {
  switch (state) {
    case 'ACTIVE':
      return 'live'
    case 'FINALIZED':
    case 'CLOSED':
    case 'KEY_REVEAL_PENDING':
    case 'KEY_REVEALED':
    case 'CANCELLED':
      return 'end'
    case 'SCHEDULED':
      return 'new'
    default:
      return 'hot'
  }
}

function mapChoiceLabel(item: ApiVoteHistoryItem, lang: 'en' | 'ko'): string {
  if (item.selection.isPending) {
    return lang === 'ko' ? '집계 대기 중' : 'Awaiting tally'
  }

  if (item.selection.isValid === false) {
    return lang === 'ko' ? '무효 처리됨' : 'Marked invalid'
  }

  if (item.selection.candidateKeys.length === 0) {
    return lang === 'ko' ? '선택 정보 없음' : 'No selection info'
  }

  return item.selection.candidateKeys.join(', ')
}

async function mapToMyVoteItem(
  item: ApiVoteHistoryItem,
  lang: 'en' | 'ko',
): Promise<MyVoteItem> {
  const manifest = await fetchCandidateManifest(
    item.onchainElection?.candidateManifestUri,
    item.onchainElection?.candidateManifestHash,
  )

  return {
    id: item.id,
    voteId: item.onchainElection?.id ?? item.id,
    title: getCandidateManifestTitle(manifest) || 'Untitled vote',
    org: getCandidateManifestSeriesPreimage(manifest) || 'Unknown series',
    date: formatDate(item.blockTimestamp),
    karmaEarned: 0,
    choice: mapChoiceLabel(item, lang),
    invalidReason:
      item.selection.isValid === false
        ? item.selection.invalidReason?.reasonDetail ||
          item.selection.invalidReason?.reasonCode ||
          null
        : null,
    selectedCandidateKeys: item.selection.candidateKeys,
    badge: mapBadge(item.onchainElection?.onchainState ?? 'FINALIZED'),
  }
}

export function useMyVotes(): UseMyVotesResult {
  const { address, isConnected } = useAccount()
  const { lang } = useLanguage()
  const [votes, setVotes] = useState<MyVoteItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<ApiVoteHistoryCursor | null>(null)

  useEffect(() => {
    if (!isConnected || !address) {
      setVotes([])
      setIsLoading(false)
      setIsLoadingMore(false)
      setHasMore(false)
      setNextCursor(null)
      return
    }

    let cancelled = false
    setIsLoading(true)

    fetchVoteHistory(address)
      .then(async (history) => {
        if (cancelled) return
        const mapped = await Promise.all(history.items.map((item) => mapToMyVoteItem(item, lang)))
        if (cancelled) return
        setVotes(mapped)
        setHasMore(history.hasMore)
        setNextCursor(history.nextCursor)
      })
      .catch(() => {
        if (cancelled) return
        setVotes([])
        setHasMore(false)
        setNextCursor(null)
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [address, isConnected, lang])

  const loadMore = useCallback(() => {
    if (!address || !isConnected || !nextCursor || !hasMore || isLoadingMore) {
      return
    }

    setIsLoadingMore(true)

    fetchMoreVoteHistory(address, nextCursor)
      .then(async (history) => {
        const mapped = await Promise.all(history.items.map((item) => mapToMyVoteItem(item, lang)))
        setVotes((current) => [...current, ...mapped])
        setHasMore(history.hasMore)
        setNextCursor(history.nextCursor)
      })
      .catch(() => {
        setHasMore(false)
      })
      .finally(() => {
        setIsLoadingMore(false)
      })
  }, [address, hasMore, isConnected, isLoadingMore, lang, nextCursor])

  return { votes, isLoading, isLoadingMore, hasMore, loadMore }
}
