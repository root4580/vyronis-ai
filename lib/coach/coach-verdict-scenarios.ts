import type { VisualAnalysisAggregate, VisualAnalysisResult } from "@/lib/coach/visual-analysis-types"
import type { MtfAnalysisResult } from "@/lib/coach/mtf-types"
import type { CoachDisciplineInput } from "@/lib/coach/coach-discipline-gate"
import type { CoachFinalVerdict } from "@/lib/coach/coach-execution-verdict"
import { evaluatePrecisionFlow } from "@/lib/coach/precision-flow-engine"
import type { StrategyPlaybookMatchResult } from "@/lib/strategy/types"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"

export type CoachVerdictScenario = {
  id: number
  name: string
  description: string
  context: PreTradePlannedContext
  mtf: MtfAnalysisResult
  playbook: StrategyPlaybookMatchResult
  discipline?: CoachDisciplineInput
  responses?: Record<string, string>
  expectedVerdict: CoachFinalVerdict
  acceptableVerdicts?: CoachFinalVerdict[]
}

function visualAggregate(overrides?: Partial<VisualAnalysisAggregate>): VisualAnalysisAggregate {
  return {
    overallBias: "bullish",
    biasAlignmentScore: 92,
    entryConfirmationScore: 85,
    h1SetupQuality: 95,
    m15EntryQuality: 88,
    trendStrength: 82,
    bosDetected: true,
    chochDetected: false,
    liquiditySweepDetected: false,
    emaAlignmentScore: 82,
    supplyDemandPresent: true,
    confirmationQuality: 85,
    countertrend: false,
    rrQuality: 88,
    entryQuality: 88,
    visionScore: 94,
    confidenceScore: 90,
    tradeQualityScore: 94,
    tradeQualityGrade: "A",
    recommendation: "TAKE",
    shouldTake: "yes",
    warnings: [],
    strengths: ["HTF aligned"],
    summary: "A+ visual read.",
    ...overrides,
  }
}

function visualAnalysis(overrides?: Partial<VisualAnalysisAggregate>): VisualAnalysisResult {
  return {
    version: 1,
    provider: "heuristic",
    analyzedAt: new Date().toISOString(),
    chartsAnalyzed: 5,
    chartsRequested: 5,
    timeframes: {},
    aggregate: visualAggregate(overrides),
  }
}

function basePlaybook(overrides?: Partial<StrategyPlaybookMatchResult>): StrategyPlaybookMatchResult {
  return {
    version: 2,
    playbookId: "test-playbook",
    strategyName: "Multi-Timeframe FX Continuation Setup",
    matchScore: 98,
    setupQualityScore: 100,
    ruleAdherenceScore: 95,
    executionTimingScore: 90,
    setupGrade: "A",
    recommendation: "TAKE",
    rulesPassed: ["HTF aligned", "AOI valid", "EMA aligned"],
    rulesFailed: [],
    missingConfirmations: [],
    violations: [],
    summary: "A+ playbook match for test scenario.",
    evaluatedAt: new Date().toISOString(),
    detections: {
      htfConflict: false,
      countertrend: false,
      earlyEntry: false,
      emotionalRisk: false,
      fomoEntry: false,
      revengeEntry: false,
      overextendedEntry: false,
      beforeConfirmationClose: false,
      noLiquidityConfirmation: false,
    },
    visionContext: {
      signals: { emaAligned: true },
    },
    ...overrides,
  }
}

function baseMtf(overrides?: Partial<MtfAnalysisResult>): MtfAnalysisResult {
  return {
    version: 2,
    bias: {
      weeklyBias: "bullish",
      dailyBias: "bullish",
      h4Bias: "bullish",
      overallBias: "bullish",
      biasAlignmentScore: 92,
      biasWarnings: [],
    },
    entry: {
      h1SetupQuality: 95,
      m15EntryQuality: 88,
      entryConfirmationScore: 85,
      entryWarnings: [],
      entryStrengths: ["Clean M15 structure"],
    },
    chartsProvided: 5,
    chartsMissing: [],
    confidencePenalty: 0,
    overallScore: 94,
    visionScore: 94,
    recommendation: "TAKE",
    summary: "A+ multi-timeframe read.",
    analyzedAt: new Date().toISOString(),
    visualAnalysis: visualAnalysis(),
    ...overrides,
  }
}

function baseContext(overrides?: Partial<PreTradePlannedContext>): PreTradePlannedContext {
  return {
    pair: "EURUSD",
    direction: "LONG",
    session: "London",
    entry_price: "1.0850",
    stop_loss: "1.0820",
    take_profit: "1.0910",
    confirmation_signal: "BOS + retest",
    higher_timeframe: "H4 bullish",
    entry_timeframe: "H1",
    confirmation_timeframe: "M15",
    visual_analysis: visualAnalysis(),
    ...overrides,
  }
}

