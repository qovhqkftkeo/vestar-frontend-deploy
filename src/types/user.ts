export type KarmaEventType = 'vote' | 'referral' | 'bonus' | 'streak'

export type BadgeVariant = 'live' | 'hot' | 'new' | 'end'

export interface MyVoteItem {
  id: string
  voteId: string
  title: string
  org: string
  date: string
  karmaEarned: number
  choice: string
  invalidReason: string | null
  selectedCandidateKeys: string[]
  badge: BadgeVariant
}

export interface KarmaEvent {
  id: string
  type: KarmaEventType
  label: string
  karma: number
  date: string
}
