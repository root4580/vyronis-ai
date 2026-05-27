export const TRADES_CACHE_KEY = "vyronis-trades-cache"
export const TRADES_LOAD_TIMEOUT_MS = 3000

export function readCachedTrades<T>(): T[] {
  if (typeof window === "undefined") return []

  try {
    const raw = sessionStorage.getItem(TRADES_CACHE_KEY)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

export function writeCachedTrades<T>(trades: T[]) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(TRADES_CACHE_KEY, JSON.stringify(trades))
}

export function clearCachedTrades() {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(TRADES_CACHE_KEY)
}
