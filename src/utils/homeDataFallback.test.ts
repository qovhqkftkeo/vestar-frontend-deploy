import { describe, expect, it, vi } from 'vitest'
import {
  clearHomeBundleRecoveryAttempt,
  HOME_DATA_FALLBACK_DELAY_MS,
  recoverFromStaleHomeBundle,
  waitForHomeDataFallback,
} from './homeDataFallback'

describe('waitForHomeDataFallback', () => {
  it('waits only for the remaining fallback window', async () => {
    const wait = vi.fn().mockResolvedValue(undefined)

    await waitForHomeDataFallback(1_000, {
      now: () => 3_500,
      wait,
    })

    expect(wait).toHaveBeenCalledWith(HOME_DATA_FALLBACK_DELAY_MS - 2_500)
  })

  it('does not wait after the fallback window has already elapsed', async () => {
    const wait = vi.fn().mockResolvedValue(undefined)

    await waitForHomeDataFallback(1_000, {
      now: () => 9_000,
      wait,
    })

    expect(wait).not.toHaveBeenCalled()
  })
})

describe('recoverFromStaleHomeBundle', () => {
  function createDeps() {
    const flags = new Map<string, string>()
    const unregister = vi.fn().mockResolvedValue(true)
    const deleteCache = vi.fn().mockResolvedValue(true)
    const reload = vi.fn()

    return {
      clearFlag: (key: string) => flags.delete(key),
      deleteCache,
      flags,
      getCacheKeys: async () => ['workbox-precache', 'cdn-fonts'],
      getFlag: (key: string) => flags.get(key) ?? null,
      getRegistrations: async () => [{ unregister }],
      href: 'https://example.com/vote',
      isProd: true,
      now: () => 1_234,
      reload,
      setFlag: (key: string, value: string) => {
        flags.set(key, value)
      },
      unregister,
    }
  }

  it('unregisters service workers, clears caches, and reloads once', async () => {
    const deps = createDeps()

    const recovered = await recoverFromStaleHomeBundle(deps)

    expect(recovered).toBe(true)
    expect(deps.unregister).toHaveBeenCalledTimes(1)
    expect(deps.deleteCache).toHaveBeenCalledTimes(2)
    expect(deps.reload).toHaveBeenCalledTimes(1)
    expect(deps.reload.mock.calls[0][0]).toBe(
      'https://example.com/vote?__vestar_bundle_recovery=1234',
    )
  })

  it('skips repeated recovery attempts until the flag is cleared', async () => {
    const deps = createDeps()

    expect(await recoverFromStaleHomeBundle(deps)).toBe(true)
    expect(await recoverFromStaleHomeBundle(deps)).toBe(false)
    expect(deps.unregister).toHaveBeenCalledTimes(1)

    clearHomeBundleRecoveryAttempt(deps)

    expect(await recoverFromStaleHomeBundle(deps)).toBe(true)
    expect(deps.unregister).toHaveBeenCalledTimes(2)
  })
})
