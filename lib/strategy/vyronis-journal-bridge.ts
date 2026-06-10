/**
 * Vyronis journal intelligence — maps journal form → Vyronis Core Model → persisted trade payload.
 */

import { evaluateVyronisCore } from "@/lib/strategy/vyronis-core"
import type {
  VyronisBiasDirection,
  VyronisConfirmationInput,
  VyronisDirection,
  VyronisEngulfingType,
  VyronisEvaluation,
  VyronisSession,
  VyronisStructureShift,
  VyronisTradeInput,
} from "@/types/strategy"
import { VYRONIS_CORE_DOCTRINE_VERSION, VYRONIS_STRATEGY_SCORING } from "@/types/vyronis-branding"
import type { TradeFormState } from "@/lib/trade-form-config"
import type { SetupCoachingInsight } from "@/lib/trade-coach/setup-score-engine"

export type VyronisJournalEvaluationRecord = VyronisEvaluation & {
  mainMistake: string | null
  improvement: string | null
  passSummary: string
  failSummary: string
  postTradeVerdict: string | null
  rrBelowMinimum: boolean
  riskReward: number | null
  scoringSystem: typeof VYRONIS_STRATEGY_SCORING
}

function parseBias(value: string | null | undefined): VyronisBiasDirection | null {
  const v = value?.trim().toLowerCase()
  if (v === "bullish" || v === "bearish" || v === "neutral") return v
  return null
}

function tradeDirection(direction: string): VyronisDirection {
  if (direction === "SELL") return "short"
  if (direction === "BUY") return "long"
  return "neutral"
}

function mapSession(session: string | null | undefined): VyronisSession {
  const s = session?.trim().toLowerCase() ?? ""
  if (s.includes("london") && s.includes("new york")) return "london_ny_overlap"
  if (s.includes("london")) return "london"
  if (s.includes("new york") || s === "ny am" || s === "ny pm") return "new_york"
  if (s.includes("asia")) return "asia"
  if (s.includes("pre-market") || s.includes("off")) return "off_hours"
  return s ? "unknown" : "unknown"
}

function structureFromConfirmation(type: string): VyronisStructureShift {
  if (type === "choch") return "choch"
  if (type === "bos") return "bos"
  if (type === "none") return "none"
  return "unverified"
}

function engulfingFromConfirmation(type: string): VyronisEngulfingType {
  if (type === "engulfing") return "bullish"
  return "none"
}

function aoiQualityScore(aoiType: string, entryQuality: string): number {
  let score = 72
  if (["demand", "support", "liquidity_sweep"].includes(aoiType)) score += 8
  if (["supply", "resistance"].includes(aoiType)) score += 6
  if (entryQuality === "perfect") score += 12
  if (entryQuality === "early" || entryQuality === "late") score -= 8
  if (entryQuality === "impulsive") score -= 18
  return Math.max(20, Math.min(100, score))
}

export function isVyronisHtfComplete(form: Pick<TradeFormState, "weekly_bias" | "daily_bias" | "h4_bias">): boolean {
  return Boolean(parseBias(form.weekly_bias) && parseBias(form.daily_bias) && parseBias(form.h4_bias))
}

export function buildVyronisTradeInputFromJournalForm(
  form: TradeFormState,
  options: {
    riskReward: number | null
    maxRiskPercent: number
  },
): VyronisTradeInput {
  const weekly = parseBias(form.weekly_bias) ?? "neutral"
  const daily = parseBias(form.daily_bias) ?? "neutral"
  const h4 = parseBias(form.h4_bias) ?? "neutral"
  const aoiType = form.aoi_type?.trim() ?? ""
  const confirmationType = form.confirmation_type?.trim() ?? ""
  const entryQuality = form.entry_quality || "perfect"
  const direction = tradeDirection(form.direction)

  const structureShift = structureFromConfirmation(confirmationType)
  const alignedWithDirection = confirmationType !== "none"

  const confirmation: VyronisConfirmationInput = {
    engulfing: engulfingFromConfirmation(confirmationType),
    alignedWithDirection: confirmationType === "engulfing" ? alignedWithDirection : undefined,
    additionalSignals:
      confirmationType === "pin_bar"
        ? ["Pin bar rejection"]
        : confirmationType === "break_retest"
          ? ["Break and retest"]
          : confirmationType === "ema_retest"
            ? ["EMA retest"]
            : confirmationType === "none"
              ? []
              : confirmationType
                ? [confirmationType.toUpperCase()]
                : undefined,
  }

  return {
    pair: form.pair,
    htf: {
      weekly,
      daily,
      h4,
      tradeDirection: direction,
    },
    aoi: {
      reached: Boolean(aoiType),
      qualityScore: aoiQualityScore(aoiType || "demand", entryQuality),
      invalidationClear: entryQuality !== "impulsive",
    },
    liquidity: {
      sweepDetected: aoiType === "liquidity_sweep",
      alignedWithDirection: direction !== "neutral",
      verificationStatus:
        aoiType === "liquidity_sweep"
          ? "verified"
          : aoiType === "none"
            ? "absent"
            : "unverified",
    },
    structure: {
      shift: structureShift,
      alignedWithDirection: structureShift !== "none" ? alignedWithDirection : undefined,
    },
    confirmation,
    session: {
      session: mapSession(form.session),
      favorable: Boolean(form.session),
    },
    risk: {
      riskReward: options.riskReward,
      riskPercent: form.risk_percent ? parseFloat(form.risk_percent) : null,
      maxRiskPercent: options.maxRiskPercent,
      minimumRr: 2,
    },
    news: { majorNewsProximity: false },
    emotion: { state: form.emotion },
    metadata: { source: "manual" },
  }
}

