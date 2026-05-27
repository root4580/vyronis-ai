import type { ChartVisionInput, ChartVisionResult } from "@/lib/coach/types"

const CACHE_TTL_MS = 15 * 60 * 1000
const MAX_CACHE_ENTRIES = 64

type CacheEntry = {
  result: ChartVisionResult
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

function buildCacheKey(input: ChartVisionInput): string {
  const context = input.plannedContext
  return [
    input.providerId || "heuristic",
    input.screenshotUrl,
    context.pair,
    context.direction,
    context.setup,
    context.confirmation_signal,
    context.entry_price,
    context.stop_loss,
    context.take_profit,
    context.higher_timeframe,
  ]
    .filter(Boolean)
    .join("|")
}

export function getCachedChartVision(input: ChartVisionInput): ChartVisionResult | null {
  const key = buildCacheKey(input)
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.result
}

export function setCachedChartVision(input: ChartVisionInput, result: ChartVisionResult): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value
    if (oldestKey) cache.delete(oldestKey)
  }
  cache.set(buildCacheKey(input), {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
}

export function clearChartVisionCache(): void {
  cache.clear()
}
