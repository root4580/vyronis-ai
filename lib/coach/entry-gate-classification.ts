import type { EntryGateRuleId } from "@/lib/coach/entry-gate"

/** Failures that invalidate the trade — not a timing wait. */
export const HARD_SKIP_ENTRY_GATE_RULES = new Set<EntryGateRuleId>([
  "htf_bias",
  "aoi_valid",
  "session_valid",
  "risk_reward",
])

/** Failures where the setup may be valid but entry trigger is incomplete. */
export const SOFT_WAIT_ENTRY_GATE_RULES = new Set<EntryGateRuleId>([
  "confirmation_present",
  "ema_rule",
])

export function isHardSkipEntryGateRule(ruleId: EntryGateRuleId): boolean {
  return HARD_SKIP_ENTRY_GATE_RULES.has(ruleId)
}
