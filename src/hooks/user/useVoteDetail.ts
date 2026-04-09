import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address } from 'viem'
import { useAccount } from 'wagmi'
import { fetchElectionDetailResolved } from '../../api/elections'
import { fetchOnchainElectionSubmissionCount } from '../../api/onchainElections'
import {
  getElectionConfig,
  getElectionId,
  getKarmaTier,
  getElectionResultSummary,
  getElectionState,
  getElectionVoterSnapshot,
  getTotalVotesForCandidate,
  hashVestarText,
  isKarmaEligible,
} from '../../contracts/vestar/actions'
import {
  VESTAR_ELECTION_STATE,
  VESTAR_VISIBILITY_MODE,
  type ElectionVoterSnapshot,
} from '../../contracts/vestar/types'
import { mapContractStateToBadge, mapToVoteDetail } from '../../utils/electionMapper'
import type { VoteDetailData } from '../../types/vote'
import { readCachedVoterSnapshot, writeCachedVoterSnapshot } from '../../utils/voterSnapshotCache'

// ── Mock fallback ─────────────────────────────────────────────────────────────
// Kept intact so the app still works when backend/on-chain reads are both unavailable.

// 목업 : API/온체인 상세 로딩이 모두 실패했을 때만 쓰는 개발용 상세 데이터
const MOCK_VOTES: Record<string, VoteDetailData> = {
  '2': {
    id: '2',
    title: '2026 MAMA 대상',
    org: 'Mnet × MAMA Awards',
    verified: true,
    emoji: '🏆',
    badge: 'live',
    deadlineLabel: '3d 11h left',
    urgent: false,
    startDate: '2026.04.07 00:00',
    endDate: '2026.04.10 23:59',
    endDateISO: '2026-04-10T23:59:00+09:00',
    resultReveal: '2026.04.11 00:00',
    maxChoices: 3,
    participantCount: 142308,
    goalVotes: 500000,
    voteFrequency: '1 vote total',
    voteLimit: 'Multiple choices',
    resultPublic: false,
    candidates: [
      {
        id: 's1c1',
        name: 'BTS',
        group: '빅히트 뮤직',
        emoji: '👑',
        emojiColor: '#fef3c7',
      },
      {
        id: 's1c2',
        name: 'Stray Kids',
        group: 'JYP 엔터테인먼트',
        emoji: '🔥',
        emojiColor: '#fff1f2',
      },
      {
        id: 's1c3',
        name: 'SEVENTEEN',
        group: '플레디스 엔터테인먼트',
        emoji: '💎',
        emojiColor: '#e0f2fe',
      },
      { id: 's1c4', name: 'EXO', group: 'SM 엔터테인먼트', emoji: '⭐', emojiColor: '#fef3c7' },
      {
        id: 's2c1',
        name: 'BLACKPINK',
        group: 'YG 엔터테인먼트',
        emoji: '💗',
        emojiColor: '#fce7f3',
      },
      {
        id: 's2c2',
        name: 'aespa',
        group: 'SM 엔터테인먼트',
        emoji: '🌌',
        emojiColor: '#ede9fe',
      },
      {
        id: 's2c3',
        name: 'IVE',
        group: '스타쉽 엔터테인먼트',
        emoji: '❄️',
        emojiColor: '#e0f2fe',
      },
      { id: 's2c4', name: 'NewJeans', group: '어도어', emoji: '🍀', emojiColor: '#dcfce7' },
      {
        id: 's3c1',
        name: 'IU',
        group: 'EDAM 엔터테인먼트',
        emoji: '🎀',
        emojiColor: '#fce7f3',
      },
      {
        id: 's3c2',
        name: 'G-Dragon',
        group: 'YG 엔터테인먼트',
        emoji: '🦋',
        emojiColor: '#F0EDFF',
      },
      {
        id: 's3c3',
        name: '태연',
        group: 'SM 엔터테인먼트',
        emoji: '🌙',
        emojiColor: '#e8f0ff',
      },
    ],
  },
  '1': {
    id: '1',
    title: '이번 주 1위는 누구?',
    org: 'Show! Music Core × Mubeat',
    verified: true,
    emoji: '🎤',
    badge: 'live',
    deadlineLabel: '2h 14m left',
    urgent: true,
    startDate: '2025.04.01 18:00',
    endDate: '2026.04.08 11:00',
    endDateISO: '2026-04-08T11:00:00+09:00',
    resultReveal: '2026.04.08 12:00',
    maxChoices: 1,
    participantCount: 24891,
    goalVotes: 50000,
    voteFrequency: '1 vote total',
    voteLimit: '1 vote per ballot',
    resultPublic: false,
    candidates: [
      {
        id: '1',
        name: 'BTS',
        group: '빅히트 뮤직',
        emoji: '👑',
        emojiColor: '#fef3c7',
        votePreviewPct: 28,
      },
      {
        id: '2',
        name: 'BLACKPINK',
        group: 'YG 엔터테인먼트',
        emoji: '💗',
        emojiColor: '#fce7f3',
        votePreviewPct: 12,
      },
      {
        id: '3',
        name: 'aespa',
        group: 'SM 엔터테인먼트',
        emoji: '🌌',
        emojiColor: '#ede9fe',
        votePreviewPct: 22,
      },
      {
        id: '4',
        name: 'IVE',
        group: '스타쉽 엔터테인먼트',
        emoji: '❄️',
        emojiColor: '#e0f2fe',
        votePreviewPct: 8,
      },
      {
        id: '5',
        name: 'NewJeans',
        group: '어도어',
        emoji: '🍀',
        emojiColor: '#dcfce7',
        votePreviewPct: 19,
      },
      {
        id: '6',
        name: 'Stray Kids',
        group: 'JYP 엔터테인먼트',
        emoji: '🔥',
        emojiColor: '#fff1f2',
        votePreviewPct: 11,
      },
    ],
  },
}

