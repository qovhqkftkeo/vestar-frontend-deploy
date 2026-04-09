import type { Address } from 'viem'

const VOTER_SNAPSHOT_CACHE_PREFIX = 'vestar_voter_snapshot:'
const VOTER_SNAPSHOT_TTL_MS = 15_000

export interface CachedVoterSnapshot {
  canSubmitBallot: boolean
  remainingBallots: number
  updatedAt: number
}

function makeSnapshotCacheKey(electionAddress: Address, voterAddress: Address) {
  return `${VOTER_SNAPSHOT_CACHE_PREFIX}${electionAddress.toLowerCase()}:${voterAddress.toLowerCase()}`
}

export function readCachedVoterSnapshot(
  electionAddress: Address,
  voterAddress: Address,
): CachedVoterSnapshot | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    // sungje : 선거 주소 + 지갑 주소 조합별로 최근 voter snapshot을 저장해서 읽기 부하를 줄임
    const raw = window.localStorage.getItem(makeSnapshotCacheKey(electionAddress, voterAddress))
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as CachedVoterSnapshot
    if (Date.now() - parsed.updatedAt > VOTER_SNAPSHOT_TTL_MS) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function writeCachedVoterSnapshot(
  electionAddress: Address,
  voterAddress: Address,
  snapshot: Omit<CachedVoterSnapshot, 'updatedAt'>,
) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      makeSnapshotCacheKey(electionAddress, voterAddress),
      JSON.stringify({
        ...snapshot,
        updatedAt: Date.now(),
      } satisfies CachedVoterSnapshot),
    )
  } catch {
    return
  }
}