function deriveMainMistake(
  evaluation: VyronisEvaluation,
  form: TradeFormState,
): string | null {
  if (evaluation.hardSkip) {
    return evaluation.hardSkipReasons[0] ?? "Vyronis Core Model hard skip triggered."
  }
  if (form.entry_quality === "impulsive") return "Impulsive entry quality logged."
  if (form.entry_quality === "late") return "Late entry — edge may already be gone."
  if (form.mistake_tags.length > 0) return form.mistake_tags[0]
  if (evaluation.warnings.length > 0) return evaluation.warnings[0]
  return null
}

function derivePostTradeVyronisVerdict(
  evaluation: VyronisEvaluation,
  form: TradeFormState,
  rrBelowMinimum: boolean,
  maxRiskPercent: number,
): string {
  const riskPct = form.risk_percent ? parseFloat(form.risk_percent) : null
  const riskGap =
    riskPct != null && riskPct > maxRiskPercent
      ? `Main discipline issue: risk was ${riskPct}%, above the current ${maxRiskPercent}% challenge rule.`
      : null

  if (form.result === "WIN") {
    if (evaluation.grade === "A" || evaluation.grade === "A+") {
      return sanitizeVyronisPostTradeCopy(
        [
          "Winning trade.",
          "Strategy alignment was strong.",
          riskGap ? "Execution was mostly clean." : "Execution was clean.",
          riskGap,
        ]
          .filter(Boolean)
          .join(" "),
      )
    }
    if (evaluation.hardSkip || evaluation.grade === "Skip") {
      return "Winning trade, but doctrine gaps were present. Do not let the profit reinforce shortcuts."
    }
    return [
      "Winning trade.",
      "Strategy alignment was acceptable.",
      riskGap ?? "Review journal completeness before repeating the setup.",
    ].join(" ")
  }

  if (evaluation.hardSkip || evaluation.grade === "Skip") {
    return "Closed loss against doctrine — review what broke down before repeating the setup."
  }
  if (rrBelowMinimum) {
    return "Closed trade with weak R:R asymmetry — plan stronger reward before repeating."
  }
  return evaluation.reasons[0]
    ? `Closed trade. ${evaluation.reasons[0]}`
    : "Closed trade — review strategy and discipline separately before repeating."
}

function sanitizeVyronisPostTradeCopy(text: string): string {
  return text
    .replace(/reduce size[^.!?]*/gi, "tighten risk discipline on the next repetition")
    .replace(/wait for (another )?confirmation[^.!?]*/gi, "log confirmation quality more completely next time")
    .trim()
}

function deriveImprovement(
  evaluation: VyronisEvaluation,
  rrBelowMinimum: boolean,
  isClosedTrade: boolean,
): string {
  if (isClosedTrade) {
    if (evaluation.hardSkip || evaluation.grade === "Skip") {
      return "Execution completed against doctrine — note what broke down and correct it on the next similar setup."
    }
    if (rrBelowMinimum) {
      return "R:R was below Vyronis minimum on this trade — plan stronger asymmetry before repeating the setup."
    }
    if (evaluation.grade === "B") {
      return "Outcome is logged — tighten confirmation quality and entry timing on the next repetition."
    }
    if (evaluation.reasons.length > 0) {
      return `Repeat what worked: ${evaluation.reasons[0]}`
    }
    return "Solid journal capture — keep logging doctrine fields to sharpen post-trade reviews."
  }

  if (evaluation.hardSkip) {
    return "Wait for HTF alignment and a calm/confident emotional state before risking capital."
  }
  if (rrBelowMinimum) {
    return "Target minimum 1:2 R:R before entry — plan stop and target before clicking buy/sell."
  }
  if (evaluation.grade === "B") {
    return "Reduce size or wait for one more confirmation candle aligned with Vyronis doctrine."
  }
  if (evaluation.reasons.length > 0) {
    return `Repeat what worked: ${evaluation.reasons[0]}`
  }
  return "Keep logging doctrine fields — Vyronis journal intelligence sharpens with consistency."
}

