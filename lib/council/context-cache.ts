import type { SupabaseClient } from "@supabase/supabase-js"
import { loadCouncilAgentContext } from "@/lib/council/context-service"
import type { CouncilAgentContext } from "@/lib/council/types"

const CACHE_TTL_MS = 45_000

type CacheEntry = {
  expiresAt: number
  value: CouncilAgentContext
}

const contextCache = new Map<string, CacheEntry>()

function cacheKey(userId: string, accountId: string): string {
  return `${userId}:${accountId}`
}

export async function loadCachedCouncilAgentContext(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<CouncilAgentContext> {
  const key = cacheKey(userId, accountId)
  const hit = contextCache.get(key)
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value
  }

  const value = await loadCouncilAgentContext(supabase, userId, accountId)
  contextCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value })
  return value
}

export function invalidateCouncilContextCache(userId: string, accountId: string): void {
  contextCache.delete(cacheKey(userId, accountId))
}
