/** Short-lived, per-process public display cache; never use for authorization or checkout. */
export function cachePublicData<T>(read: () => Promise<T>, ttl: number, clock = Date.now) {
  let pending: Promise<T> | undefined
  let expiresAt = 0
  return async (): Promise<T> => {
    if (!pending || clock() >= expiresAt) {
      // Concurrent page renders share the same read. Start the TTL on success,
      // and retry failures rather than caching an empty or rejected catalogue.
      expiresAt = Infinity
      pending = Promise.resolve().then(read).then(value => {
        expiresAt = clock() + ttl
        return value
      }, error => {
        pending = undefined
        expiresAt = 0
        throw error
      })
    }
    // Listing consumers may sort or edit arrays; keep requests independent.
    return structuredClone(await pending)
  }
}
