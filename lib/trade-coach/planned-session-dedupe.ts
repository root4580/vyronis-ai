import type { PlannedCoachSessionItem } from "@/lib/trade-coach/types"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"

export function plannedSessionDedupeKey(context: PreTradePlannedContext): string {
  if (context.trade_plan_id?.trim()) {
    return `plan:${context.trade_plan_id.trim()}`
  }
  if (context.tradingview_signal_id?.trim()) {
    return `tv:${context.tradingview_signal_id.trim()}`
  }
  const pair = context.pair?.trim().toUpperCase() ?? ""
  const direction = context.direction?.trim().toUpperCase() ?? ""
  const date = context.trade_date?.trim() ?? ""
  return `manual:${pair}|${direction}|${date}`
}

export function plannedSessionDedupeKeyFromItem(session: PlannedCoachSessionItem): string {
  if (session.trade_plan_id?.trim()) {
    return `plan:${session.trade_plan_id.trim()}`
  }
  if (session.tradingview_signal_id?.trim()) {
    return `tv:${session.tradingview_signal_id.trim()}`
  }
  const pair = session.pair?.trim().toUpperCase() ?? ""
  const direction = session.direction?.trim().toUpperCase() ?? ""
  const date = session.trade_date?.trim() ?? ""
  return `manual:${pair}|${direction}|${date}`
}

/**
 * Keep at most one in-progress and one completed session per plan/signal/manual key.
 * Sessions are assumed newest-first; first match per bucket wins.
 */
export function dedupePlannedCoachSessions(
  sessions: PlannedCoachSessionItem[],
): PlannedCoachSessionItem[] {
  const buckets = new Map<
    string,
    { in_progress?: PlannedCoachSessionItem; completed?: PlannedCoachSessionItem }
  >()

  for (const session of sessions) {
    const key = plannedSessionDedupeKeyFromItem(session)
    const bucket = buckets.get(key) ?? {}

    if (session.status === "in_progress" && !bucket.in_progress) {
      bucket.in_progress = session
    } else if (session.status === "completed" && !bucket.completed) {
      bucket.completed = session
    }

    buckets.set(key, bucket)
  }

  const deduped: PlannedCoachSessionItem[] = []
  for (const bucket of buckets.values()) {
    if (bucket.completed) deduped.push(bucket.completed)
    if (bucket.in_progress) deduped.push(bucket.in_progress)
  }

  return deduped.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )
}
