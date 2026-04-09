export type BadgeVariant = 'live' | 'hot' | 'new' | 'end'
export type VoteVisibilityMode = 'OPEN' | 'PRIVATE'
export type VotePaymentMode = 'FREE' | 'PAID'
export type VoteBallotPolicy = 'ONE_PER_ELECTION' | 'ONE_PER_INTERVAL' | 'UNLIMITED_PAID'

export interface HotVote {
  id: string
  emoji: string
  gradient: string
  org: string
  name: string
  count: string
  badge: BadgeVariant
  imageUrl?: string
}

export interface VoteListItem {
  id: string
  emoji: string
  emojiColor: string
  org: string
  name: string
  count: string
  badge: BadgeVariant
  deadline: string
  urgent: boolean
  verified?: boolean
  imageUrl?: string
}

export interface RankedCandidate extends Candidate {
  votes: number
  percentage: number
  rank: number
}

export interface VoteResultData {
  id: string
  title: string
  org: string
  verified: boolean
  emoji: string
  endDate: string
  totalVotes: number
  rankedCandidates: RankedCandidate[]
}

export interface Candidate {
  id: string
  candidateKey?: string
  name: string
  group: string
  emoji: string
  emojiColor: string
  votes?: number
  percentage?: number
  votePreviewPct?: number
  /** Optional photo/image URL. Supports ipfs:// and https:// */
  imageUrl?: string
}

export interface VoteSection {
  id: string
  name: string
  candidates: Candidate[]
}

export interface VoteDetailData {
  id: string
  title: string
  org: string
  verified: boolean
  emoji: string
  badge: BadgeVariant
  deadlineLabel: string
  urgent: boolean
  startDate: string
  endDate: string
  endDateISO: string
  resultReveal: string
  maxChoices: number
  participantCount: number
  goalVotes: number
  voteFrequency: string
  voteLimit: string
  resultPublic: boolean
  candidates: Candidate[]
  sections?: VoteSection[] // present = grouped vote mode
  /** On-chain election contract address. When present, real contract calls are used. */
  electionAddress?: `0x${string}`
  /** On-chain bytes32 election id. */
  electionId?: `0x${string}`
  /** Live contract election state when available. */
  electionState?: number
  visibilityMode?: VoteVisibilityMode
  paymentMode?: VotePaymentMode
  ballotPolicy?: VoteBallotPolicy
  minKarmaTier?: number
  allowMultipleChoice?: boolean
  costPerBallot?: string
  paymentToken?: `0x${string}`
  electionPublicKey?: `0x${string}`
  /** Optional banner image for the vote hero. Supports ipfs:// and https:// */
  imageUrl?: string
}
