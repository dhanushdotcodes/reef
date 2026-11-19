const store = new Map<string, unknown>()

/** Build once per key; used for procedural geometry keyed by (kind, variant, seed). */
export function memo<T>(key: string, build: () => T): T {
  let v = store.get(key) as T | undefined
  if (v === undefined) {
    v = build()
    store.set(key, v)
  }
  return v
}