// ── Contract enrichment helpers ───────────────────────────────────────────────

/**
 * Fetches live state and total submissions from the contract.
 * Returns undefined fields if the call fails.
 */
async function fetchContractSnapshot(electionAddress: Address) {
  const [stateResult, summaryResult, configResult, electionIdResult, liveSubmissionCountResult] =
    await Promise.allSettled([
      getElectionState(electionAddress),
      getElectionResultSummary(electionAddress),
      getElectionConfig(electionAddress),
      getElectionId(electionAddress),
      fetchOnchainElectionSubmissionCount(electionAddress),
    ])

  const finalizedTotalSubmissions =
    summaryResult.status === 'fulfilled' ? Number(summaryResult.value.totalSubmissions) : undefined
  const liveTotalSubmissions =
    liveSubmissionCountResult.status === 'fulfilled' ? liveSubmissionCountResult.value : undefined

  return {
    state: stateResult.status === 'fulfilled' ? stateResult.value : undefined,
    totalSubmissions:
      finalizedTotalSubmissions !== undefined || liveTotalSubmissions !== undefined
        ? BigInt(Math.max(finalizedTotalSubmissions ?? 0, liveTotalSubmissions ?? 0))
        : undefined,
    config: configResult.status === 'fulfilled' ? configResult.value : undefined,
    electionId: electionIdResult.status === 'fulfilled' ? electionIdResult.value : undefined,
  }
}

/**
 * Fetches per-candidate vote counts from the contract.
 * Silently ignores individual call failures.
 */
async function fetchCandidateVotes(
  electionAddress: Address,
  candidateKeys: string[],
): Promise<Map<string, bigint>> {
  const results = await Promise.allSettled(
    candidateKeys.map((key) => getTotalVotesForCandidate(electionAddress, hashVestarText(key))),
  )

  const map = new Map<string, bigint>()
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      map.set(candidateKeys[i], result.value)
    }
  })
  return map
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseVoteDetailResult {
  vote: VoteDetailData | null
  isLoading: boolean
  participantCount: number
  voterSnapshot: ElectionVoterSnapshot | null
  voteAccessReason: 'karma' | 'ballot' | null
  voterKarmaTier: number | null
  isVoteAccessLoading: boolean
  refreshVoteAccess: () => Promise<void>
}

