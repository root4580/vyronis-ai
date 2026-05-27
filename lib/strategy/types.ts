import type { MtfAnalysisResult, MtfScreenshotMap } from "@/lib/coach/mtf-types"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import type {
  TradeQualityGrade,
  TradeQualityRecommendation,
} from "@/lib/trade-coach/trade-quality-engine"

export type PlaybookRuleItem = {
  id: string
  label: string
  enabled: boolean
  required: boolean
}

export type StrategyPlaybookBiasRules = {
  weekly_bias: PlaybookRuleItem
  daily_bias: PlaybookRuleItem
  h4_structure: PlaybookRuleItem
  htf_alignment: PlaybookRuleItem
}

export type StrategyPlaybookEntryRules = {
  h1_setup: PlaybookRuleItem
  m15_confirmation: PlaybookRuleItem
  aoi_supply_demand: PlaybookRuleItem
  break_and_retest: PlaybookRuleItem
  ema_alignment: PlaybookRuleItem
  liquidity_sweep: PlaybookRuleItem
  candle_confirmation: PlaybookRuleItem
}

export type StrategyPlaybookInvalidationRules = {
  countertrend_warning: PlaybookRuleItem
  no_confirmation_warning: PlaybookRuleItem
  early_entry_warning: PlaybookRuleItem
  custom: string[]
}

export type StrategyPlaybookConfluenceRules = {
  items: PlaybookRuleItem[]
}

export type StrategyPlaybookForbiddenConditions = {
  items: string[]
}

export type StrategyPlaybookExampleNotes = {
  winner_notes: string
  loser_notes: string
}

export type StrategyPlaybookRecord = {
  id: string
  user_id: string
  strategy_name: string
  description: string
  bias_rules: StrategyPlaybookBiasRules
  entry_rules: StrategyPlaybookEntryRules
  invalidation_rules: StrategyPlaybookInvalidationRules
  confluence_rules: StrategyPlaybookConfluenceRules
  forbidden_conditions: StrategyPlaybookForbiddenConditions
  rr_minimum: number
  example_notes: StrategyPlaybookExampleNotes
  is_default: boolean
  created_at: string
  updated_at: string
}

export type StrategyPlaybookInput = Omit<
  StrategyPlaybookRecord,
  "id" | "user_id" | "created_at" | "updated_at"
>

export type StrategyPlaybookMatchResult = {
  version: 1 | 2
  playbookId: string
  strategyName: string
  matchScore: number
  setupQualityScore?: number
  ruleAdherenceScore?: number
  executionTimingScore?: number
  setupGrade: TradeQualityGrade
  recommendation: TradeQualityRecommendation
  rulesPassed: string[]
  rulesFailed: string[]
  missingConfirmations: string[]
  violations: string[]
  summary: string
  evaluatedAt: string
  detections?: {
    htfConflict: boolean
    countertrend: boolean
    earlyEntry: boolean
    emotionalRisk: boolean
    fomoEntry: boolean
    revengeEntry: boolean
    overextendedEntry: boolean
    beforeConfirmationClose: boolean
    noLiquidityConfirmation: boolean
  }
  /** Serialized for OpenAI Vision context later */
  visionContext: Record<string, unknown>
}

export type EvaluateStrategyPlaybookInput = {
  playbook: StrategyPlaybookRecord
  mtfAnalysis: MtfAnalysisResult
  context: PreTradePlannedContext
  screenshots: MtfScreenshotMap
  visualAnalysis?: import("@/lib/coach/visual-analysis-types").VisualAnalysisResult | null
}
