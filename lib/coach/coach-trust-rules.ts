import { INSUFFICIENT_HISTORY_MESSAGE, MIN_PATTERN_PERCENT_CLAIM_TRADES } from "@/lib/analytics/insight-thresholds"
import type { PatternMemoryResult } from "@/lib/trade-coach/pattern-memory"

/** Shared integrity rules for Vyronis Coach and Companion LLM surfaces. */
export const COACH_DATA_INTEGRITY_RULES = `DATA INTEGRITY (non-negotiable):
- Never invent or assume: risk %, risk:reward, liquidity sweep, CHoCH, BOS, entry mismatch, or rule violations.
- If a field is missing from journal or uploaded chart analysis, say "Not verified from journal data." — never penalize or warn as if the trader failed.
- Never convert missing data into a warning, penalty, or accusation.
- Percentage claims (e.g. "88% of trades") require at least ${MIN_PATTERN_PERCENT_CLAIM_TRADES} logged trades with verified tags — otherwise say: "${INSUFFICIENT_HISTORY_MESSAGE}"
- Risk % must come from saved journal risk_percent only — never default to 1% or guess.
- Risk:reward priority: journal risk_reward → rr field → calculated entry/stop/target → otherwise not verified.
- Liquidity sweep, CHoCH, BOS: only YES when explicitly logged or clearly read from chart vision; NO only when trader marked absent; otherwise NOT VERIFIED.
- Rule language: use "Rule gap detected" or "Risk discipline was not fully aligned" — never "You broke your rules."`

export const COMPANION_PRE_TRADE_GUIDE = `PRE-TRADE MODE (before entry):
- You may recommend: wait for confirmation, reduce size, avoid entry, better RR needed, HTF misaligned.
- Lead with process and journal evidence — not predictions.
- Every claim must trace to trader context, vision data, or logged fields.`

export const COMPANION_POST_TRADE_GUIDE = `POST-TRADE MODE (closed trade review):
- Never say: reduce size, wait for confirmation, don't enter, avoid this trade, stand down.
- Structure: Post-trade verdict → what went well → rules followed → rules missed → what was not verified → one improvement → repeatability.
- Grade separately: Strategy, Execution, Psychology — never blend into one vague score.
- Mentor tone only — review execution, do not re-gate entry.`

export function formatTopMistakeForPrompt(input: {
  label: string
  frequency: string
  patternMemory?: PatternMemoryResult
}): string {
  const tradeCount = input.patternMemory?.tradeCount ?? 0
  if (!input.patternMemory?.hasEnoughData || tradeCount < MIN_PATTERN_PERCENT_CLAIM_TRADES) {
    return `${input.label} (frequency: not enough journal history to establish a reliable pattern)`
  }
  return `${input.label} (${input.frequency}% of logged trades — ${tradeCount} trade sample)`
}

export function formatDisciplineScoreForPrompt(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) {
    return "Not verified from journal data"
  }
  return `${score}/100`
}