export function useVoteDetail(id: string): UseVoteDetailResult {
  const [vote, setVote] = useState<VoteDetailData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [participantCount, setParticipantCount] = useState(0)
  const [voterSnapshot, setVoterSnapshot] = useState<ElectionVoterSnapshot | null>(null)
  const [voteAccessReason, setVoteAccessReason] = useState<'karma' | 'ballot' | null>(null)
  const [voterKarmaTier, setVoterKarmaTier] = useState<number | null>(null)
  const [isVoteAccessLoading, setIsVoteAccessLoading] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { address } = useAccount()

  const loadVoteAccessSnapshot = useCallback(async () => {
    if (!vote?.electionAddress || !address) {
      return null
    }

    const snapshot = await getElectionVoterSnapshot(vote.electionAddress, address)
    const minKarmaTier = vote.minKarmaTier ?? 0
    let nextVoteAccessReason: 'karma' | 'ballot' | null = null
    let nextVoterKarmaTier: number | null = null

    if (minKarmaTier > 0) {
      try {
        // sungje : 투표 불가 사유가 카르마 미달인지 이미 사용한 ballot인지 구분하려고 현재 tier를 같이 조회
        const [karmaTier, karmaEligible] = await Promise.all([
          getKarmaTier(address),
          isKarmaEligible(address, minKarmaTier),
        ])
        nextVoterKarmaTier = karmaTier

        if (
          !snapshot.canSubmitBallot &&
          (vote.electionState ?? VESTAR_ELECTION_STATE.ACTIVE) === VESTAR_ELECTION_STATE.ACTIVE
        ) {
          nextVoteAccessReason = karmaEligible ? 'ballot' : 'karma'
        }
      } catch {
        if (
          !snapshot.canSubmitBallot &&
          (vote.electionState ?? VESTAR_ELECTION_STATE.ACTIVE) === VESTAR_ELECTION_STATE.ACTIVE
        ) {
          nextVoteAccessReason = 'ballot'
        }
      }
    } else if (
      !snapshot.canSubmitBallot &&
      (vote.electionState ?? VESTAR_ELECTION_STATE.ACTIVE) === VESTAR_ELECTION_STATE.ACTIVE
    ) {
      nextVoteAccessReason = 'ballot'
    }

    return {
      snapshot,
      voteAccessReason: nextVoteAccessReason,
      voterKarmaTier: nextVoterKarmaTier,
    }
  }, [vote?.electionAddress, vote?.minKarmaTier, vote?.electionState, address])

  const refreshVoteAccess = useCallback(async () => {
    if (!vote?.electionAddress || !address) {
      setVoterSnapshot(null)
      setVoteAccessReason(null)
      setVoterKarmaTier(null)
      return
    }

    setIsVoteAccessLoading(true)

    try {
      const access = await loadVoteAccessSnapshot()
      if (!access) {
        setVoterSnapshot(null)
        setVoteAccessReason(null)
        setVoterKarmaTier(null)
        return
      }

      setVoterSnapshot(access.snapshot)
      setVoteAccessReason(access.voteAccessReason)
      setVoterKarmaTier(access.voterKarmaTier)
      writeCachedVoterSnapshot(vote.electionAddress, address, {
        canSubmitBallot: access.snapshot.canSubmitBallot,
        remainingBallots: access.snapshot.remainingBallots,
      })
    } catch {
      setVoterSnapshot(null)
      setVoteAccessReason(null)
      setVoterKarmaTier(null)
    } finally {
      setIsVoteAccessLoading(false)
    }
  }, [vote?.electionAddress, address, loadVoteAccessSnapshot])

  // ── Initial fetch: API metadata → contract augmentation ──────────────────
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    fetchElectionDetailResolved(id)
      .then(async (election) => {
        if (cancelled) return

        let contractState: number | undefined
        let contractTotalSubmissions: bigint | undefined
        let contractConfig: Awaited<ReturnType<typeof getElectionConfig>> | undefined
        let contractElectionId: Awaited<ReturnType<typeof getElectionId>> | undefined
        let candidateVotes: Map<string, bigint> | undefined

        if (election.onchain_election_address) {
          const addr = election.onchain_election_address as Address
          const contractData = await fetchContractSnapshot(addr)
          contractState = contractData.state
          contractTotalSubmissions = contractData.totalSubmissions
          contractConfig = contractData.config
          contractElectionId = contractData.electionId

          // sungje : PRIVATE 투표는 후보 tally를 바로 읽을 수 없어서 OPEN일 때만 per-candidate 집계 조회
          const visibilityMode =
            contractData.config?.visibilityMode ??
            (election.visibility_mode === 'PRIVATE'
              ? VESTAR_VISIBILITY_MODE.PRIVATE
              : VESTAR_VISIBILITY_MODE.OPEN)

          if (visibilityMode === VESTAR_VISIBILITY_MODE.OPEN) {
            candidateVotes = await fetchCandidateVotes(
              addr,
              election.candidates.map((c) => c.candidate_key),
            )
          }
        }

        if (cancelled) return

        const voteData = mapToVoteDetail(
          election,
          contractState,
          contractTotalSubmissions,
          candidateVotes,
          contractConfig,
          contractElectionId,
        )
        setVote(voteData)
        setParticipantCount(voteData.participantCount)
      })
      .catch(() => {
        if (cancelled) return
        // 목업 : API/온체인 상세를 모두 못 읽을 때만 개발용 mock 상세로 fallback
        const mock = MOCK_VOTES[id] ?? { ...MOCK_VOTES['1'], id, title: '투표 상세' }
        setVote(mock)
        setParticipantCount(mock.participantCount)
        setVoterSnapshot(null)
        setVoteAccessReason(null)
        setVoterKarmaTier(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  // ── Wallet-aware access snapshot with short cache ─────────────────────────
  useEffect(() => {
    let cancelled = false

    if (!vote?.electionAddress || !address) {
      setVoterSnapshot(null)
      setVoteAccessReason(null)
      setVoterKarmaTier(null)
      setIsVoteAccessLoading(false)
      return
    }

    const cached = readCachedVoterSnapshot(vote.electionAddress, address)
    if (cached) {
      // sungje : 짧은 TTL 캐시로 뒤로가기/재진입 시 같은 지갑의 ballot 가능 여부 재조회 비용 완화
      setVoterSnapshot({
        voter: address,
        timestamp: BigInt(Math.floor(cached.updatedAt / 1000)),
        canSubmitBallot: cached.canSubmitBallot,
        remainingBallots: cached.remainingBallots,
      })
    }

    setIsVoteAccessLoading(true)
    loadVoteAccessSnapshot()
      .then((access) => {
        if (!access || cancelled) return
        setVoterSnapshot(access.snapshot)
        setVoteAccessReason(access.voteAccessReason)
        setVoterKarmaTier(access.voterKarmaTier)
        writeCachedVoterSnapshot(vote.electionAddress!, address, {
          canSubmitBallot: access.snapshot.canSubmitBallot,
          remainingBallots: access.snapshot.remainingBallots,
        })
      })
      .catch(() => {
        if (cancelled) return
        if (!cached) {
          setVoterSnapshot(null)
        }
        setVoteAccessReason(null)
        setVoterKarmaTier(null)
      })
      .finally(() => {
        if (!cancelled) {
          setIsVoteAccessLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [vote?.electionAddress, address, loadVoteAccessSnapshot])

  // ── Live refresh: poll contract every 30 s for active elections ───────────
  useEffect(() => {
    if (!vote || vote.badge === 'end') return
    if (!vote.electionAddress) {
      // No contract → simulate ticking count (mock / dev mode)
      intervalRef.current = setInterval(() => {
        setParticipantCount((prev) => prev + Math.floor(Math.random() * 3) + 1)
      }, 4000)
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }

    const addr = vote.electionAddress as Address

    const refresh = () => {
      fetchContractSnapshot(addr)
        .then((snapshot) => {
          if (snapshot.totalSubmissions !== undefined) {
            setParticipantCount(Number(snapshot.totalSubmissions))
          }

          setVote((prev) =>
            prev
              ? {
                  ...prev,
                  participantCount:
                    snapshot.totalSubmissions !== undefined
                      ? Number(snapshot.totalSubmissions)
                      : prev.participantCount,
                  electionState: snapshot.state ?? prev.electionState,
                  badge:
                    snapshot.state !== undefined
                      ? mapContractStateToBadge(snapshot.state)
                      : prev.badge,
                }
              : prev,
          )
        })
        .catch(() => {})
    }

    intervalRef.current = setInterval(refresh, 30_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [vote])

  return {
    vote,
    isLoading,
    participantCount,
    voterSnapshot,
    voteAccessReason,
    voterKarmaTier,
    isVoteAccessLoading,
    refreshVoteAccess,
  }
}