function buildPassFailSummary(evaluation: VyronisEvaluation): { passSummary: string; failSummary: string } {
  if (evaluation.hardSkip || evaluation.grade === "Skip") {
    return {
      passSummary: "",
      failSummary:
        evaluation.hardSkipReasons.join(" ") ||
        evaluation.warnings[0] ||
        "Trade did not meet Vyronis Core Model minimum standards.",
    }
  }
  return {
    passSummary:
      evaluation.reasons.slice(0, 2).join(" ") ||
      "Process aligned with Vyronis Core Model on this entry.",
    failSummary: evaluation.warnings[0] || "",
  }
}

export function evaluateVyronisJournalTrade(
  form: TradeFormState,
  options: {
    riskReward: number | null
    maxRiskPercent: number
  },
): VyronisJournalEvaluationRecord {
  const input = buildVyronisTradeInputFromJournalForm(form, options)
  let evaluation = evaluateVyronisCore(input)

  const rrBelowMinimum = options.riskReward != null && options.riskReward < 2
  if (rrBelowMinimum && !evaluation.warnings.some((w) => w.includes("below Vyronis minimum"))) {
    evaluation = {
      ...evaluation,
      warnings: [
        ...evaluation.warnings,
        `R:R 1:${options.riskReward!.toFixed(1)} is below Vyronis minimum 1:2 — poor asymmetry.`,
      ],
    }
  }

  const { passSummary, failSummary } = buildPassFailSummary(evaluation)

  const isClosedTrade = Boolean(form.result?.trim())

  return {
    ...evaluation,
    doctrineVersion: VYRONIS_CORE_DOCTRINE_VERSION,
    mainMistake: deriveMainMistake(evaluation, form),
    improvement: deriveImprovement(
      evaluation,
      rrBelowMinimum,
      isClosedTrade,
    ),
    passSummary: isClosedTrade
      ? sanitizeVyronisPostTradeCopy(passSummary)
      : passSummary,
    failSummary: isClosedTrade
      ? sanitizeVyronisPostTradeCopy(failSummary)
      : failSummary,
    postTradeVerdict: isClosedTrade
      ? derivePostTradeVyronisVerdict(
          evaluation,
          form,
          rrBelowMinimum,
          options.maxRiskPercent,
        )
      : null,
    rrBelowMinimum,
    riskReward: options.riskReward,
    scoringSystem: VYRONIS_STRATEGY_SCORING,
  }
}

export function vyronisInsightsFromEvaluation(
  evaluation: VyronisJournalEvaluationRecord,
): SetupCoachingInsight[] {
  const items: SetupCoachingInsight[] = []
  evaluation.reasons.slice(0, 3).forEach((message, index) => {
    items.push({ id: `vyronis-reason-${index}`, type: "positive", message })
  })
  evaluation.warnings.slice(0, 4).forEach((message, index) => {
    items.push({ id: `vyronis-warn-${index}`, type: "warning", message })
  })
  if (evaluation.improvement) {
    items.push({ id: "vyronis-improvement", type: "pattern", message: evaluation.improvement })
  }
  return items
}

export function confirmationSignalLabel(type: string): string | null {
  const map: Record<string, string> = {
    choch: "CHoCH",
    bos: "BOS",
    engulfing: "Engulfing candle",
    pin_bar: "Pin bar rejection",
    break_retest: "Break and retest",
    ema_retest: "EMA retest",
    none: "No confirmation",
  }
  return map[type] ?? null
}

export function buildVyronisJournalPersistFields(
  form: TradeFormState,
  evaluation: VyronisJournalEvaluationRecord,
) {
  return {
    weekly_bias: parseBias(form.weekly_bias),
    daily_bias: parseBias(form.daily_bias),
    h4_bias: parseBias(form.h4_bias),
    aoi_type: form.aoi_type || null,
    confirmation_type: form.confirmation_type || null,
    entry_quality: form.entry_quality || null,
    confirmation_signal: confirmationSignalLabel(form.confirmation_type),
    setup_score: evaluation.score,
    setup_classification: evaluation.grade,
    setup_score_breakdown: evaluation.breakdown,
    setup_coaching_insights: vyronisInsightsFromEvaluation(evaluation),
    vyronis_evaluation: evaluation,
  }
}
