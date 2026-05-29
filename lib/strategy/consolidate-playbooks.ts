import type { SupabaseClient } from "@supabase/supabase-js"
import {
  createVyronisStrategyPlaybookInput,
  isCanonicalStrategyName,
  VYRONIS_STRATEGY_NAME,
} from "@/lib/strategy/vyronis-strategy-playbook"
import type { StrategyPlaybookRecord } from "@/lib/strategy/types"

const GENERIC_NAME = /^strategy\s*\d+$/i

export function isGenericPlaybookName(name: string): boolean {
  const n = name.trim().toLowerCase()
  return GENERIC_NAME.test(n) || n === "strategy" || n === "my strategy"
}

export function shouldConsolidatePlaybooks(playbooks: StrategyPlaybookRecord[]): boolean {
  if (playbooks.length <= 1) {
    if (playbooks.length === 1) {
      const only = playbooks[0]
      return (
        isGenericPlaybookName(only.strategy_name) ||
        (!isCanonicalStrategyName(only.strategy_name) && !only.description.trim())
      )
    }
    return false
  }
  return true
}

export function pickKeeperPlaybook(playbooks: StrategyPlaybookRecord[]): StrategyPlaybookRecord {
  const byCanonical = playbooks.find((p) => isCanonicalStrategyName(p.strategy_name))
  if (byCanonical) return byCanonical

  const byDefault = playbooks.find((p) => p.is_default)
  if (byDefault) return byDefault

  return playbooks.reduce((best, row) => {
    const bestScore = best.description.length + (best.is_default ? 50 : 0)
    const rowScore = row.description.length + (row.is_default ? 50 : 0)
    return rowScore > bestScore ? row : best
  })
}

export async function reassignCoachSessionsToPlaybook(
  supabase: SupabaseClient,
  userId: string,
  fromIds: string[],
  keeperId: string,
  strategyName: string,
): Promise<void> {
  if (fromIds.length === 0) return

  const { data: sessions, error } = await supabase
    .from("trade_coach_sessions")
    .select("id, planned_context")
    .eq("user_id", userId)

  if (error || !sessions?.length) return

  const stale = new Set(fromIds)
  for (const session of sessions) {
    const ctx =
      session.planned_context && typeof session.planned_context === "object"
        ? (session.planned_context as Record<string, unknown>)
        : {}
    const pid = typeof ctx.strategy_playbook_id === "string" ? ctx.strategy_playbook_id : null
    if (!pid || !stale.has(pid)) continue

    await supabase
      .from("trade_coach_sessions")
      .update({
        planned_context: {
          ...ctx,
          strategy_playbook_id: keeperId,
          strategy_name: strategyName,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id)
      .eq("user_id", userId)
  }
}
