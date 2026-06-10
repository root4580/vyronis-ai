import { generateCoachInsightWithProvider } from "@/lib/ai/providers"
import {
  buildConversationalMessage,
  enforceCoachTone,
  pickJournalDataPoint,
} from "@/lib/coach/coach-tone-engine"
import {
  resolveCoachExecutionVerdict,
  type CoachExecutionVerdict,
} from "@/lib/coach/coach-execution-verdict"
import type { PrecisionFlowResult, VyronisCoachVerdict } from "@/lib/coach/precision-flow-engine"
import {
  buildVyronisCoachTraderContext,
  type VyronisCoachTraderContext,
} from "@/lib/coach/vyronis-coach-trader-context"
import { buildVyronisCoachSystemPrompt } from "@/lib/coach/vyronis-coach-system-prompt"
import type { PatternMemoryResult } from "@/lib/trade-coach/pattern-memory"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"
import type { TradeRiskGuardHistoryTrade } from "@/lib/trade-risk-guard"
import type { UserSettingsForm } from "@/lib/user-settings"

export type VyronisCoachDeepAnalysis = {
  trend_direction: string
  htf_ema_alignment: string
  confirmation_quality: string
  risk_reward_structure: string
  breakout_vs_retest: string
  volatility: string
  overextended_entry: boolean
  counter_trend_risk: string
}

export type VyronisCoachResponse = {
  verdict: VyronisCoachVerdict
  setup_score: number
  state_score: number
  risk_level: "LOW" | "MEDIUM" | "HIGH"
  confidence: number
  summary: string
  why_it_passes: string[]
  warnings: string[]
  journal_cross_reference: string
  one_improvement: string
  deep_analysis: VyronisCoachDeepAnalysis
  execution_verdict?: CoachExecutionVerdict
  source: "heuristic" | "llm"
}

const INSUFFICIENT_JOURNAL =
  "Insufficient journal data — log 10+ trades to unlock pattern memory."

function sanitizeLine(text: string, verdict: VyronisCoachVerdict): string {
  return enforceCoachTone(text, verdict)
}

function buildJournalCrossReference(
  trader: VyronisCoachTraderContext,
  patternMemory: PatternMemoryResult | undefined,
  verdict: VyronisCoachVerdict,
): string {
  if (!patternMemory?.hasEnoughData && Number(trader.consecutive_losses) < 1) {
    return INSUFFICIENT_JOURNAL
  }
  return sanitizeLine(`Journal: ${pickJournalDataPoint(trader, patternMemory)}.`, verdict)
}

function buildOneImprovement(
  precisionFlow: PrecisionFlowResult,
  trader: VyronisCoachTraderContext,
  verdict: VyronisCoachVerdict,
): string {
  const failed = precisionFlow.rules.filter((rule) => !rule.passed)
  if (verdict === "SKIP") {
    return sanitizeLine(
      "Journal one sentence on what you are trying to prove, then reassess from a clean state.",
      verdict,
    )
  }
  if (failed[0]) {
    return sanitizeLine(`Fix ${failed[0].label.toLowerCase()} first — ${failed[0].note}`, verdict)
  }
  if (Number(trader.consecutive_losses) >= 3) {
    return sanitizeLine(
      `Cut size to 0.5% until you log a rule-clean win in ${trader.preferred_session}.`,
      verdict,
    )
  }
  return sanitizeLine(
    `Execute at ${trader.max_risk} with your plan and do not move the stop.`,
    verdict,
  )
}

