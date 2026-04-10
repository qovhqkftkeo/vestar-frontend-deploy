import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMyKarma } from './useMyKarma'

const TEST_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678' as const

const mockUseAccount = vi.fn<() => { address: string | undefined; isConnected: boolean }>()

vi.mock('wagmi', () => ({
  useAccount: () => mockUseAccount(),
}))

const mockGetKarmaBalance = vi.fn<(address: string) => Promise<bigint>>()

vi.mock('../../contracts/vestar/actions', () => ({
  getKarmaBalance: (address: string) => mockGetKarmaBalance(address),
}))

describe('useMyKarma', () => {
  beforeEach(() => {
    mockUseAccount.mockReturnValue({ address: undefined, isConnected: false })
    mockGetKarmaBalance.mockReset()
    mockGetKarmaBalance.mockResolvedValue(0n)
  })

  it('returns 0 karma when wallet is not connected', async () => {
    mockUseAccount.mockReturnValue({ address: undefined, isConnected: false })

    const { result } = renderHook(() => useMyKarma())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.total).toBe(0)
    expect(mockGetKarmaBalance).not.toHaveBeenCalled()
  })

  it('fetches on-chain karma balance when wallet is connected', async () => {
    mockUseAccount.mockReturnValue({ address: TEST_ADDRESS, isConnected: true })
    mockGetKarmaBalance.mockResolvedValue(490n)

    const { result } = renderHook(() => useMyKarma())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(mockGetKarmaBalance).toHaveBeenCalledWith(TEST_ADDRESS)
    expect(result.current.total).toBe(490)
  })

  it('returns 0 gracefully when on-chain call fails', async () => {
    mockUseAccount.mockReturnValue({ address: TEST_ADDRESS, isConnected: true })
    mockGetKarmaBalance.mockRejectedValue(new Error('RPC timeout'))

    const { result } = renderHook(() => useMyKarma())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.total).toBe(0)
    expect(result.current.error).toBeDefined()
  })

  it('exposes loading state while fetching', async () => {
    mockUseAccount.mockReturnValue({ address: TEST_ADDRESS, isConnected: true })
    mockGetKarmaBalance.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(100n), 100)),
    )

    const { result } = renderHook(() => useMyKarma())

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.total).toBe(100)
  })

  it('handles zero karma balance from chain', async () => {
    mockUseAccount.mockReturnValue({ address: TEST_ADDRESS, isConnected: true })
    mockGetKarmaBalance.mockResolvedValue(0n)

    const { result } = renderHook(() => useMyKarma())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.total).toBe(0)
  })

  it('handles large karma values', async () => {
    mockUseAccount.mockReturnValue({ address: TEST_ADDRESS, isConnected: true })
    mockGetKarmaBalance.mockResolvedValue(100_000_000n)

    const { result } = renderHook(() => useMyKarma())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.total).toBe(100_000_000)
  })
})
