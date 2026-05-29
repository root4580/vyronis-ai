import type {
  PlaybookRuleItem,
  StrategyPlaybookBiasRules,
  StrategyPlaybookConfluenceRules,
  StrategyPlaybookEntryRules,
  StrategyPlaybookExampleNotes,
  StrategyPlaybookForbiddenConditions,
  StrategyPlaybookInput,
  StrategyPlaybookInvalidationRules,
} from "@/lib/strategy/types"
import { rule } from "@/lib/strategy/playbook-rule-utils"
import { createVyronisStrategyPlaybookInput } from "@/lib/strategy/vyronis-strategy-playbook"

export { rule } from "@/lib/strategy/playbook-rule-utils"

export function createDefaultBiasRules(): StrategyPlaybookBiasRules {
  return createVyronisStrategyPlaybookInput().bias_rules
}

export function createDefaultEntryRules(): StrategyPlaybookEntryRules {
  return createVyronisStrategyPlaybookInput().entry_rules
}

export function createDefaultInvalidationRules(): StrategyPlaybookInvalidationRules {
  return createVyronisStrategyPlaybookInput().invalidation_rules
}

export function createDefaultConfluenceRules(): StrategyPlaybookConfluenceRules {
  return {
    items: [
      rule("htf_bias", "HTF bias + structure agree across Weekly / Daily / H4"),
      rule("aoi_reaction", "Reaction from AOI / supply-demand zone"),
      rule("ltf_trigger", "M15 LTF trigger with candle close confirmation"),
    ],
  }
}

export function createDefaultForbiddenConditions(): StrategyPlaybookForbiddenConditions {
  return createVyronisStrategyPlaybookInput().forbidden_conditions
}

export function createDefaultExampleNotes(): StrategyPlaybookExampleNotes {
  return createVyronisStrategyPlaybookInput().example_notes
}

export function createDefaultPlaybookInput(
  strategyName?: string,
): StrategyPlaybookInput {
  const vyronis = createVyronisStrategyPlaybookInput()
  if (strategyName && strategyName !== vyronis.strategy_name) {
    return { ...vyronis, strategy_name: strategyName }
  }
  return vyronis
}

export function normalizePlaybookRuleItem(
  value: unknown,
  fallback: PlaybookRuleItem,
): PlaybookRuleItem {
  if (!value || typeof value !== "object") return fallback
  const record = value as Partial<PlaybookRuleItem>
  return {
    id: record.id || fallback.id,
    label: record.label || fallback.label,
    enabled: record.enabled ?? fallback.enabled,
    required: record.required ?? fallback.required,
  }
}

