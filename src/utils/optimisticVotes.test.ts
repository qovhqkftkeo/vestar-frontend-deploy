import { beforeEach, describe, expect, it } from 'vitest'
import type { ApiElection } from '../api/types'
import {
  formatVoteHistoryDate,
  mergeOptimisticElections,
  mergeOptimisticVoteHistory,
  saveOptimisticElection,
  saveOptimisticVoteHistoryEntry,
} from './optimisticVotes'

function createElection(overrides: Partial<ApiElection> = {}): ApiElection {
  return {
    id: '1000',
    draftId: null,
    onchainSeriesId: '0xseries',
    onchainElectionId: '0xelection',
    onchainElectionAddress: '0x0000000000000000000000000000000000000100',
    candidateManifestHash: '0xhash',
    candidateManifestUri: 'ipfs://manifest',
    organizerWalletAddress: '0x0000000000000000000000000000000000000001',
    organizerVerifiedSnapshot: true,
    organizer: {
      walletAddress: '0x0000000000000000000000000000000000000001',
      organizationName: 'VESTAr',
    },
    visibilityMode: 'OPEN',
    paymentMode: 'FREE',
    ballotPolicy: 'ONE_PER_ELECTION',
    startAt: '2026-04-12T00:00:00.000Z',
    endAt: '2026-04-13T00:00:00.000Z',
    resultRevealAt: '2026-04-13T00:00:00.000Z',
    minKarmaTier: 0,
    resetIntervalSeconds: 0,
    allowMultipleChoice: false,
    maxSelectionsPerSubmission: 1,
    timezoneWindowOffset: 0,
    paymentToken: null,
    costPerBallot: '0',
    onchainState: 'ACTIVE',
    title: 'Optimistic Vote',
    category: 'Music Shows',
    coverImageUrl: null,
    syncState: 'PREPARED',
    series: {
      id: 'series-1',
      onchainSeriesId: '0xseries',
      seriesPreimage: 'Series',
      coverImageUrl: null,
    },
    electionKey: null,
    electionCandidates: [],
    validDecryptedBallotCount: 0,
    resultSummary: {
      id: 'summary-1',
      electionRefId: '1000',
      totalSubmissions: 0,
      totalDecryptedBallots: 0,
      totalValidVotes: 0,
      totalInvalidVotes: 0,
      createdAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T00:00:00.000Z',
    },
    ...overrides,
  }
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('optimisticVotes', () => {
  it('formats vote history timestamps in KST', () => {
    expect(formatVoteHistoryDate('2026-04-16 07:34:00.000')).toBe('2026.04.16 16:34')
  })

  it('merges optimistic elections ahead of server results', () => {
    saveOptimisticElection(
      createElection({
        id: '900000000000',
        onchainElectionId: '0xoptimistic',
        onchainElectionAddress: '0x0000000000000000000000000000000000000900',
      }),
    )

    const merged = mergeOptimisticElections([], {
      organizerWalletAddress: '0x0000000000000000000000000000000000000001',
    })

    expect(merged).toHaveLength(1)
    expect(merged[0].onchainElectionId).toBe('0xoptimistic')
  })

  it('drops optimistic elections once the backend returns the same onchain election', () => {
    saveOptimisticElection(
      createElection({
        id: '900000000000',
        onchainElectionId: '0xoptimistic',
        onchainElectionAddress: '0x0000000000000000000000000000000000000900',
      }),
    )

    const merged = mergeOptimisticElections([
      createElection({
        id: '101',
        onchainElectionId: '0xoptimistic',
        onchainElectionAddress: '0x0000000000000000000000000000000000000900',
      }),
    ])

    expect(merged).toHaveLength(1)
    expect(merged[0].id).toBe('101')
  })

  it('prepends optimistic vote history until the backend catches up', () => {
    saveOptimisticVoteHistoryEntry({
      id: 'optimistic-vote-1',
      walletAddress: '0x0000000000000000000000000000000000000001',
      txHash: '0xtxhash',
      voteId: 'vote-1',
      title: 'Vote 1',
      org: 'Series',
      imageUrl: null,
      submittedAt: '2026-04-12T00:00:00.000Z',
      status: 'active',
      paymentMode: 'FREE',
      costPerBallot: null,
      selectedCandidateKeys: ['A'],
      invalidReason: null,
      badge: 'live',
    })

    const optimisticOnly = mergeOptimisticVoteHistory(
      '0x0000000000000000000000000000000000000001',
      [],
      'en',
    )
    expect(optimisticOnly).toHaveLength(1)
    expect(optimisticOnly[0].submissionStatus).toBe('pending')

    const merged = mergeOptimisticVoteHistory(
      '0x0000000000000000000000000000000000000001',
      [
        {
          id: 'server-1',
          txHash: '0xtxhash',
          voteId: 'vote-1',
          title: 'Vote 1',
          org: 'Series',
          imageUrl: null,
          date: '2026.04.12 09:00',
          status: 'active',
          submissionStatus: 'confirmed',
          spentLabel: null,
          choice: 'A',
          invalidReason: null,
          selectedCandidateKeys: ['A'],
          badge: 'live',
        },
      ],
      'en',
    )

    expect(merged).toHaveLength(1)
    expect(merged[0].submissionStatus).toBe('confirmed')
    expect(merged[0].id).toBe('server-1')
  })
})
