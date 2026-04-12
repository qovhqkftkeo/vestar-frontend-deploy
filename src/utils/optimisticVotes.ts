import type { FetchElectionsParams } from '../api/elections'
import type { ApiElection, ApiPaymentMode } from '../api/types'
import type { MyVoteItem } from '../types/user'
import { formatBallotCostLabel } from './paymentDisplay'

type StoredOptimisticElection = {
  createdAt: number
  election: ApiElection
}

type OptimisticVoteHistoryEntry = {
  id: string
  walletAddress: `0x${string}`
  txHash: string
  voteId: string
  title: string
  org: string
  imageUrl: string | null
  submittedAt: string
  status: MyVoteItem['status']
  paymentMode: ApiPaymentMode
  costPerBallot: string | null
  selectedCandidateKeys: string[]
  invalidReason: string | null
  badge: MyVoteItem['badge']
}

type StoredOptimisticVoteHistoryEntry = {
  createdAt: number
  entry: OptimisticVoteHistoryEntry
}

const OPTIMISTIC_ELECTIONS_KEY = 'vestar:optimistic-elections'
const OPTIMISTIC_VOTE_HISTORY_KEY = 'vestar:optimistic-vote-history'
const OPTIMISTIC_ELECTION_TTL_MS = 24 * 60 * 60 * 1000
const OPTIMISTIC_VOTE_HISTORY_TTL_MS = 24 * 60 * 60 * 1000
const MAX_OPTIMISTIC_ELECTIONS = 20
const MAX_OPTIMISTIC_VOTE_HISTORY = 40

function canUseStorage() {
  return typeof window !== 'undefined' && !!window.localStorage
}

function normalizeAddress(value?: string | null) {
  return value?.toLowerCase() ?? null
}

