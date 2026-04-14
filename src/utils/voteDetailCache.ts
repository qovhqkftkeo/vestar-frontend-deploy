import type { ApiElection } from '../api/types'
import type { VoteDetailData } from '../types/vote'
import type { CandidateManifest } from './candidateManifest'
import { mapToVoteDetail, resolveDisplayedParticipantCount } from './electionMapper'
import { getViewCache, setViewCache } from './viewCache'

export type VoteDetailCacheValue = {
  participantCount: number
  vote: VoteDetailData
}

export const VOTE_DETAIL_CACHE_TTL_MS = 15_000

function getVoteDetailCacheKey(id: string) {
  return `vote-detail:${id}`
}

export function getCachedVoteDetail(id: string) {
  return getViewCache<VoteDetailCacheValue>(getVoteDetailCacheKey(id), VOTE_DETAIL_CACHE_TTL_MS)
}

function mergeCandidateVotes<T extends { id: string; votes?: number }>(
  nextCandidates: T[],
  previousCandidates: T[],
) {
  const previousById = new Map(previousCandidates.map((candidate) => [candidate.id, candidate]))

  return nextCandidates.map((candidate) => {
    const previous = previousById.get(candidate.id)

    if (typeof previous?.votes !== 'number') {
      return candidate
    }

    if (typeof candidate.votes !== 'number') {
      return {
        ...candidate,
        votes: previous.votes,
      }
    }

    return {
      ...candidate,
      votes: Math.max(candidate.votes, previous.votes),
    }
  })
}

function buildCandidateVoteMap(vote: VoteDetailData) {
  const candidateVotes = new Map<string, bigint>()
  const assignVotes = (candidate: { id: string; votes?: number }) => {
    if (typeof candidate.votes !== 'number') {
      return
    }

    const currentValue = candidateVotes.get(candidate.id)
    const nextValue = BigInt(candidate.votes)
    candidateVotes.set(
      candidate.id,
      currentValue !== undefined && currentValue > nextValue ? currentValue : nextValue,
    )
  }

  vote.candidates.forEach(assignVotes)
  vote.sections?.forEach((section) => {
    section.candidates.forEach(assignVotes)
  })

  return candidateVotes
}

function mergeVoteDetailValue(
  previousValue: VoteDetailCacheValue | null,
  nextValue: VoteDetailCacheValue,
): VoteDetailCacheValue {
  if (!previousValue) {
    return nextValue
  }

  const previousVote = previousValue.vote
  const nextVote = nextValue.vote
  const previousSectionsById = new Map(
    (previousVote.sections ?? []).map((section) => [section.id, section]),
  )

  const mergedVote: VoteDetailData = {
    ...nextVote,
    candidates: mergeCandidateVotes(nextVote.candidates, previousVote.candidates),
    sections: nextVote.sections?.map((section) => ({
      ...section,
      candidates: mergeCandidateVotes(
        section.candidates,
        previousSectionsById.get(section.id)?.candidates ?? [],
      ),
    })),
  }

  const participantCount = resolveDisplayedParticipantCount({
    backendParticipantCount: nextValue.participantCount,
    candidateVotes: buildCandidateVoteMap(mergedVote),
    fallbackParticipantCount: previousValue.participantCount,
  })

  return {
    participantCount,
    vote: {
      ...mergedVote,
      participantCount,
    },
  }
}

export function setCachedVoteDetail(id: string, value: VoteDetailCacheValue) {
  const cacheKey = getVoteDetailCacheKey(id)
  const currentValue = getViewCache<VoteDetailCacheValue>(cacheKey, VOTE_DETAIL_CACHE_TTL_MS)
  setViewCache(cacheKey, mergeVoteDetailValue(currentValue, value))
}

export function primeVoteDetailCacheFromElection(
  election: ApiElection,
  manifest?: CandidateManifest | null,
) {
  const vote = mapToVoteDetail(election, undefined, undefined, undefined, manifest)
  const value: VoteDetailCacheValue = {
    vote,
    participantCount: vote.participantCount,
  }

  setCachedVoteDetail(election.id, value)
  return value
}