function buildDeepAnalysis(
  context: PreTradePlannedContext,
  precisionFlow: PrecisionFlowResult,
): VyronisCoachDeepAnalysis {
  const mtf = context.mtf_analysis ?? context.chart_analysis?.mtf
  const visual = context.visual_analysis?.aggregate
  const chart = context.chart_analysis

  return {
    trend_direction: mtf?.bias.overallBias ?? visual?.overallBias ?? "Not assessed",
    htf_ema_alignment: mtf
      ? `Bias alignment ${mtf.bias.biasAlignmentScore}/100 (W ${mtf.bias.weeklyBias}, D ${mtf.bias.dailyBias}, H4 ${mtf.bias.h4Bias}).`
      : chart?.trendAlignment
        ? `Trend alignment ${chart.trendAlignment}/100.`
        : "Upload W/D/H4 charts for EMA stack read.",
    confirmation_quality: visual?.confirmationQuality
      ? `${visual.confirmationQuality}/100 — BOS ${visual.bosDetected ? "yes" : "not verified"}, CHoCH ${visual.chochDetected ? "yes" : "not verified"} (chart vision).`
      : mtf
        ? `Entry confirmation ${mtf.entry.entryConfirmationScore}/100.`
        : "Not verified from journal data.",
    risk_reward_structure:
      precisionFlow.rules.find((r) => r.id === "risk_reward")?.passed
        ? (precisionFlow.rules.find((r) => r.id === "risk_reward")?.note ?? "Risk:Reward verified from plan.")
        : "Risk:Reward: Not verified from journal data.",
    breakout_vs_retest: visual?.liquiditySweepDetected
      ? "Liquidity sweep detected — verify retest before entry."
      : "Treat as structure retest until BOS is confirmed on close.",
    volatility: chart?.overextendedEntry || visual?.countertrend
      ? "Elevated — extension or counter-trend risk flagged."
      : "Normal — no extension flag on this read.",
    overextended_entry: Boolean(chart?.overextendedEntry ?? visual?.countertrend),
    counter_trend_risk: chart?.countertrend || visual?.countertrend ? "HIGH" : "LOW",
  }
}

export function buildVyronisCoachResponse(input: {
  precisionFlow: PrecisionFlowResult
  context: PreTradePlannedContext
  responses: Record<string, string>
  trader: VyronisCoachTraderContext
  patternMemory?: PatternMemoryResult
}): VyronisCoachResponse {
  const { precisionFlow, context, trader, patternMemory, responses } = input
  const passedRules = precisionFlow.rules.filter((rule) => rule.passed)
  const failedRules = precisionFlow.rules.filter((rule) => !rule.passed)
  const verdict = precisionFlow.verdict

  const warnings = failedRules.map((rule) => rule.note)
  if (precisionFlow.chartUnclear) {
    warnings.unshift("Chart unclear — upload a cleaner timeframe.")
  }
  if (precisionFlow.dailyLossRatio >= 0.8) {
    warnings.push(
      `Daily loss limit ${Math.round(precisionFlow.dailyLossRatio * 100)}% used — stand down unless A+ size only.`,
    )
  }

  const summary = buildConversationalMessage({
    verdict,
    precisionFlow,
    trader,
    patternMemory,
    responses,
  })

  const executionVerdict = resolveCoachExecutionVerdict({
    context,
    precisionFlow,
  })

  return {
    verdict,
    setup_score: executionVerdict.setupQuality.score,
    state_score: precisionFlow.stateScore,
    risk_level: precisionFlow.riskLevel,
    confidence: precisionFlow.confidence,
    summary,
    why_it_passes: passedRules.slice(0, 3).map((rule) => sanitizeLine(rule.note, verdict)),
    warnings: warnings.slice(0, 4).map((line) => sanitizeLine(line, verdict)),
    journal_cross_reference: buildJournalCrossReference(trader, patternMemory, verdict),
    one_improvement: buildOneImprovement(precisionFlow, trader, verdict),
    deep_analysis: buildDeepAnalysis(context, precisionFlow),
    execution_verdict: executionVerdict,
    source: "heuristic",
  }
}

