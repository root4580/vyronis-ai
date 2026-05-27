import type { CoachMtfTimeframe } from "@/lib/coach/mtf-constants"
import { enabledRuleLabels, rule } from "@/lib/strategy/playbook-rule-utils"
import type { StrategyPlaybookRecord } from "@/lib/strategy/types"

const TIMEFRAME_FOCUS: Record<CoachMtfTimeframe, string[]> = {
  weekly: [
    "Identify macro bias: is price bullish, bearish, or ranging?",
    "Mark major supply/demand or support/resistance zones.",
    "Note if price is near a major HTF zone (premium/discount, key S/R).",
    "Flag countertrend setups vs visible weekly structure.",
  ],
  daily: [
    "Confirm or challenge the Weekly bias.",
    "Look for continuation structure or early reversal signs.",
    "Identify fresh AOI zones (supply/demand, S/R, order block).",
    "Check whether price is pushing into liquidity or reacting from a zone.",
  ],
  h4: [
    "This is the main trade-bias timeframe — structure direction must be clear.",
    "Look for BOS / CHOCH and valid AOI: supply/demand, S/R, mitigation zone, or retest area.",
    "If H4 disagrees with Weekly or Daily bias, penalize score and add a warning.",
    "Countertrend entries vs HTF stack should be flagged.",
  ],
  h1: [
    "Setup formation timeframe — look for break and retest, liquidity sweep, EMA alignment, or clean pullback into AOI.",
    "H1 must support the H4 bias direction.",
    "If H1 is messy, choppy, or lacks structure, warn and lower entry quality.",
    "Do not reward anticipatory entries before M15 confirmation.",
  ],
  m15: [
    "Entry confirmation timeframe — entry should happen ONLY after confirmation.",
    "Look for candle close confirmation, rejection wick, or clean trigger aligned with H1/H4.",
    "Penalize impulse/expansion entries and entries before confirmation close.",
    "Protect the trader from FOMO, early entries, and countertrend triggers.",
  ],
}

function collectEnabledRules(playbook: StrategyPlaybookRecord): string[] {
  return [
    ...enabledRuleLabels([
      playbook.bias_rules.weekly_bias,
      playbook.bias_rules.daily_bias,
      playbook.bias_rules.h4_structure,
      playbook.bias_rules.htf_alignment,
    ]),
    ...enabledRuleLabels([
      playbook.entry_rules.h1_setup,
      playbook.entry_rules.m15_confirmation,
      playbook.entry_rules.aoi_supply_demand,
      playbook.entry_rules.break_and_retest,
      playbook.entry_rules.ema_alignment,
      playbook.entry_rules.liquidity_sweep,
      playbook.entry_rules.candle_confirmation,
    ]),
    ...enabledRuleLabels(playbook.confluence_rules.items),
  ]
}

export function buildPlaybookVisionPromptSection(
  playbook: StrategyPlaybookRecord | null | undefined,
  timeframe: CoachMtfTimeframe,
): string {
  if (!playbook) return ""

  const focus = TIMEFRAME_FOCUS[timeframe]
  const enabledRules = collectEnabledRules(playbook)
  const forbidden = playbook.forbidden_conditions.items.slice(0, 8)
  const customInvalidations = playbook.invalidation_rules.custom.slice(0, 6)

  return [
    "",
    `Strategy playbook: ${playbook.strategy_name}`,
    playbook.description,
    "",
    `Timeframe role (${timeframe.toUpperCase()}):`,
    ...focus.map((line) => `- ${line}`),
    "",
    "Enabled playbook rules to evaluate on this chart:",
    ...enabledRules.map((label) => `- ${label}`),
    "",
    `Minimum R:R target: ${playbook.rr_minimum}:1`,
    forbidden.length > 0 ? `Forbidden: ${forbidden.join("; ")}` : "",
    customInvalidations.length > 0
      ? `Invalidations to warn on: ${customInvalidations.join("; ")}`
      : "",
    playbook.example_notes.winner_notes
      ? `Good trade example: ${playbook.example_notes.winner_notes}`
      : "",
    playbook.example_notes.loser_notes
      ? `Bad trade example: ${playbook.example_notes.loser_notes}`
      : "",
    "",
    "Score conservatively. Add warnings for early entry, FOMO, countertrend, missing confirmation, H4/HTF conflict, or choppy H1 structure.",
  ]
    .filter(Boolean)
    .join("\n")
}