function parseStoredArray<T>(rawValue: string | null): T[] {
  if (!rawValue) {
    return []
  }

  try {
    const parsed = JSON.parse(rawValue) as T[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function readOptimisticElectionsStorage() {
  if (!canUseStorage()) {
    return []
  }

  return parseStoredArray<StoredOptimisticElection>(
    window.localStorage.getItem(OPTIMISTIC_ELECTIONS_KEY),
  )
}

function writeOptimisticElectionsStorage(items: StoredOptimisticElection[]) {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.setItem(OPTIMISTIC_ELECTIONS_KEY, JSON.stringify(items))
}

function readOptimisticVoteHistoryStorage() {
  if (!canUseStorage()) {
    return []
  }

  return parseStoredArray<StoredOptimisticVoteHistoryEntry>(
    window.localStorage.getItem(OPTIMISTIC_VOTE_HISTORY_KEY),
  )
}

function writeOptimisticVoteHistoryStorage(items: StoredOptimisticVoteHistoryEntry[]) {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.setItem(OPTIMISTIC_VOTE_HISTORY_KEY, JSON.stringify(items))
}

function isSameElection(left: ApiElection, right: ApiElection) {
  if (
    left.onchainElectionId &&
    right.onchainElectionId &&
    left.onchainElectionId.toLowerCase() === right.onchainElectionId.toLowerCase()
  ) {
    return true
  }

  if (
    left.onchainElectionAddress &&
    right.onchainElectionAddress &&
    left.onchainElectionAddress.toLowerCase() === right.onchainElectionAddress.toLowerCase()
  ) {
    return true
  }

  return left.id === right.id
}

function pruneOptimisticElections(items: StoredOptimisticElection[]) {
  const nextItems = items
    .filter((item) => Date.now() - item.createdAt < OPTIMISTIC_ELECTION_TTL_MS)
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, MAX_OPTIMISTIC_ELECTIONS)

  writeOptimisticElectionsStorage(nextItems)
  return nextItems
}

function pruneOptimisticVoteHistory(items: StoredOptimisticVoteHistoryEntry[]) {
  const nextItems = items
    .filter((item) => Date.now() - item.createdAt < OPTIMISTIC_VOTE_HISTORY_TTL_MS)
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, MAX_OPTIMISTIC_VOTE_HISTORY)

  writeOptimisticVoteHistoryStorage(nextItems)
  return nextItems
}

function matchesFetchParams(election: ApiElection, params: FetchElectionsParams) {
  if (
    params.onchainElectionId &&
    election.onchainElectionId.toLowerCase() !== params.onchainElectionId.toLowerCase()
  ) {
    return false
  }

  if (
    params.onchainElectionAddress &&
    normalizeAddress(election.onchainElectionAddress) !==
      params.onchainElectionAddress.toLowerCase()
  ) {
    return false
  }

  if (
    params.organizerWalletAddress &&
    election.organizerWalletAddress.toLowerCase() !== params.organizerWalletAddress.toLowerCase()
  ) {
    return false
  }

  if (
    params.seriesId &&
    ![
      election.onchainSeriesId,
      election.series?.onchainSeriesId,
      election.series?.id,
    ]
      .filter(Boolean)
      .some((seriesId) => seriesId?.toLowerCase() === params.seriesId?.toLowerCase())
  ) {
    return false
  }

  if (params.onchainState && election.onchainState !== params.onchainState) {
    return false
  }

  if (params.visibilityMode && election.visibilityMode !== params.visibilityMode) {
    return false
  }

  if (params.syncState && election.syncState !== params.syncState) {
    return false
  }

  return true
}

function resolveOptimisticVoteSpentLabel(
  lang: 'ko' | 'en',
  paymentMode: ApiPaymentMode,
  costPerBallot?: string | null,
) {
  if (paymentMode !== 'PAID') {
    return null
  }

  const label = formatBallotCostLabel(costPerBallot ?? '0', lang)
  return label === '무료' || label === 'Free' ? null : `-${label}`
}

function toMyVoteItem(
  entry: OptimisticVoteHistoryEntry,
  lang: 'ko' | 'en',
): MyVoteItem {
  return {
    id: entry.id,
    txHash: entry.txHash,
    voteId: entry.voteId,
    title: entry.title,
    org: entry.org,
    imageUrl: entry.imageUrl,
    date: formatVoteHistoryDate(entry.submittedAt),
    status: entry.status,
    submissionStatus: 'pending',
    spentLabel: resolveOptimisticVoteSpentLabel(lang, entry.paymentMode, entry.costPerBallot),
    choice:
      entry.selectedCandidateKeys.length > 0
        ? entry.selectedCandidateKeys.join(', ')
        : lang === 'ko'
          ? '집계 대기 중'
          : 'Awaiting tally',
    invalidReason: entry.invalidReason,
    selectedCandidateKeys: entry.selectedCandidateKeys,
    badge: entry.badge,
  }
}

export function formatVoteHistoryDate(dateValue: string): string {
  const date = new Date(dateValue)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const valueByType = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return `${valueByType.year}.${valueByType.month}.${valueByType.day} ${valueByType.hour}:${valueByType.minute}`
}

export function saveOptimisticElection(election: ApiElection) {
  const nextEntry: StoredOptimisticElection = {
    createdAt: Date.now(),
    election,
  }

  const current = pruneOptimisticElections(readOptimisticElectionsStorage())
  const nextItems = [
    nextEntry,
    ...current.filter((item) => !isSameElection(item.election, election)),
  ].slice(0, MAX_OPTIMISTIC_ELECTIONS)

  writeOptimisticElectionsStorage(nextItems)
}

export function mergeOptimisticElections(
  serverElections: ApiElection[],
  params: FetchElectionsParams = {},
) {
  const current = pruneOptimisticElections(readOptimisticElectionsStorage())

  const remaining = current.filter((item) => {
    const matchesServer = serverElections.some(
      (serverElection) =>
        item.election.onchainElectionId.toLowerCase() ===
          serverElection.onchainElectionId.toLowerCase() ||
        normalizeAddress(item.election.onchainElectionAddress) ===
          normalizeAddress(serverElection.onchainElectionAddress),
    )

    return !matchesServer
  })

  if (remaining.length !== current.length) {
    writeOptimisticElectionsStorage(remaining)
  }

  return [
    ...remaining
      .filter((item) => matchesFetchParams(item.election, params))
      .sort((left, right) => right.createdAt - left.createdAt)
      .map((item) => item.election),
    ...serverElections,
  ]
}

export function findOptimisticElection(id: string) {
  const current = pruneOptimisticElections(readOptimisticElectionsStorage())
  const normalizedId = id.toLowerCase()

  return (
    current.find((item) => {
      if (item.election.id === id) {
        return true
      }

      if (item.election.onchainElectionId.toLowerCase() === normalizedId) {
        return true
      }

      return normalizeAddress(item.election.onchainElectionAddress) === normalizedId
    })?.election ?? null
  )
}

export function saveOptimisticVoteHistoryEntry(entry: OptimisticVoteHistoryEntry) {
  const nextEntry: StoredOptimisticVoteHistoryEntry = {
    createdAt: Date.now(),
    entry,
  }

  const current = pruneOptimisticVoteHistory(readOptimisticVoteHistoryStorage())
  const nextItems = [
    nextEntry,
    ...current.filter(
      (item) =>
        item.entry.txHash.toLowerCase() !== entry.txHash.toLowerCase() &&
        item.entry.id !== entry.id,
    ),
  ].slice(0, MAX_OPTIMISTIC_VOTE_HISTORY)

  writeOptimisticVoteHistoryStorage(nextItems)
}

export function mergeOptimisticVoteHistory(
  walletAddress: `0x${string}`,
  serverVotes: MyVoteItem[],
  lang: 'ko' | 'en',
) {
  const current = pruneOptimisticVoteHistory(readOptimisticVoteHistoryStorage())
  const normalizedWalletAddress = walletAddress.toLowerCase()
  const confirmedTxHashes = new Set(
    serverVotes
      .map((vote) => vote.txHash?.toLowerCase())
      .filter((txHash): txHash is string => Boolean(txHash)),
  )

  const remaining = current.filter((item) => {
    if (item.entry.walletAddress.toLowerCase() !== normalizedWalletAddress) {
      return true
    }

    return !confirmedTxHashes.has(item.entry.txHash.toLowerCase())
  })

  if (remaining.length !== current.length) {
    writeOptimisticVoteHistoryStorage(remaining)
  }

  const optimisticVotes = remaining
    .filter((item) => item.entry.walletAddress.toLowerCase() === normalizedWalletAddress)
    .sort((left, right) => right.createdAt - left.createdAt)
    .map((item) => toMyVoteItem(item.entry, lang))

  const seenTxHashes = new Set(
    optimisticVotes
      .map((vote) => vote.txHash?.toLowerCase())
      .filter((txHash): txHash is string => Boolean(txHash)),
  )

  return [
    ...optimisticVotes,
    ...serverVotes.filter((vote) => {
      if (!vote.txHash) {
        return true
      }

      const normalizedTxHash = vote.txHash.toLowerCase()
      if (seenTxHashes.has(normalizedTxHash)) {
        return false
      }

      seenTxHashes.add(normalizedTxHash)
      return true
    }),
  ]
}
