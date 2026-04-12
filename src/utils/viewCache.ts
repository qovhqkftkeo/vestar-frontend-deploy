type CacheEntry<T> = {
  updatedAt: number
  value: T
}

const viewCache = new Map<string, CacheEntry<unknown>>()

export function getViewCache<T>(key: string, maxAgeMs: number): T | null {
  const cached = viewCache.get(key)
  if (!cached) {
    return null
  }

  if (Date.now() - cached.updatedAt > maxAgeMs) {
    viewCache.delete(key)
    return null
  }

  return cached.value as T
}

export function setViewCache<T>(key: string, value: T) {
  viewCache.set(key, {
    updatedAt: Date.now(),
    value,
  })
}

export function invalidateViewCache(prefix?: string) {
  if (!prefix) {
    viewCache.clear()
    return
  }

  for (const key of viewCache.keys()) {
    if (key.startsWith(prefix)) {
      viewCache.delete(key)
    }
  }
}
