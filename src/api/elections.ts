import { apiFetch, isApiConfigured } from './client'
import {
  fetchOnchainElectionDetail,
  fetchOnchainElectionList,
  fetchOnchainElectionSubmissionCount,
} from './onchainElections'
import type { ApiElection, ApiElectionDetail, ApiElectionListResponse } from './types'

async function hydrateElectionTotalSubmissions<T extends ApiElection>(election: T): Promise<T> {
  if (!election.onchain_election_address) {
    return election
  }

  if ((election.total_submissions ?? 0) > 0) {
    return election
  }

  try {
    // sungje : 백엔드 indexer 가 참여수를 아직 못 채운 경우에도 온체인 제출 이벤트 개수로 0 표시를 방지
    const liveTotalSubmissions = await fetchOnchainElectionSubmissionCount(
      election.onchain_election_address,
    )

    if (liveTotalSubmissions <= 0) {
      return election
    }

    return {
      ...election,
      total_submissions: liveTotalSubmissions,
    }
  } catch {
    return election
  }
}

export interface FetchElectionListParams {
  state?: string // filter by onchain_state
  page?: number
  pageSize?: number
}

export async function fetchElectionList(
  params: FetchElectionListParams = {},
): Promise<ApiElectionListResponse> {
  const q = new URLSearchParams()
  if (params.state) q.set('state', params.state)
  if (params.page != null) q.set('page', String(params.page))
  if (params.pageSize != null) q.set('page_size', String(params.pageSize))

  const qs = q.toString()
  return apiFetch<ApiElectionListResponse>(`/elections${qs ? `?${qs}` : ''}`)
}

export async function fetchElectionDetail(id: string): Promise<ApiElectionDetail> {
  return apiFetch<ApiElectionDetail>(`/elections/${id}`)
}

export async function fetchElectionListResolved(
  params: FetchElectionListParams = {},
): Promise<ApiElectionListResponse> {
  if (isApiConfigured()) {
    try {
      const response = await fetchElectionList(params)
      if (response.elections.length > 0) {
        return {
          ...response,
          elections: await Promise.all(response.elections.map(hydrateElectionTotalSubmissions)),
        }
      }
    } catch {}
  }

  return fetchOnchainElectionList(params)
}

export async function fetchElectionDetailResolved(id: string): Promise<ApiElectionDetail> {
  if (isApiConfigured()) {
    try {
      return await hydrateElectionTotalSubmissions(await fetchElectionDetail(id))
    } catch {}
  }

  return fetchOnchainElectionDetail(id)
}
