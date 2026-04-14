import { describe, expect, it } from 'vitest'
import type { VoteDetailData } from '../../types/vote'
import { applyOptimisticVoteSubmission } from './useVoteDetail'

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
  maxChoices: 2,
  participantCount: 10,
  goalVotes: 0,
  voteFrequency: '1 vote total',
  voteLimit: 'Multiple choices',
  resultPublic: true,
  paymentMode: 'FREE',
  candidates: [
    { id: 'park-hyo-shin', name: 'Park Hyo Shin', group: '', emoji: '', emojiColor: '#fff', votes: 5 },
    { id: 'iu', name: 'IU', group: '', emoji: '', emojiColor: '#fff', votes: 3 },
  ],
}

describe('applyOptimisticVoteSubmission', () => {
  it('increments participant count and the selected candidate votes', () => {
    const nextVote = applyOptimisticVoteSubmission(baseVote, ['park-hyo-shin'])

    expect(nextVote.participantCount).toBe(11)
    expect(nextVote.candidates.find((candidate) => candidate.id === 'park-hyo-shin')?.votes).toBe(6)
    expect(nextVote.candidates.find((candidate) => candidate.id === 'iu')?.votes).toBe(3)
  })

  it('keeps hidden candidate tallies untouched when no visible vote count is loaded', () => {
    const nextVote = applyOptimisticVoteSubmission(
      {
        ...baseVote,
        resultPublic: false,
        candidates: baseVote.candidates.map((candidate) => ({ ...candidate, votes: undefined })),
      },
      ['park-hyo-shin'],
    )

    expect(nextVote.participantCount).toBe(11)
    expect(nextVote.candidates.find((candidate) => candidate.id === 'park-hyo-shin')?.votes).toBe(
      undefined,
    )
  })
})
