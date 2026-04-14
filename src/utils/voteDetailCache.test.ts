import { beforeEach, describe, expect, it } from 'vitest'
import type { VoteDetailData } from '../types/vote'
import { invalidateViewCache } from './viewCache'
import { getCachedVoteDetail, setCachedVoteDetail } from './voteDetailCache'

const baseVote: VoteDetailData = {
  id: 'vote-1',
  onchainElectionId: '1',
  onchainState: 'ACTIVE',
  title: 'Best Vocal',
  org: 'Golden Stage',
  host: 'VESTAr',
  verified: true,
  emoji: '',
  badge: 'live',
  deadlineLabel: '1h left',
  urgent: false,
  startDate: '2026.04.14 10:00',
  endDate: '2026.04.14 18:00',
  endDateISO: '2026-04-14T18:00:00.000Z',
  resultReveal: '2026.04.14 18:10',
  minKarmaTier: 0,
  maxChoices: 1,
  participantCount: 7,
  goalVotes: 0,
  voteFrequency: '1 vote total',
  voteLimit: '1 vote per ballot',
  resultPublic: true,
  candidates: [
    { id: 'candidate-a', name: 'A', group: '', emoji: '', emojiColor: '#fff', votes: 3 },
    { id: 'candidate-b', name: 'B', group: '', emoji: '', emojiColor: '#fff', votes: 4 },
  ],
}

describe('voteDetailCache', () => {
  beforeEach(() => {
    invalidateViewCache()
  })

  it('does not downgrade optimistic participant count or candidate tallies', () => {
    setCachedVoteDetail(baseVote.id, {
      vote: baseVote,
      participantCount: baseVote.participantCount,
    })

    setCachedVoteDetail(baseVote.id, {
      vote: {
        ...baseVote,
        participantCount: 6,
        candidates: baseVote.candidates.map((candidate) => ({ ...candidate, votes: undefined })),
      },
      participantCount: 6,
    })

    const cached = getCachedVoteDetail(baseVote.id)

    expect(cached?.participantCount).toBe(7)
    expect(cached?.vote.participantCount).toBe(7)
    expect(cached?.vote.candidates.find((candidate) => candidate.id === 'candidate-a')?.votes).toBe(3)
    expect(cached?.vote.candidates.find((candidate) => candidate.id === 'candidate-b')?.votes).toBe(4)
  })
})
