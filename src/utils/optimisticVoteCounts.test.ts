import { beforeEach, describe, expect, it } from 'vitest'
import type { ApiElection } from '../api/types'
import type { HotVote, VoteListItem } from '../types/vote'
import { setCachedVoteDetail } from './voteDetailCache'
import {
  applyOptimisticParticipantCountToElection,
  updateCachedVoteCollectionCounts,
} from './optimisticVoteCounts'
import { getViewCache, invalidateViewCache, setViewCache } from './viewCache'

function createElection(totalSubmissions: number): ApiElection {
  return {
    id: 'vote-1',
    draftId: null,
    onchainSeriesId: '0xseries',
    onchainElectionId: '0xelection',
    onchainElectionAddress: '0x1111111111111111111111111111111111111111',
    candidateManifestHash: null,
    candidateManifestUri: null,
    organizerWalletAddress: '0x0000000000000000000000000000000000000001',
    organizerVerifiedSnapshot: true,
    organizer: {
      walletAddress: '0x0000000000000000000000000000000000000001',
      organizationName: 'PARKSUNGJE',
    },
    visibilityMode: 'OPEN',
    paymentMode: 'FREE',
    ballotPolicy: 'ONE_PER_ELECTION',
    startAt: '2026-04-14T10:00:00.000Z',
    endAt: '2026-04-14T18:00:00.000Z',
    resultRevealAt: '2026-04-14T18:00:00.000Z',
    minKarmaTier: 0,
    resetIntervalSeconds: 0,
    allowMultipleChoice: false,
    maxSelectionsPerSubmission: 1,
    timezoneWindowOffset: 0,
    paymentToken: null,
    costPerBallot: '0',
    onchainState: 'ACTIVE',
    title: 'All caught u',
    category: 'fan',
    coverImageUrl: null,
    syncState: 'INDEXED',
    series: null,
    electionKey: null,
    electionCandidates: [],
    validDecryptedBallotCount: 0,
    resultSummary: {
      id: 'summary-1',
      electionRefId: 'vote-1',
      totalSubmissions,
      totalDecryptedBallots: 0,
      totalValidVotes: 0,
      totalInvalidVotes: 0,
      createdAt: '2026-04-14T10:00:00.000Z',
      updatedAt: '2026-04-14T10:00:00.000Z',
    },
  }
}

describe('optimisticVoteCounts', () => {
  beforeEach(() => {
    invalidateViewCache()
  })

  it('overlays cached participant counts onto fetched elections', () => {
    setCachedVoteDetail('vote-1', {
      participantCount: 8,
      vote: {
        id: 'vote-1',
        title: 'All caught u',
        org: 'ㅇㅇ',
        host: 'PARKSUNGJE',
        verified: true,
        emoji: '',
        badge: 'live',
        deadlineLabel: '1h left',
        urgent: false,
        startDate: '2026.04.14 10:00',
        endDate: '2026.04.14 18:00',
        endDateISO: '2026-04-14T18:00:00.000Z',
        resultReveal: '2026.04.14 18:00',
        minKarmaTier: 0,
        maxChoices: 1,
        participantCount: 8,
        goalVotes: 0,
        voteFrequency: '1 vote total',
        voteLimit: '1 vote per ballot',
        resultPublic: true,
        candidates: [],
      },
    })

    const nextElection = applyOptimisticParticipantCountToElection(createElection(7))

    expect(nextElection.resultSummary?.totalSubmissions).toBe(8)
  })

  it('bumps cached hot and list collections for the voted item', () => {
    const hotVotes: HotVote[] = [
      {
        id: 'vote-1',
        category: 'fan',
        emoji: '',
        gradient: 'linear-gradient(135deg,#111,#222)',
        org: 'ㅇㅇ',
        name: 'All caught u',
        count: '7',
        badge: 'live',
      },
    ]
    const voteListItems: VoteListItem[] = [
      {
        id: 'vote-1',
        category: 'fan',
        visibilityMode: 'OPEN',
        paymentMode: 'FREE',
        emoji: '',
        emojiColor: '#fff',
        org: 'ㅇㅇ',
        name: 'All caught u',
        count: '7',
        badge: 'live',
        deadline: '1h left',
        urgent: false,
      },
    ]

    setViewCache('vote-hot', hotVotes)
    setViewCache('vote-list:all', voteListItems)

    updateCachedVoteCollectionCounts('vote-1', 8)

    expect(getViewCache<HotVote[]>('vote-hot', 15_000)?.[0]?.count).toBe('8')
    expect(getViewCache<VoteListItem[]>('vote-list:all', 15_000)?.[0]?.count).toBe('8')
  })
})