export function normalizeStrategyPlaybookInput(
  input: Partial<StrategyPlaybookInput>,
  fallbackName = "Multi-Timeframe FX Continuation Setup",
): StrategyPlaybookInput {
  const defaults = createDefaultPlaybookInput(fallbackName)
  const bias = (input.bias_rules || {}) as Partial<StrategyPlaybookBiasRules>
  const entry = (input.entry_rules || {}) as Partial<StrategyPlaybookEntryRules>
  const invalidation = (input.invalidation_rules || {}) as Partial<StrategyPlaybookInvalidationRules>

  return {
    strategy_name: input.strategy_name?.trim() || defaults.strategy_name,
    description: input.description ?? defaults.description,
    bias_rules: {
      weekly_bias: normalizePlaybookRuleItem(bias.weekly_bias, defaults.bias_rules.weekly_bias),
      daily_bias: normalizePlaybookRuleItem(bias.daily_bias, defaults.bias_rules.daily_bias),
      h4_structure: normalizePlaybookRuleItem(bias.h4_structure, defaults.bias_rules.h4_structure),
      htf_alignment: normalizePlaybookRuleItem(bias.htf_alignment, defaults.bias_rules.htf_alignment),
    },
    entry_rules: {
      h1_setup: normalizePlaybookRuleItem(entry.h1_setup, defaults.entry_rules.h1_setup),
      m15_confirmation: normalizePlaybookRuleItem(
        entry.m15_confirmation,
        defaults.entry_rules.m15_confirmation,
      ),
      aoi_supply_demand: normalizePlaybookRuleItem(
        entry.aoi_supply_demand,
        defaults.entry_rules.aoi_supply_demand,
      ),
      break_and_retest: normalizePlaybookRuleItem(
        entry.break_and_retest,
        defaults.entry_rules.break_and_retest,
      ),
      ema_alignment: normalizePlaybookRuleItem(entry.ema_alignment, defaults.entry_rules.ema_alignment),
      liquidity_sweep: normalizePlaybookRuleItem(
        entry.liquidity_sweep,
        defaults.entry_rules.liquidity_sweep,
      ),
      candle_confirmation: normalizePlaybookRuleItem(
        entry.candle_confirmation,
        defaults.entry_rules.candle_confirmation,
      ),
    },
    invalidation_rules: {
      countertrend_warning: normalizePlaybookRuleItem(
        invalidation.countertrend_warning,
        defaults.invalidation_rules.countertrend_warning,
      ),
      no_confirmation_warning: normalizePlaybookRuleItem(
        invalidation.no_confirmation_warning,
        defaults.invalidation_rules.no_confirmation_warning,
      ),
      early_entry_warning: normalizePlaybookRuleItem(
        invalidation.early_entry_warning,
        defaults.invalidation_rules.early_entry_warning,
      ),
      custom: Array.isArray(invalidation.custom)
        ? invalidation.custom.filter((item) => typeof item === "string" && item.trim())
        : defaults.invalidation_rules.custom,
    },
    confluence_rules: {
      items: Array.isArray(input.confluence_rules?.items)
        ? input.confluence_rules.items.map((item, index) =>
            normalizePlaybookRuleItem(
              item,
              defaults.confluence_rules.items[index] ||
                rule(`confluence_${index}`, "Confluence rule"),
            ),
          )
        : defaults.confluence_rules.items,
    },
    forbidden_conditions: {
      items: Array.isArray(input.forbidden_conditions?.items)
        ? input.forbidden_conditions.items.filter((item) => typeof item === "string" && item.trim())
        : defaults.forbidden_conditions.items,
    },
    rr_minimum:
      typeof input.rr_minimum === "number" && input.rr_minimum > 0
        ? input.rr_minimum
        : defaults.rr_minimum,
    example_notes: {
      winner_notes: input.example_notes?.winner_notes ?? defaults.example_notes.winner_notes,
      loser_notes: input.example_notes?.loser_notes ?? defaults.example_notes.loser_notes,
    },
    is_default: input.is_default ?? defaults.is_default,
  }
}

export function normalizeStrategyPlaybookRecord(
  row: Record<string, unknown>,
): import("@/lib/strategy/types").StrategyPlaybookRecord {
  const normalized = normalizeStrategyPlaybookInput(
    {
      strategy_name: String(row.strategy_name || "Multi-Timeframe FX Continuation Setup"),
      description: String(row.description || ""),
      bias_rules: row.bias_rules as StrategyPlaybookInput["bias_rules"],
      entry_rules: row.entry_rules as StrategyPlaybookInput["entry_rules"],
      invalidation_rules: row.invalidation_rules as StrategyPlaybookInput["invalidation_rules"],
      confluence_rules: row.confluence_rules as StrategyPlaybookInput["confluence_rules"],
      forbidden_conditions: row.forbidden_conditions as StrategyPlaybookInput["forbidden_conditions"],
      rr_minimum: Number(row.rr_minimum ?? 2),
      example_notes: row.example_notes as StrategyPlaybookInput["example_notes"],
      is_default: Boolean(row.is_default),
    },
    String(row.strategy_name || "Multi-Timeframe FX Continuation Setup"),
  )

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    ...normalized,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}
