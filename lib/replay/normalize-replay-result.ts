import { enrichExecutionReplayResult } from "@/lib/replay/execution-replay-engine"
import type { ExecutionReplayResult } from "@/lib/replay/types"

/** Backfill cinematic replay fields for older cached/API payloads. */
export function normalizeExecutionReplay(payload: ExecutionReplayResult): ExecutionReplayResult {
  return enrichExecutionReplayResult(payload)
}
