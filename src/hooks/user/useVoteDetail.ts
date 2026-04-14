import { useCallback, useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { fetchCandidateManifest } from "../../api/candidateManifest";
import { fetchElectionDetail } from "../../api/elections";
import {
  getElectionResultSummary,
  getElectionState,
  getTotalVotesForCandidate,
} from "../../contracts/vestar/actions";
import {
  mapToVoteDetail,
  resolveDisplayedParticipantCount,
  resolveElectionCandidates,
} from "../../utils/electionMapper";
import { findOptimisticElection } from "../../utils/optimisticVotes";
import type { VoteDetailData } from "../../types/vote";
import {
  getCachedVoteDetail,
  setCachedVoteDetail,
} from "../../utils/voteDetailCache";

async function fetchContractState(electionAddress: Address) {
  try {
    const [state, summary] = await Promise.all([
      getElectionState(electionAddress),
      getElectionResultSummary(electionAddress),
    ]);

    return { state, totalSubmissions: summary.totalSubmissions };
  } catch {
    return { state: undefined, totalSubmissions: undefined };
  }
}

async function fetchCandidateVotes(
  electionAddress: Address,
  candidateKeys: string[],
) {
  const results = await Promise.allSettled(
    candidateKeys.map((candidateKey) =>
      getTotalVotesForCandidate(electionAddress, candidateKey),
    ),
  );

  const map = new Map<string, bigint>();
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      map.set(candidateKeys[index], result.value);
    }
  });

  return map;
}

export interface UseVoteDetailResult {
  vote: VoteDetailData | null;
  isLoading: boolean;
  participantCount: number;
  applyOptimisticSubmission: (candidateKeys: string[]) => void;
}

function collectVoteCandidateKeys(vote: VoteDetailData) {
  const directCandidateKeys = vote.candidates.map((candidate) => candidate.id);
  const sectionCandidateKeys =
    vote.sections?.flatMap((section) =>
      section.candidates.map((candidate) => candidate.id),
    ) ?? [];

  return Array.from(new Set([...directCandidateKeys, ...sectionCandidateKeys]));
}

function applyCandidateVoteMap(
  vote: VoteDetailData,
  candidateVotes?: Map<string, bigint>,
): VoteDetailData {
  if (!candidateVotes || candidateVotes.size === 0) {
    return vote;
  }

  const applyVotes = <T extends { id: string; votes?: number }>(candidate: T): T => {
    if (!candidateVotes.has(candidate.id)) {
      return candidate;
    }

    return {
      ...candidate,
      votes: Number(candidateVotes.get(candidate.id)),
    };
  };

  return {
    ...vote,
    candidates: vote.candidates.map((candidate) => applyVotes(candidate)),
    sections: vote.sections?.map((section) => ({
      ...section,
      candidates: section.candidates.map((candidate) => applyVotes(candidate)),
    })),
  };
}

export function applyOptimisticVoteSubmission(
  vote: VoteDetailData,
  candidateKeys: string[],
): VoteDetailData {
  const selectedCandidateKeys = new Set(candidateKeys);
  const nextParticipantCount = vote.participantCount + 1;

  const incrementVotes = <T extends { id: string; votes?: number }>(candidate: T): T => {
    if (!selectedCandidateKeys.has(candidate.id) || typeof candidate.votes !== "number") {
      return candidate;
    }

    return {
      ...candidate,
      votes: candidate.votes + 1,
    };
  };

  return {
    ...vote,
    participantCount: nextParticipantCount,
    candidates: vote.candidates.map((candidate) => incrementVotes(candidate)),
    sections: vote.sections?.map((section) => ({
      ...section,
      candidates: section.candidates.map((candidate) => incrementVotes(candidate)),
    })),
  };
}