export const COACH_VERDICT_SCENARIOS: CoachVerdictScenario[] = [
  {
    id: 1,
    name: "A+ setup, all rules passed",
    description: "Perfect technical and discipline read.",
    context: baseContext(),
    mtf: baseMtf(),
    playbook: basePlaybook(),
    expectedVerdict: "A_PLUS_READY",
  },
  {
    id: 2,
    name: "A+ setup, M15 confirmation missing",
    description: "Setup elite but confirmation candle not closed.",
    context: baseContext({
      confirmation_signal: "",
      visual_analysis: visualAnalysis({ confirmationQuality: 40, bosDetected: false }),
    }),
    mtf: baseMtf({
      entry: {
        h1SetupQuality: 95,
        m15EntryQuality: 55,
        entryConfirmationScore: 48,
        entryWarnings: ["M15 confirmation incomplete"],
        entryStrengths: [],
      },
      visualAnalysis: visualAnalysis({ confirmationQuality: 40, bosDetected: false }),
    }),
    playbook: basePlaybook({
      missingConfirmations: ["Confirmation candle on M15"],
      detections: {
        htfConflict: false,
        countertrend: false,
        earlyEntry: false,
        emotionalRisk: false,
        fomoEntry: false,
        revengeEntry: false,
        overextendedEntry: false,
        beforeConfirmationClose: true,
        noLiquidityConfirmation: false,
      },
    }),
    expectedVerdict: "WAIT_FOR_CONFIRMATION",
  },
  {
    id: 3,
    name: "A+ setup, session invalid",
    description: "Outside London/NY liquidity window.",
    context: baseContext({ session: "Asian" }),
    mtf: baseMtf(),
    playbook: basePlaybook(),
    expectedVerdict: "SKIP_TRADE",
  },
  {
    id: 4,
    name: "A+ setup, RR below 1:2",
    description: "Reward does not justify risk.",
    context: baseContext({
      entry_price: "1.0850",
      stop_loss: "1.0820",
      take_profit: "1.0865",
    }),
    mtf: baseMtf(),
    playbook: basePlaybook(),
    expectedVerdict: "SKIP_TRADE",
  },
  {
    id: 5,
    name: "HTF bias not aligned",
    description: "Mixed HTF stack — no directional edge.",
    context: baseContext(),
    mtf: baseMtf({
      bias: {
        weeklyBias: "bullish",
        dailyBias: "bearish",
        h4Bias: "mixed",
        overallBias: "mixed",
        biasAlignmentScore: 42,
        biasWarnings: ["Daily conflicts with weekly"],
      },
    }),
    playbook: basePlaybook({
      detections: {
        htfConflict: true,
        countertrend: false,
        earlyEntry: false,
        emotionalRisk: false,
        fomoEntry: false,
        revengeEntry: false,
        overextendedEntry: false,
        beforeConfirmationClose: false,
        noLiquidityConfirmation: false,
      },
    }),
    expectedVerdict: "SKIP_TRADE",
  },
  {
    id: 6,
    name: "AOI invalidated",
    description: "No valid zone — prices missing.",
    context: baseContext({
      entry_price: "",
      stop_loss: "",
      take_profit: "",
      visual_analysis: visualAnalysis({ supplyDemandPresent: false }),
    }),
    mtf: baseMtf({
      visualAnalysis: visualAnalysis({ supplyDemandPresent: false }),
    }),
    playbook: basePlaybook({
      rulesPassed: ["HTF aligned"],
    }),
    expectedVerdict: "SKIP_TRADE",
  },
  {
    id: 7,
    name: "Confirmation present, EMA rule failed",
    description: "Trigger logged but price below EMA gate.",
    context: baseContext({
      visual_analysis: visualAnalysis({ emaAlignmentScore: 38 }),
    }),
    mtf: baseMtf({
      visualAnalysis: visualAnalysis({ emaAlignmentScore: 38 }),
    }),
    playbook: basePlaybook({
      rulesPassed: ["HTF aligned", "AOI valid"],
      visionContext: { signals: { emaAligned: false } },
    }),
    expectedVerdict: "WAIT_FOR_CONFIRMATION",
    acceptableVerdicts: ["WAIT_FOR_CONFIRMATION", "SKIP_TRADE"],
  },
  {
    id: 8,
    name: "Perfect setup outside trading hours",
    description: "Technical A+ but session outside playbook window.",
    context: baseContext({ session: "Sydney" }),
    mtf: baseMtf(),
    playbook: basePlaybook(),
    expectedVerdict: "SKIP_TRADE",
  },
  {
    id: 9,
    name: "All rules passed, weekly trade limit reached",
    description: "Technical gate clear but chapter cap hit.",
    context: baseContext(),
    mtf: baseMtf(),
    playbook: basePlaybook(),
    discipline: {
      weeklyTradesTaken: 2,
      maxTradesPerWeek: 2,
    },
    expectedVerdict: "TRADE_LIMIT_REACHED",
  },
  {
    id: 10,
    name: "All technical rules passed, revenge emotion",
    description: "Process warning before live size.",
    context: baseContext(),
    mtf: baseMtf(),
    playbook: basePlaybook(),
    responses: { emotional_state: "Revenge" },
    discipline: {
      emotionalState: "Revenge",
      strictEmotionGate: false,
    },
    expectedVerdict: "COACH_WARNING",
    acceptableVerdicts: ["COACH_WARNING", "SKIP_TRADE"],
  },
]

export function buildPrecisionFlowForScenario(scenario: CoachVerdictScenario) {
  return evaluatePrecisionFlow({
    context: {
      ...scenario.context,
      mtf_analysis: scenario.mtf,
      playbook_match: scenario.playbook,
    },
    responses: scenario.responses ?? { emotional_state: "Calm" },
  })
}
