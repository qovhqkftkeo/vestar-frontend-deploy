import type { ApiElection } from '../api/types'
import type { HotVote, VoteListItem } from '../types/vote'
import { formatCount } from './electionMapper'
import { getCachedVoteDetail } from './voteDetailCache'
import { updateViewCache } from './viewCache'

const VOTE_COLLECTION_CACHE_TTL_MS = 15_000
const VOTE_HOT_CACHE_KEY = 'vote-hot'
const VOTE_LIST_CACHE_KEYS = [
  'vote-list:all',
  'vote-list:live',
  'vote-list:hot',
  'vote-list:new',
  'vote-list:popular',
] as const

function parseCountLabel(value: string): number {
  const normalized = value.replace(/,/g, '').trim().toUpperCase()

  if (!normalized) return 0
  if (normalized.endsWith('M')) {
    return Math.round(Number.parseFloat(normalized) * 1_000_000)
  }
  if (normalized.endsWith('K')) {
    return Math.round(Number.parseFloat(normalized) * 1_000)
  }

  return Number.parseInt(normalized, 10) || 0
}

function resolveOptimisticParticipantCount(electionId: string, fallbackCount: number) {
  const cached = getCachedVoteDetail(electionId)
  return cached ? Math.max(fallbackCount, cached.participantCount) : fallbackCount
}

function withCountLabel<T extends { id: string; count: string }>(item: T): T {
  const nextCount = resolveOptimisticParticipantCount(item.id, parseCountLabel(item.count))

  if (nextCount === parseCountLabel(item.count)) {
    return item
  }

  return {
    ...item,
    count: formatCount(nextCount),
  }
}

export function applyOptimisticParticipantCountToElection(election: ApiElection): ApiElection {
  const backendCount = election.resultSummary?.totalSubmissions ?? 0
  const nextCount = resolveOptimisticParticipantCount(election.id, backendCount)

  if (nextCount === backendCount) {
    return election
  }

  return {
    ...election,
    resultSummary: {
      id: election.resultSummary?.id ?? `optimistic-summary:${election.id}`,
      electionRefId: election.resultSummary?.electionRefId ?? election.id,
      totalSubmissions: nextCount,
      totalDecryptedBallots: election.resultSummary?.totalDecryptedBallots ?? 0,
      totalValidVotes: election.resultSummary?.totalValidVotes ?? 0,
      totalInvalidVotes: election.resultSummary?.totalInvalidVotes ?? 0,
      createdAt: election.resultSummary?.createdAt ?? new Date().toISOString(),
      updatedAt: election.resultSummary?.updatedAt ?? new Date().toISOString(),
    },
  }
}

export function applyOptimisticParticipantCountToVoteListItem(item: VoteListItem): VoteListItem {
  return withCountLabel(item)
}

export function applyOptimisticParticipantCountsToVoteListItems(items: VoteListItem[]) {
  return items.map((item) => applyOptimisticParticipantCountToVoteListItem(item))
}

export function applyOptimisticParticipantCountToHotVote(vote: HotVote): HotVote {
  return withCountLabel(vote)
}

export function applyOptimisticParticipantCountsToHotVotes(votes: HotVote[]) {
  return votes.map((vote) => applyOptimisticParticipantCountToHotVote(vote))
}

export function updateCachedVoteCollectionCounts(voteId: string, participantCount: number) {
  updateViewCache<HotVote[]>(VOTE_HOT_CACHE_KEY, VOTE_COLLECTION_CACHE_TTL_MS, (votes) =>
    votes.map((vote) =>
      vote.id === voteId
        ? {
            ...vote,
            count: formatCount(Math.max(parseCountLabel(vote.count), participantCount)),
          }
        : vote,
    ),
  )

  for (const cacheKey of VOTE_LIST_CACHE_KEYS) {
    updateViewCache<VoteListItem[]>(cacheKey, VOTE_COLLECTION_CACHE_TTL_MS, (items) =>
      items.map((item) =>
        item.id === voteId
          ? {
              ...item,
              count: formatCount(Math.max(parseCountLabel(item.count), participantCount)),
            }
          : item,
      ),
    )
  }
}