export function useVoteDetail(id: string): UseVoteDetailResult {
  const [vote, setVote] = useState<VoteDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [participantCount, setParticipantCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = getCachedVoteDetail(id);
    const optimisticElection = findOptimisticElection(id);

    if (cached) {
      setVote(cached.vote);
      setParticipantCount(cached.participantCount);
      setIsLoading(false);
    } else if (optimisticElection) {
      const optimisticVote = mapToVoteDetail(optimisticElection);
      setVote(optimisticVote);
      setParticipantCount(optimisticVote.participantCount);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    fetchElectionDetail(id)
      .then(async (election) => {
        if (cancelled) return;

        if (!cached && !optimisticElection) {
          const previewVote = mapToVoteDetail(election);
          setVote(previewVote);
          setParticipantCount(previewVote.participantCount);
          setCachedVoteDetail(id, {
            vote: previewVote,
            participantCount: previewVote.participantCount,
          });
          setIsLoading(false);
        }

        let contractState: number | undefined;
        let contractTotalSubmissions: bigint | undefined;
        let candidateVotes: Map<string, bigint> | undefined;
        const manifestPromise = fetchCandidateManifest(
          election.candidateManifestUri,
          election.candidateManifestHash,
        );

        if (election.onchainElectionAddress) {
          const address = election.onchainElectionAddress as Address;
          const contractDataPromise = fetchContractState(address);
          const manifestForCandidates = await manifestPromise;
          if (cancelled) return;

          const resolvedCandidates = resolveElectionCandidates(
            election,
            manifestForCandidates,
          );
          const candidateVotesPromise =
            election.visibilityMode === "OPEN"
              ? fetchCandidateVotes(
                  address,
                  resolvedCandidates
                    .map((candidate) => candidate.candidateKey)
                    .filter((candidateKey): candidateKey is string =>
                      Boolean(candidateKey),
                    ),
                )
              : Promise.resolve(undefined);

          const [contractData, resolvedVotes] = await Promise.all([
            contractDataPromise,
            candidateVotesPromise,
          ]);

          contractState = contractData.state;
          contractTotalSubmissions = contractData.totalSubmissions;
          candidateVotes = resolvedVotes;
        }

        if (cancelled) return;

        const manifest = await manifestPromise;

        const mapped = mapToVoteDetail(
          election,
          contractState,
          contractTotalSubmissions,
          candidateVotes,
          manifest,
        );
        setVote(mapped);
        setParticipantCount(mapped.participantCount);
        setCachedVoteDetail(id, {
          vote: mapped,
          participantCount: mapped.participantCount,
        });
      })
      .catch(() => {
        if (cancelled) return;
        if (cached || optimisticElection) {
          return;
        }
        setVote(null);
        setParticipantCount(0);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const applyOptimisticSubmission = useCallback((candidateKeys: string[]) => {
    setVote((currentVote) => {
      if (!currentVote) {
        return currentVote;
      }

      const nextVote = applyOptimisticVoteSubmission(currentVote, candidateKeys);
      setParticipantCount(nextVote.participantCount);
      setCachedVoteDetail(id, {
        vote: nextVote,
        participantCount: nextVote.participantCount,
      });
      return nextVote;
    });
  }, [id]);

  useEffect(() => {
    if (!vote || vote.badge === "end" || !vote.electionAddress) {
      return;
    }

    const refresh = () => {
      const candidateKeys = vote.resultPublic ? collectVoteCandidateKeys(vote) : [];

      Promise.all([
        getElectionResultSummary(vote.electionAddress as Address),
        candidateKeys.length > 0
          ? fetchCandidateVotes(vote.electionAddress as Address, candidateKeys).catch(
              () => undefined,
            )
          : Promise.resolve(undefined),
      ])
        .then(([summary, candidateVotes]) => {
          const nextParticipantCount = resolveDisplayedParticipantCount({
            backendParticipantCount: 0,
            contractTotalSubmissions: summary.totalSubmissions,
            candidateVotes,
            fallbackParticipantCount: vote.participantCount,
          });
          setParticipantCount(nextParticipantCount);

          setVote((currentVote) => {
            if (!currentVote) {
              return currentVote;
            }

            const nextVote = applyCandidateVoteMap(
              {
                ...currentVote,
                participantCount: nextParticipantCount,
              },
              candidateVotes,
            );

            setCachedVoteDetail(vote.id, {
              vote: nextVote,
              participantCount: nextParticipantCount,
            });

            return nextVote;
          });
        })
        .catch(() => {});
    };

    intervalRef.current = setInterval(refresh, 30_000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [vote]);

  return { vote, isLoading, participantCount, applyOptimisticSubmission };
}
