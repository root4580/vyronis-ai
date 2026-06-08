import type { SupabaseClient } from "@supabase/supabase-js"
import { loadCouncilAgentContext } from "@/lib/council/context-service"
import type { CouncilDataScope } from "@/lib/council/data-scope"
import type { CouncilAgentContext } from "@/lib/council/types"

const CACHE_TTL_MS = 45_000

type CacheEntry = {
  expiresAt: number
  value: CouncilAgentContext
}

const contextCache = new Map<string, CacheEntry>()

function cacheKey(userId: string, accountId: string, dataScope: CouncilDataScope): string {
  return `${userId}:${accountId}:${dataScope}`
}

export async function loadCachedCouncilAgentContext(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  dataScope: CouncilDataScope = "all_time",
): Promise<CouncilAgentContext> {
  const key = cacheKey(userId, accountId, dataScope)
  const hit = contextCache.get(key)
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value
  }

  const value = await loadCouncilAgentContext(supabase, userId, accountId, { dataScope })
  contextCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value })
  return value
}

export async function loadCachedCouncilVisualContext(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
) {
  const context = await loadCachedCouncilAgentContext(supabase, userId, accountId)
  return context.visual ?? null
}

export function invalidateCouncilContextCache(userId: string, accountId: string): void {
  contextCache.delete(cacheKey(userId, accountId, "all_time"))
  contextCache.delete(cacheKey(userId, accountId, "this_week"))
  contextCache.delete(cacheKey(userId, accountId, "last_trades"))
}
