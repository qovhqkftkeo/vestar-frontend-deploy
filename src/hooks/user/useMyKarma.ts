import { useCallback, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { getKarmaBalance } from '../../contracts/vestar/actions'
import type { KarmaEvent } from '../../types/user'

export interface UseMyKarmaResult {
  events: KarmaEvent[]
  total: number
  isLoading: boolean
  error: Error | undefined
  refetch: () => void
}

export function useMyKarma(): UseMyKarmaResult {
  const { address, isConnected } = useAccount()
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>(undefined)

  const fetchKarma = useCallback(async () => {
    if (!isConnected || !address) {
      setTotal(0)
      setIsLoading(false)
      setError(undefined)
      return
    }

    setIsLoading(true)
    setError(undefined)

    try {
      const balance = await getKarmaBalance(address)
      setTotal(Number(balance))
    } catch (err) {
      setTotal(0)
      setError(err instanceof Error ? err : new Error('Failed to fetch karma balance'))
    } finally {
      setIsLoading(false)
    }
  }, [address, isConnected])

  useEffect(() => {
    fetchKarma()
  }, [fetchKarma])

  return { events: [], total, isLoading, error, refetch: fetchKarma }
}
