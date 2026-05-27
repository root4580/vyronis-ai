import { rule } from "@/lib/strategy/playbook-rule-utils"
import type { StrategyPlaybookInput } from "@/lib/strategy/types"

export const VYRONIS_STRATEGY_NAME = "Top-Down AOI Strategy"

export const VYRONIS_STRATEGY_DESCRIPTION =
  "Top-down bias with clean structure, AOI, break/retest, and confirmation. Weekly → Daily → H4 for bias, H1 for setup, M15 for entry. Protect against early entries, FOMO, countertrend trades, and entries without confirmation."

export function createVyronisStrategyPlaybookInput(): StrategyPlaybookInput {
  return {
    strategy_name: VYRONIS_STRATEGY_NAME,
    description: VYRONIS_STRATEGY_DESCRIPTION,
    bias_rules: {
      weekly_bias: rule(
        "weekly_bias",
        "Weekly macro bias identified (bullish, bearish, or ranging) with major S/D or S/R marked",
      ),
      daily_bias: rule(
        "daily_bias",
        "Daily confirms or challenges Weekly bias with continuation or reversal structure",
      ),
      h4_structure: rule(
        "h4_structure",
        "H4 shows clear structure direction with BOS/CHOCH and a valid AOI (zone, mitigation, or retest)",
        true,
      ),
      htf_alignment: rule(
        "htf_alignment",
        "Weekly, Daily, and H4 bias agree — H4 must not conflict with Weekly/Daily",
        true,
      ),
    },
    entry_rules: {
      h1_setup: rule(
        "h1_setup",
        "H1 setup is clean — break/retest, liquidity sweep, EMA alignment, or pullback into AOI supporting H4",
        true,
      ),
      m15_confirmation: rule(
        "m15_confirmation",
        "M15 entry confirmation present — do not enter without M15 trigger",
        true,
      ),
      aoi_supply_demand: rule(
        "aoi_supply_demand",
        "Price reacting from AOI: supply/demand zone, S/R, mitigation zone, or retest area",
      ),
      break_and_retest: rule(
        "break_and_retest",
        "Break and retest structure preferred on H1 or M15",
      ),
      ema_alignment: rule("ema_alignment", "EMA stack supports planned trade direction"),
      liquidity_sweep: rule(
        "liquidity_sweep",
        "Liquidity sweep or stop hunt visible before entry",
      ),
      candle_confirmation: rule(
        "candle_confirmation",
        "M15 candle close confirmation required before entry (no anticipatory entries)",
        true,
      ),
    },
    invalidation_rules: {
      countertrend_warning: rule(
        "countertrend_warning",
        "Countertrend vs HTF bias — stand down",
        true,
      ),
      no_confirmation_warning: rule(
        "no_confirmation_warning",
        "No M15 confirmation candle close before entry",
        true,
      ),
      early_entry_warning: rule(
        "early_entry_warning",
        "Early entry — M15 trigger before H1 setup is ready",
        true,
      ),
      custom: [
        "Entering before M15 confirmation candle close",
        "Entering after expansion / impulse displacement move",
        "H4 structure conflicts with Weekly or Daily bias",
        "H1 chart is messy or choppy — no clean setup",
        "No AOI reaction or liquidity confluence present",
        "FOMO entry without full top-down alignment",
      ],
    },
    confluence_rules: {
      items: [
        rule("htf_bias", "HTF bias + structure agree across Weekly / Daily / H4"),
        rule("aoi_reaction", "Reaction from AOI / supply-demand zone"),
        rule("ltf_trigger", "M15 LTF trigger with candle close confirmation"),
      ],
    },
    forbidden_conditions: {
      items: [
        "Entering before M15 confirmation close",
        "Trading against Weekly/Daily/H4 bias",
        "Emotional FOMO or revenge entries",
        "Poor risk-to-reward below minimum",
        "Entering after expansion or impulse move",
        "No liquidity sweep or AOI confluence",
        "Countertrend entry vs HTF structure",
        "Early entry before H1 setup completes",
      ],
    },
    rr_minimum: 2,
    example_notes: {
      winner_notes:
        "Weekly/Daily/H4 aligned, H4 AOI with BOS, H1 clean break-and-retest into zone, M15 candle close confirmation after liquidity sweep, 1:2+ RR.",
      loser_notes:
        "Countertrend vs H4, H1 choppy with no AOI reaction, entered on M15 before confirmation close, FOMO after expansion move.",
    },
    is_default: true,
  }
}