function parseVyronisCoachJson(
  raw: string,
  lockedVerdict: VyronisCoachVerdict,
  lockedScores: Pick<VyronisCoachResponse, "setup_score" | "state_score" | "confidence" | "risk_level">,
): VyronisCoachResponse | null {
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim()
    const parsed = JSON.parse(cleaned) as Partial<VyronisCoachResponse>
    if (!parsed.summary || !parsed.one_improvement) return null

    return {
      verdict: lockedVerdict,
      setup_score: lockedScores.setup_score,
      state_score: lockedScores.state_score,
      risk_level: lockedScores.risk_level,
      confidence: lockedScores.confidence,
      summary: sanitizeLine(String(parsed.summary), lockedVerdict),
      why_it_passes: Array.isArray(parsed.why_it_passes)
        ? parsed.why_it_passes.map((line) => sanitizeLine(String(line), lockedVerdict)).slice(0, 4)
        : [],
      warnings: Array.isArray(parsed.warnings)
        ? parsed.warnings.map((line) => sanitizeLine(String(line), lockedVerdict)).slice(0, 4)
        : [],
      journal_cross_reference: sanitizeLine(
        String(parsed.journal_cross_reference || INSUFFICIENT_JOURNAL),
        lockedVerdict,
      ),
      one_improvement: sanitizeLine(String(parsed.one_improvement), lockedVerdict),
      deep_analysis: {
        trend_direction: String(parsed.deep_analysis?.trend_direction ?? ""),
        htf_ema_alignment: String(parsed.deep_analysis?.htf_ema_alignment ?? ""),
        confirmation_quality: String(parsed.deep_analysis?.confirmation_quality ?? ""),
        risk_reward_structure: String(parsed.deep_analysis?.risk_reward_structure ?? ""),
        breakout_vs_retest: String(parsed.deep_analysis?.breakout_vs_retest ?? ""),
        volatility: String(parsed.deep_analysis?.volatility ?? ""),
        overextended_entry: Boolean(parsed.deep_analysis?.overextended_entry),
        counter_trend_risk: String(parsed.deep_analysis?.counter_trend_risk ?? ""),
      },
      source: "llm",
    }
  } catch {
    return null
  }
}

export async function enrichVyronisCoachResponseWithLlm(input: {
  base: VyronisCoachResponse
  precisionFlow: PrecisionFlowResult
  context: PreTradePlannedContext
  trader: VyronisCoachTraderContext
  patternMemory?: PatternMemoryResult
}): Promise<VyronisCoachResponse> {
  const systemPrompt = buildVyronisCoachSystemPrompt(
    input.trader,
    input.base.verdict,
    input.patternMemory,
  )
  const userPrompt = [
    `Narrate this pre-trade coach read for ${input.context.pair || "the pair"} ${input.context.direction || ""}.`,
    `Precision Flow: ${input.precisionFlow.rulesPassed}/7 rules passed.`,
    `State score: ${input.base.state_score}/100. Setup score: ${input.base.setup_score}/100.`,
    `Failed rules: ${input.precisionFlow.rules
      .filter((r) => !r.passed)
      .map((r) => r.label)
      .join(", ") || "none"}.`,
    `Journal data you must reference: ${input.base.journal_cross_reference}`,
    `Keep verdict exactly ${input.base.verdict}.`,
    `Summary must be max 3 sentences, no greeting, no questions, end with a directive that matches ${input.base.verdict}.`,
    `Return JSON only.`,
  ].join("\n")

  const raw = await generateCoachInsightWithProvider(
    {
      context: input.context,
      prompt: userPrompt,
      systemPrompt,
      jsonMode: true,
    },
    null,
  )

  if (!raw) return input.base

  const parsed = parseVyronisCoachJson(raw, input.base.verdict, {
    setup_score: input.base.setup_score,
    state_score: input.base.state_score,
    confidence: input.base.confidence,
    risk_level: input.base.risk_level,
  })
  if (!parsed) return input.base

  return {
    ...parsed,
    summary: enforceCoachTone(parsed.summary, input.base.verdict),
    one_improvement: enforceCoachTone(parsed.one_improvement, input.base.verdict),
  }
}

export function buildCoachAnalysisBundle(input: {
  precisionFlow: PrecisionFlowResult
  context: PreTradePlannedContext
  responses: Record<string, string>
  historicalTrades?: TradeRiskGuardHistoryTrade[]
  settings?: UserSettingsForm
  patternMemory?: PatternMemoryResult
  startingBalance?: number
}): VyronisCoachResponse {
  const trader = buildVyronisCoachTraderContext({
    settings: input.settings,
    historicalTrades: input.historicalTrades,
    patternMemory: input.patternMemory,
  })

  return buildVyronisCoachResponse({
    precisionFlow: input.precisionFlow,
    context: input.context,
    responses: input.responses,
    trader,
    patternMemory: input.patternMemory,
  })
}
