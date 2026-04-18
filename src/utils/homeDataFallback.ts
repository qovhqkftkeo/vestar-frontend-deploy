export const HOME_DATA_FALLBACK_DELAY_MS = 7_000

const HOME_BUNDLE_RECOVERY_SESSION_KEY = 'vestar:home-bundle-recovery-attempted'

type HomeBundleRegistration = {
  unregister: () => Promise<boolean> | boolean
}

type HomeDataFallbackDeps = {
  clearFlag?: (key: string) => void
  deleteCache?: (key: string) => Promise<boolean> | boolean
  getCacheKeys?: () => Promise<string[]>
  getFlag?: (key: string) => string | null
  getRegistrations?: () => Promise<readonly HomeBundleRegistration[]>
  href?: string
  isProd?: boolean
  now?: () => number
  reload?: (href: string) => void
  setFlag?: (key: string, value: string) => void
  wait?: (ms: number) => Promise<void>
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })
}

function getSessionStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function resolveBrowserDeps(): HomeDataFallbackDeps {
  const storage = getSessionStorage()

  return {
    clearFlag: storage ? (key) => storage.removeItem(key) : undefined,
    deleteCache: typeof caches !== 'undefined' ? (key) => caches.delete(key) : undefined,
    getCacheKeys: typeof caches !== 'undefined' ? () => caches.keys() : undefined,
    getFlag: storage ? (key) => storage.getItem(key) : undefined,
    getRegistrations:
      typeof navigator !== 'undefined' && 'serviceWorker' in navigator
        ? () => navigator.serviceWorker.getRegistrations()
        : undefined,
    href: typeof window !== 'undefined' ? window.location.href : undefined,
    isProd: import.meta.env.PROD,
    now: () => Date.now(),
    reload: typeof window !== 'undefined' ? (href) => window.location.replace(href) : undefined,
    setFlag: storage ? (key, value) => storage.setItem(key, value) : undefined,
    wait: sleep,
  }
}

export async function waitForHomeDataFallback(startedAt: number, deps: HomeDataFallbackDeps = {}) {
  const now = deps.now ?? resolveBrowserDeps().now ?? Date.now
  const wait = deps.wait ?? resolveBrowserDeps().wait ?? sleep
  const remainingDelayMs = HOME_DATA_FALLBACK_DELAY_MS - (now() - startedAt)

  if (remainingDelayMs <= 0) {
    return
  }

  await wait(remainingDelayMs)
}

export function clearHomeBundleRecoveryAttempt(deps: HomeDataFallbackDeps = {}) {
  const clearFlag = deps.clearFlag ?? resolveBrowserDeps().clearFlag
  clearFlag?.(HOME_BUNDLE_RECOVERY_SESSION_KEY)
}

export async function recoverFromStaleHomeBundle(
  deps: HomeDataFallbackDeps = {},
): Promise<boolean> {
  const browserDeps = resolveBrowserDeps()
  const isProd = deps.isProd ?? browserDeps.isProd ?? false
  const now = deps.now ?? browserDeps.now ?? Date.now
  const getFlag = deps.getFlag ?? browserDeps.getFlag
  const setFlag = deps.setFlag ?? browserDeps.setFlag
  const clearFlag = deps.clearFlag ?? browserDeps.clearFlag
  const getRegistrations = deps.getRegistrations ?? browserDeps.getRegistrations
  const getCacheKeys = deps.getCacheKeys ?? browserDeps.getCacheKeys
  const deleteCache = deps.deleteCache ?? browserDeps.deleteCache
  const href = deps.href ?? browserDeps.href
  const reload = deps.reload ?? browserDeps.reload

  if (!isProd || !getFlag || !setFlag || !href || !reload) {
    return false
  }

  if (getFlag(HOME_BUNDLE_RECOVERY_SESSION_KEY)) {
    return false
  }

  setFlag(HOME_BUNDLE_RECOVERY_SESSION_KEY, String(now()))

  try {
    if (getRegistrations) {
      const registrations = await getRegistrations()
      await Promise.all(
        registrations.map((registration) =>
          Promise.resolve(registration.unregister()).catch(() => false),
        ),
      )
    }

    if (getCacheKeys && deleteCache) {
      const cacheKeys = await getCacheKeys()
      await Promise.all(
        cacheKeys.map((cacheKey) => Promise.resolve(deleteCache(cacheKey)).catch(() => false)),
      )
    }

    const nextUrl = new URL(href)
    nextUrl.searchParams.set('__vestar_bundle_recovery', String(now()))
    reload(nextUrl.toString())
    return true
  } catch {
    clearFlag?.(HOME_BUNDLE_RECOVERY_SESSION_KEY)
    return false
  }
}
