export const TRADES_CACHE_KEY = "vyronis-trades-cache"
export const TRADES_LOAD_TIMEOUT_MS = 10000

type TradesCacheEnvelope<T> = {
  userId: string
  trades: T[]
  updatedAt: string
}

function isEnvelope<T>(value: unknown): value is TradesCacheEnvelope<T> {
  if (!value || typeof value !== "object") return false
  const record = value as TradesCacheEnvelope<T>
  return typeof record.userId === "string" && Array.isArray(record.trades)
}

/** Never returns trades unless cache belongs to the given user. */
export function readCachedTrades<T>(userId: string | null | undefined): T[] {
  if (!userId || typeof window === "undefined") return []

  try {
    const raw = sessionStorage.getItem(TRADES_CACHE_KEY)
    if (!raw) return []

    const parsed: unknown = JSON.parse(raw)
    if (!isEnvelope<T>(parsed)) {
      sessionStorage.removeItem(TRADES_CACHE_KEY)
      return []
    }

    if (parsed.userId !== userId) return []
    return parsed.trades
  } catch {
    sessionStorage.removeItem(TRADES_CACHE_KEY)
    return []
  }
}

export function writeCachedTrades<T>(userId: string, trades: T[]) {
  if (!userId || typeof window === "undefined") return

  const envelope: TradesCacheEnvelope<T> = {
    userId,
    trades,
    updatedAt: new Date().toISOString(),
  }
  sessionStorage.setItem(TRADES_CACHE_KEY, JSON.stringify(envelope))
}

export function clearCachedTrades() {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(TRADES_CACHE_KEY)
}
