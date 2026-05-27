import { calculateRiskReward } from "@/lib/trade-form-utils"
import { MTF_SLOTS } from "@/lib/coach/mtf-constants"
import {
  attachAnnotationsToReplayScreenshot,
  resolveChartAnnotationBundle,
} from "@/lib/chart-annotations/replay-overlay"
import {
  extractPreTradeResponses,
  generatePostTradeCoachFeedback,
  mergePlannedContext,
} from "@/lib/trade-coach/post-trade-analysis"
import { resolveTradeQualityFromSession } from "@/lib/trade-coach/trade-quality-utils"
import { getMtfScreenshotsFromSession } from "@/lib/trade-coach/mtf-session"
import type {
  BuildExecutionReplayInput,
  ExecutionDriftItem,
  ExecutionReplayAnalytics,
  ExecutionReplayCandleSentiment,
  ExecutionReplayCandleState,
  ExecutionReplayChangeItem,
  ExecutionReplayEntryComparison,
  ExecutionReplayEvent,
  ExecutionReplayPhase,
  ExecutionReplayResult,
  ExecutionReplayRrCollapse,
  ExecutionReplayScreenshot,
  ExecutionReplaySessionRecap,
  ExecutionReplayTimelineMarker,
  ExecutionReplayTone,
} from "@/lib/replay/types"
import type { PlannedVsActualComparison } from "@/lib/trade-coach/types"
import type { StrategyPlaybookMatchResult } from "@/lib/strategy/types"

const IMPULSIVE_EMOTIONS = new Set(["FOMO", "Revenge", "Euphoric", "Anxious", "Fearful", "Greed"])
const STABLE_EMOTIONS = new Set(["Calm", "Confident", "Disciplined"])

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function toneFromAligned(aligned: boolean, critical = false): ExecutionReplayTone {
  if (critical) return "danger"
  return aligned ? "success" : "warning"
}

function collectMtfScreenshots(
  session: BuildExecutionReplayInput["session"],
  phase: ExecutionReplayPhase = "pre_trade_plan",
  commentary: string[] = [],
): ExecutionReplayScreenshot[] {
  if (!session) return []
  const bundle =
    resolveChartAnnotationBundle(session.planned_context) ||
    session.planned_context?.visual_analysis?.chartAnnotations ||
    null
  const map = getMtfScreenshotsFromSession(session)
  return MTF_SLOTS.flatMap((slot) => {
    const url = map[slot.id]
    if (!url) return []
    return [
      attachAnnotationsToReplayScreenshot({
        screenshot: { label: slot.label, url, timeframe: slot.id },
        bundle,
        phase,
        commentary,
      }),
    ]
  })
}

function resolvePostTradeAnalysis(input: BuildExecutionReplayInput) {
  if (input.postTradeAnalysis) return input.postTradeAnalysis
  if (!input.session) return null

  const plannedContext = mergePlannedContext(
    input.session.planned_context || {},
    {
      pair: input.trade.pair,
      direction: input.trade.direction,
      setup: input.trade.setup,
      strategy_name: input.trade.strategy_name,
    },
  )

  return generatePostTradeCoachFeedback({
    trade: input.trade,
    preTradeResponses: extractPreTradeResponses(input.session.messages),
    plannedContext,
    maxRiskPerTrade: input.maxRiskPerTrade,
  })
}

function detectExecutionDrifts(
  comparisons: PlannedVsActualComparison[],
  input: BuildExecutionReplayInput,
  playbookMatch: StrategyPlaybookMatchResult | null | undefined,
): ExecutionDriftItem[] {
  const drifts: ExecutionDriftItem[] = []
  const byField = new Map(comparisons.map((item) => [item.field, item]))

  const sl = byField.get("Stop loss")
  if (sl && !sl.aligned) {
    drifts.push({
      id: "moved_stop_loss",
      label: "Moved stop loss",
      severity: "critical",
      description: sl.note,
    })
  }

  const tp = byField.get("Take profit")
  if (tp && !tp.aligned) {
    drifts.push({
      id: "exited_early",
      label: "Changed target / exited early",
      severity: "warning",
      description: tp.note,
    })
  }

  const entry = byField.get("Entry")
  if (entry && !entry.aligned) {
    drifts.push({
      id: "entry_drift",
      label: "Entry drifted from plan",
      severity: "warning",
      description: entry.note,
    })
  }

  const risk = byField.get("Risk")
  if (risk && !risk.aligned) {
    drifts.push({
      id: "poor_rr",
      label: "Risk / R:R drift",
      severity: risk.actual.includes("%") && parseFloat(risk.actual) > input.maxRiskPerTrade ? "critical" : "warning",
      description: risk.note,
    })
  }

  const emotion = byField.get("Emotion")
  if (emotion && !emotion.aligned) {
    drifts.push({
      id: "emotional_deviation",
      label: "Emotional deviation",
      severity: IMPULSIVE_EMOTIONS.has(input.trade.emotion_after || "") ? "critical" : "warning",
      description: emotion.note,
    })
  }

  const rules = byField.get("Rules followed")
  if (rules && !rules.aligned) {
    drifts.push({
      id: "rule_break",
      label: "Rule adherence broke down",
      severity: "critical",
      description: rules.note,
    })
  }

  if (playbookMatch?.detections?.beforeConfirmationClose || playbookMatch?.detections?.earlyEntry) {
    drifts.push({
      id: "ignored_confirmation",
      label: "Ignored confirmation",
      severity: "critical",
      description: "Pre-trade analysis flagged entry timing before confirmation was complete.",
    })
  }

  if (playbookMatch?.detections?.countertrend || playbookMatch?.detections?.htfConflict) {
    drifts.push({
      id: "htf_conflict",
      label: "HTF conflict",
      severity: "warning",
      description: "Execution diverged from higher-timeframe bias alignment.",
    })
  }

  const plannedRr = calculateRiskReward({
    direction: input.session?.planned_context?.direction || input.trade.direction,
    entry_price: input.session?.planned_context?.entry_price || String(input.trade.entry_price ?? ""),
    stop_loss: input.session?.planned_context?.stop_loss || String(input.trade.stop_loss ?? ""),
    take_profit: input.session?.planned_context?.take_profit || String(input.trade.take_profit ?? ""),
  })
  const actualRr =
    input.trade.risk_reward ??
    calculateRiskReward({
      direction: input.trade.direction,
      entry_price: String(input.trade.entry_price ?? ""),
      stop_loss: String(input.trade.stop_loss ?? ""),
      take_profit: String(input.trade.take_profit ?? ""),
    })

  if (plannedRr !== null && actualRr !== null && Math.abs(plannedRr - actualRr) > 0.35) {
    drifts.push({
      id: "changed_rr",
      label: "Changed R:R",
      severity: "warning",
      description: `Planned ~${plannedRr.toFixed(1)}R vs logged ~${actualRr.toFixed(1)}R.`,
    })
  }

  if (
    IMPULSIVE_EMOTIONS.has(input.trade.emotion) ||
    IMPULSIVE_EMOTIONS.has(input.trade.emotion_after || "")
  ) {
    drifts.push({
      id: "emotional_fomo",
      label: "Emotional / FOMO behavior",
      severity: "critical",
      description: "Impulsive emotional state detected around this execution.",
    })
  }

  return drifts
}

function buildAnalytics(
  input: BuildExecutionReplayInput,
  comparisons: PlannedVsActualComparison[],
  drifts: ExecutionDriftItem[],
  postTrade: ReturnType<typeof resolvePostTradeAnalysis>,
): ExecutionReplayAnalytics {
  const alignedCount = comparisons.filter((item) => item.aligned).length
  const executionQuality =
    comparisons.length > 0
      ? clamp(Math.round((alignedCount / comparisons.length) * 100) - drifts.length * 4)
      : input.trade.rule_followed === false
        ? 42
        : 68

  const disciplineQuality = clamp(
    input.feedback?.discipline_score ??
      postTrade?.disciplineScore ??
      (input.trade.rule_followed ? 72 : 48),
  )

  const plannedEmotion = input.session
    ? extractPreTradeResponses(input.session.messages).emotional_state ||
      input.session.planned_context?.emotion
    : input.trade.emotion
  const closingEmotion = input.trade.emotion_after || input.trade.emotion
  let emotionalStability = 70
  if (plannedEmotion && closingEmotion) {
    if (plannedEmotion === closingEmotion) emotionalStability += 12
    if (IMPULSIVE_EMOTIONS.has(closingEmotion)) emotionalStability -= 22
    if (STABLE_EMOTIONS.has(plannedEmotion) && STABLE_EMOTIONS.has(closingEmotion)) emotionalStability += 8
  }

  const rulesCompare = comparisons.find((item) => item.field === "Rules followed")
  const ruleAdherence = rulesCompare
    ? rulesCompare.aligned
      ? 88
      : 38
    : input.trade.rule_followed === false
      ? 35
      : 75

  const quality = input.session ? resolveTradeQualityFromSession(input.session) : null
  const aiConfidence = quality?.score ?? input.session?.planned_context?.coach_analysis?.confidenceScore ?? null
  const predictedLow = aiConfidence !== null && aiConfidence < 50
  const outcomeMatchedPrediction =
    aiConfidence !== null
      ? (predictedLow && input.trade.result === "LOSS") ||
        (!predictedLow && input.trade.result === "WIN")
      : null

  return {
    executionQuality,
    disciplineQuality,
    emotionalStability: clamp(emotionalStability),
    ruleAdherence,
    aiConfidence,
    outcomeMatchedPrediction,
    summary:
      drifts.length === 0
        ? "Execution stayed close to the pre-trade plan with stable process quality."
        : `${drifts.length} execution drift(s) detected — review timing, risk, and emotional control.`,
  }
}

function buildPreTradePlanEvent(input: BuildExecutionReplayInput): ExecutionReplayEvent {
  const { trade, session } = input
  const ctx = session?.planned_context
  const responses = session ? extractPreTradeResponses(session.messages) : {}
  const screenshots = collectMtfScreenshots(session, "pre_trade_plan")
  const hasPlan = Boolean(session)

  const details = [
    `Pair: ${ctx?.pair || trade.pair} · ${ctx?.direction || trade.direction}`,
    `Strategy: ${ctx?.strategy_name || trade.strategy_name || "—"}`,
    `Setup: ${ctx?.setup || trade.setup || "—"}`,
    `Planned risk: ${responses.planned_risk || ctx?.risk_percent || `${trade.risk_percent ?? 1}%`}`,
    `Planned emotion: ${responses.emotional_state || ctx?.emotion || trade.emotion}`,
  ]

  if (ctx?.higher_timeframe) details.push(`HTF bias context: ${ctx.higher_timeframe}`)
  if (responses.rule_check) details.push(`Pre-trade rule commitment: ${responses.rule_check}`)

  const aiCommentary = hasPlan
    ? `Pre-trade coach captured your plan across ${screenshots.length} HTF chart(s) before entry.`
    : "No linked pre-trade coach session — replay uses logged trade fields only."

  return {
    id: "pre_trade_plan",
    step: 0,
    title: "Pre-Trade Plan",
    subtitle: hasPlan ? "Coach session + planned bias" : "Trade journal plan only",
    tone: hasPlan ? "info" : "warning",
    aiCommentary,
    details,
    warnings: hasPlan ? [] : ["Link a pre-trade coach session next time for full replay fidelity."],
    screenshots,
    metrics: {
      "Charts uploaded": String(screenshots.length),
      Bias: ctx?.playbook_match?.strategyName || ctx?.mtf_analysis?.bias?.overallBias || "—",
    },
  }
}

function buildAiAnalysisEvent(input: BuildExecutionReplayInput): ExecutionReplayEvent {
  const { session } = input
  const ctx = session?.planned_context
  const mtf = ctx?.mtf_analysis
  const playbook = ctx?.playbook_match as StrategyPlaybookMatchResult | undefined
  const quality = session ? resolveTradeQualityFromSession(session) : null
  const warnings: string[] = []

  if (mtf?.bias?.biasWarnings?.length) warnings.push(...mtf.bias.biasWarnings.slice(0, 2))
  if (mtf?.entry?.entryWarnings?.length) warnings.push(...mtf.entry.entryWarnings.slice(0, 2))
  if (playbook?.violations?.length) warnings.push(...playbook.violations.slice(0, 2))

  let aiCommentary = "No AI chart analysis was linked to this trade."
  if (playbook) {
    aiCommentary = `Strategy playbook read: ${playbook.matchScore}/100 match, grade ${playbook.setupGrade}, ${playbook.recommendation}.`
  } else if (mtf) {
    aiCommentary = `MTF analysis scored ${mtf.overallScore}/100 with ${mtf.recommendation} recommendation before entry.`
  } else if (quality) {
    aiCommentary = `Pre-trade quality scored ${quality.score}/100 (${quality.grade}) before you entered.`
  }

  if (playbook?.detections?.earlyEntry) {
    aiCommentary += " Entered before M15 confirmation candle closed."
  }
  if (playbook?.detections?.beforeConfirmationClose) {
    aiCommentary += " Liquidity sweep or confirmation timing was flagged pre-entry."
  }

  const replayCommentary = [
    ...(playbook?.violations?.slice(0, 2) || []),
    ctx?.visual_analysis?.aggregate?.summary || "",
  ].filter(Boolean)

  return {
    id: "ai_analysis",
    step: 1,
    title: "AI Analysis",
    subtitle: "MTF + playbook scoring",
    tone: warnings.length > 0 ? "warning" : "success",
    aiCommentary,
    details: [
      mtf
        ? `HTF bias: ${mtf.bias.overallBias} (${mtf.bias.biasAlignmentScore}/100)`
        : "HTF bias: not analyzed",
      mtf
        ? `Entry confirmation: ${mtf.entry.entryConfirmationScore}/100`
        : "Entry confirmation: not analyzed",
      playbook
        ? `Playbook match: ${playbook.matchScore}/100 · Setup ${playbook.setupQualityScore ?? "—"} · Timing ${playbook.executionTimingScore ?? "—"}`
        : "Playbook match: not run",
      quality ? `Trade quality gate: ${quality.score}/100 (${quality.recommendation})` : "Quality gate: —",
    ],
    warnings,
    screenshots: collectMtfScreenshots(session, "ai_analysis", replayCommentary).slice(0, 3),
    metrics: {
      "AI confidence": quality ? `${quality.score}/100` : "—",
      Recommendation: mtf?.recommendation || quality?.recommendation || "—",
    },
  }
}

function buildEntryExecutionEvent(
  input: BuildExecutionReplayInput,
  comparisons: PlannedVsActualComparison[],
): ExecutionReplayEvent {
  const { trade, session } = input
  const ctx = session?.planned_context
  const entryCompare = comparisons.find((item) => item.field === "Entry")
  const slCompare = comparisons.find((item) => item.field === "Stop loss")
  const tpCompare = comparisons.find((item) => item.field === "Take profit")

  const misaligned = [entryCompare, slCompare, tpCompare].filter((item) => item && !item.aligned)

  const screenshots: ExecutionReplayScreenshot[] = []
  const bundle =
    resolveChartAnnotationBundle(session?.planned_context || null) ||
    session?.planned_context?.visual_analysis?.chartAnnotations ||
    null

  if (trade.screenshot_url) {
    screenshots.push(
      attachAnnotationsToReplayScreenshot({
        screenshot: { label: "Execution chart", url: trade.screenshot_url },
        bundle,
        phase: "entry_execution",
        commentary: misaligned.map((item) => item!.note),
      }),
    )
  }
  const h1 = session ? getMtfScreenshotsFromSession(session).h1 : null
  const m15 = session ? getMtfScreenshotsFromSession(session).m15 : null
  if (h1) {
    screenshots.push(
      attachAnnotationsToReplayScreenshot({
        screenshot: { label: "H1 setup", url: h1, timeframe: "h1" },
        bundle,
        phase: "entry_execution",
        commentary: ["Before entry — H1 setup formation."],
      }),
    )
  }
  if (m15) {
    screenshots.push(
      attachAnnotationsToReplayScreenshot({
        screenshot: { label: "M15 confirmation", url: m15, timeframe: "m15" },
        bundle,
        phase: "entry_execution",
        commentary: [
          !trade.confirmation_signal?.trim() && !ctx?.confirmation_signal
            ? "Entered before M15 confirmation closed."
            : "M15 entry trigger chart.",
        ].filter(Boolean),
      }),
    )
  }

  let aiCommentary = "Actual execution matched the planned entry structure."
  if (misaligned.length > 0) {
    aiCommentary = `Execution drifted on ${misaligned.map((item) => item?.field.toLowerCase()).join(", ")} versus the pre-trade plan.`
  }
  if (!trade.confirmation_signal?.trim() && !ctx?.confirmation_signal) {
    aiCommentary += " No explicit confirmation signal was logged at entry."
  }

  return {
    id: "entry_execution",
    step: 2,
    title: "Entry Execution",
    subtitle: "H1 setup → M15 trigger → fill",
    tone: misaligned.length > 0 ? "warning" : "success",
    aiCommentary,
    details: [
      `Planned entry: ${ctx?.entry_price || "—"} · Actual: ${trade.entry_price ?? "—"}`,
      `Planned SL: ${ctx?.stop_loss || "—"} · Actual: ${trade.stop_loss ?? "—"}`,
      `Planned TP: ${ctx?.take_profit || "—"} · Actual: ${trade.take_profit ?? "—"}`,
      `Confirmation: ${ctx?.confirmation_signal || trade.confirmation_signal || "Not logged"}`,
    ],
    warnings: misaligned.map((item) => item!.note),
    screenshots,
    metrics: {
      Entry: entryCompare?.aligned ? "Aligned" : "Drift",
      "Stop loss": slCompare?.aligned ? "Aligned" : "Drift",
      Target: tpCompare?.aligned ? "Aligned" : "Drift",
    },
  }
}

function buildEmotionDriftEvent(
  input: BuildExecutionReplayInput,
  comparisons: PlannedVsActualComparison[],
): ExecutionReplayEvent {
  const emotionCompare = comparisons.find((item) => item.field === "Emotion")
  const planned =
    emotionCompare?.planned ||
    extractPreTradeResponses(input.session?.messages || []).emotional_state ||
    input.trade.emotion
  const actual = emotionCompare?.actual || input.trade.emotion_after || input.trade.emotion

  let aiCommentary = "Emotional state remained stable through the trade lifecycle."
  if (!emotionCompare?.aligned) {
    aiCommentary = `Emotion shifted from ${planned} to ${actual}.`
    if (IMPULSIVE_EMOTIONS.has(actual)) {
      aiCommentary += " Closing state looks impulsive — similar to prior low-discipline trades."
    }
  } else if (planned !== actual) {
    aiCommentary = `Emotion shifted from ${planned} to ${actual}, but stayed within an acceptable band.`
  }

  const tone: ExecutionReplayTone = IMPULSIVE_EMOTIONS.has(actual)
    ? "danger"
    : emotionCompare?.aligned
      ? "success"
      : "warning"

  return {
    id: "emotion_drift",
    step: 3,
    title: "Emotion Drift",
    subtitle: "Pre-trade state vs close",
    tone,
    aiCommentary,
    details: [
      `Before entry: ${input.trade.emotion}`,
      `Pre-trade check-in: ${planned}`,
      `After close: ${actual}`,
    ],
    warnings: emotionCompare && !emotionCompare.aligned ? [emotionCompare.note] : [],
    screenshots: [],
    metrics: {
      Drift: emotionCompare?.aligned ? "Stable" : "Detected",
      "Close state": actual,
    },
  }
}

function buildRuleViolationsEvent(
  drifts: ExecutionDriftItem[],
  comparisons: PlannedVsActualComparison[],
): ExecutionReplayEvent {
  const misaligned = comparisons.filter((item) => !item.aligned)
  const critical = drifts.filter((item) => item.severity === "critical")

  const aiCommentary =
    drifts.length === 0
      ? "No major rule violations detected against your playbook or plan."
      : critical.length > 0
        ? `${critical.length} critical violation(s) — process broke down during execution.`
        : `${drifts.length} drift(s) detected — discipline slipped but remained recoverable.`

  return {
    id: "rule_violations",
    step: 4,
    title: "Rule Violations",
    subtitle: "Plan vs execution drift",
    tone: critical.length > 0 ? "danger" : drifts.length > 0 ? "warning" : "success",
    aiCommentary,
    details: drifts.map((item) => item.description),
    warnings: misaligned.map((item) => `${item.field}: ${item.note}`),
    screenshots: [],
    metrics: {
      Violations: String(drifts.length),
      Critical: String(critical.length),
    },
  }
}

function buildTradeCloseEvent(input: BuildExecutionReplayInput): ExecutionReplayEvent {
  const { trade } = input
  const tone: ExecutionReplayTone =
    trade.result === "WIN" ? "success" : trade.result === "LOSS" ? "danger" : "info"

  let aiCommentary = `${trade.pair} closed ${trade.result} with ${trade.pnl >= 0 ? "+" : ""}$${Math.abs(trade.pnl).toFixed(2)} P&L.`
  if (trade.result === "LOSS" && trade.rule_followed !== false) {
    aiCommentary += " Loss accepted with rules intact — good process loss."
  }
  if (trade.result === "WIN" && trade.rule_followed === false) {
    aiCommentary += " Win achieved, but rule breaks reduce long-term edge."
  }

  return {
    id: "trade_close",
    step: 5,
    title: "Trade Close",
    subtitle: "Outcome + P&L",
    tone,
    aiCommentary,
    details: [
      `Result: ${trade.result}`,
      `P&L: ${trade.pnl >= 0 ? "+" : ""}$${trade.pnl.toFixed(2)}`,
      `Rules followed: ${trade.rule_followed === null ? "—" : trade.rule_followed ? "Yes" : "No"}`,
      trade.trade_notes?.trim() ? `Notes: ${trade.trade_notes}` : "Notes: —",
    ],
    warnings: [],
    screenshots: trade.screenshot_url
      ? [
          attachAnnotationsToReplayScreenshot({
            screenshot: { label: "Exit chart", url: trade.screenshot_url },
            bundle:
              resolveChartAnnotationBundle(input.session?.planned_context || null) ||
              input.session?.planned_context?.visual_analysis?.chartAnnotations ||
              null,
            phase: "trade_close",
            commentary: [`Trade closed ${trade.result}.`],
          }),
        ]
      : [],
    metrics: {
      Outcome: trade.result,
      PnL: `${trade.pnl >= 0 ? "+" : ""}$${trade.pnl.toFixed(2)}`,
    },
  }
}

function buildAiDebriefEvent(
  input: BuildExecutionReplayInput,
  postTrade: ReturnType<typeof resolvePostTradeAnalysis>,
  analytics: ExecutionReplayAnalytics,
): ExecutionReplayEvent {
  const summary =
    input.feedback?.coaching_summary ||
    postTrade?.coachingSummary ||
    analytics.summary

  const details = [
    ...(input.feedback?.feedback_points || postTrade?.feedbackPoints || []).slice(0, 4),
  ]

  if (analytics.aiConfidence !== null) {
    details.push(
      analytics.outcomeMatchedPrediction
        ? "AI confidence aligned with the actual outcome."
        : "AI confidence diverged from the actual outcome — review the setup read.",
    )
  }

  if (analytics.disciplineQuality < 55) {
    details.push("This matched previous low-discipline trade patterns in your journal.")
  }

  return {
    id: "ai_debrief",
    step: 6,
    title: "AI Debrief",
    subtitle: "Coach summary + next steps",
    tone: analytics.disciplineQuality >= 70 ? "success" : analytics.disciplineQuality >= 50 ? "warning" : "danger",
    aiCommentary: summary,
    details,
    warnings: postTrade?.disciplineAnalysis.weaknesses.slice(0, 3) || [],
    screenshots: [],
    metrics: {
      Discipline: `${analytics.disciplineQuality}/100`,
      Execution: `${analytics.executionQuality}/100`,
    },
  }
}

function sentimentFromTone(tone: ExecutionReplayTone): ExecutionReplayCandleSentiment {
  if (tone === "success") return "bullish"
  if (tone === "danger") return "danger"
  if (tone === "warning") return "warning"
  return "neutral"
}

function directionFromSentiment(sentiment: ExecutionReplayCandleSentiment): "up" | "down" | "doji" {
  if (sentiment === "bullish") return "up"
  if (sentiment === "bearish" || sentiment === "danger") return "down"
  if (sentiment === "warning") return "doji"
  return "doji"
}

const PHASE_CANDLE_LABELS: Record<ExecutionReplayPhase, string[]> = {
  pre_trade_plan: ["HTF structure scan", "AOI + bias mapped", "Plan committed"],
  ai_analysis: ["Vision pass", "MTF alignment scored", "Playbook gate"],
  entry_execution: ["H1 setup forms", "M15 trigger", "Fill executed"],
  emotion_drift: ["Pre-trade state", "Mid-trade pressure", "Close emotion"],
  rule_violations: ["Rule check #1", "Drift detected", "Violation tally"],
  trade_close: ["Position managed", "Exit trigger", "P&L realized"],
  ai_debrief: ["Process review", "Pattern match", "Next session prep"],
}

function buildCandleStates(events: ExecutionReplayEvent[]): ExecutionReplayCandleState[] {
  const candles: ExecutionReplayCandleState[] = []
  let globalStep = 0

  for (const event of events) {
    const labels = PHASE_CANDLE_LABELS[event.id]
    const baseSentiment = sentimentFromTone(event.tone)

    labels.forEach((label, phaseStep) => {
      const sentiment =
        phaseStep === labels.length - 1
          ? baseSentiment
          : phaseStep === 0
            ? "neutral"
            : event.tone === "danger"
              ? "warning"
              : "neutral"

      candles.push({
        id: `${event.id}-${phaseStep}`,
        phase: event.id,
        phaseStep,
        globalStep,
        label,
        sentiment,
        bodyPercent: clamp(35 + phaseStep * 18 + (event.tone === "success" ? 12 : 0), 28, 92),
        direction: directionFromSentiment(sentiment),
      })
      globalStep += 1
    })
  }

  return candles
}

function findCandleStepForPhase(
  candles: ExecutionReplayCandleState[],
  phase: ExecutionReplayPhase,
  phaseStep = 0,
): number {
  return candles.find((candle) => candle.phase === phase && candle.phaseStep === phaseStep)?.globalStep ?? 0
}

function buildTimelineMarkers(
  candles: ExecutionReplayCandleState[],
  drifts: ExecutionDriftItem[],
  events: ExecutionReplayEvent[],
  rrCollapse: ExecutionReplayRrCollapse | null,
): ExecutionReplayTimelineMarker[] {
  const markers: ExecutionReplayTimelineMarker[] = []

  markers.push({
    id: "ai-scan",
    globalStep: findCandleStepForPhase(candles, "ai_analysis", 1),
    type: "ai",
    label: "AI vision scored setup",
    shortLabel: "AI",
    severity: "info",
  })

  markers.push({
    id: "entry-marker",
    globalStep: findCandleStepForPhase(candles, "entry_execution", 2),
    type: "entry",
    label: "Entry execution",
    shortLabel: "Entry",
    severity: events.find((event) => event.id === "entry_execution")?.tone === "warning" ? "warning" : "info",
  })

  const emotionEvent = events.find((event) => event.id === "emotion_drift")
  if (emotionEvent) {
    markers.push({
      id: "emotion-marker",
      globalStep: findCandleStepForPhase(candles, "emotion_drift", 2),
      type: "emotion",
      label: emotionEvent.metrics["Close state"] || "Emotion shift",
      shortLabel: "Emotion",
      severity:
        emotionEvent.tone === "danger" ? "critical" : emotionEvent.tone === "warning" ? "warning" : "info",
    })
  }

  for (const drift of drifts) {
    if (drift.id === "changed_rr" || drift.id === "poor_rr") continue
  }

  const ruleDrifts = drifts.filter(
    (drift) => drift.id !== "changed_rr" && drift.id !== "poor_rr",
  )
  if (ruleDrifts.length > 0) {
    const criticalCount = ruleDrifts.filter((drift) => drift.severity === "critical").length
    markers.push({
      id: "rule-violations",
      globalStep: findCandleStepForPhase(candles, "rule_violations", 1),
      type: "rule_violation",
      label:
        ruleDrifts.length === 1
          ? ruleDrifts[0].label
          : `${ruleDrifts.length} execution drifts detected`,
      shortLabel: criticalCount > 0 ? `${criticalCount}!` : `${ruleDrifts.length}`,
      severity: criticalCount > 0 ? "critical" : "warning",
    })
  }

  if (rrCollapse) {
    markers.push({
      id: "rr-collapse",
      globalStep: findCandleStepForPhase(candles, "entry_execution", 1),
      type: "rr_collapse",
      label: rrCollapse.message,
      shortLabel: "R:R",
      severity: rrCollapse.severity === "critical" ? "critical" : "warning",
    })
  }

  markers.push({
    id: "exit-marker",
    globalStep: findCandleStepForPhase(candles, "trade_close", 2),
    type: "exit",
    label: "Trade closed",
    shortLabel: "Exit",
    severity: events.find((event) => event.id === "trade_close")?.tone === "danger" ? "critical" : "info",
  })

  return markers
}

function buildEntryComparison(
  input: BuildExecutionReplayInput,
  comparisons: PlannedVsActualComparison[],
): ExecutionReplayEntryComparison {
  const ctx = input.session?.planned_context
  const entryCompare = comparisons.find((item) => item.field === "Entry")
  const slCompare = comparisons.find((item) => item.field === "Stop loss")
  const tpCompare = comparisons.find((item) => item.field === "Take profit")

  const plannedEntry = ctx?.entry_price || entryCompare?.planned || "—"
  const actualEntry = String(input.trade.entry_price ?? entryCompare?.actual ?? "—")
  const plannedStopLoss = ctx?.stop_loss || slCompare?.planned || "—"
  const actualStopLoss = String(input.trade.stop_loss ?? slCompare?.actual ?? "—")
  const plannedTakeProfit = ctx?.take_profit || tpCompare?.planned || "—"
  const actualTakeProfit = String(input.trade.take_profit ?? tpCompare?.actual ?? "—")

  const plannedRrValue = calculateRiskReward({
    direction: ctx?.direction || input.trade.direction,
    entry_price: plannedEntry,
    stop_loss: plannedStopLoss,
    take_profit: plannedTakeProfit,
  })
  const actualRrValue =
    input.trade.risk_reward ??
    calculateRiskReward({
      direction: input.trade.direction,
      entry_price: actualEntry,
      stop_loss: actualStopLoss,
      take_profit: actualTakeProfit,
    })

  const entryAligned = entryCompare?.aligned ?? plannedEntry === actualEntry
  const stopAligned = slCompare?.aligned ?? plannedStopLoss === actualStopLoss
  const targetAligned = tpCompare?.aligned ?? plannedTakeProfit === actualTakeProfit
  const misalignedFields = [
    !entryAligned && "entry",
    !stopAligned && "stop loss",
    !targetAligned && "target",
  ].filter(Boolean)

  const summary =
    misalignedFields.length === 0
      ? "Execution matched the planned entry structure."
      : `Drift detected on ${misalignedFields.join(", ")} versus pre-trade plan.`

  return {
    plannedEntry,
    actualEntry,
    plannedStopLoss,
    actualStopLoss,
    plannedTakeProfit,
    actualTakeProfit,
    plannedRr: plannedRrValue !== null ? `${plannedRrValue.toFixed(1)}R` : null,
    actualRr: actualRrValue !== null ? `${actualRrValue.toFixed(1)}R` : null,
    entryAligned,
    stopAligned,
    targetAligned,
    summary,
  }
}

function buildChangeItems(comparisons: PlannedVsActualComparison[]): ExecutionReplayChangeItem[] {
  return comparisons.map((item) => ({
    field: item.field,
    planned: item.planned,
    actual: item.actual,
    aligned: item.aligned,
    note: item.note,
    impact: item.aligned
      ? "neutral"
      : item.field === "Rules followed" || item.field === "Stop loss" || item.field === "Risk"
        ? "critical"
        : "warning",
  }))
}

function gradeFromScore(score: number): ExecutionReplaySessionRecap["grade"] {
  if (score >= 85) return "A"
  if (score >= 70) return "B"
  if (score >= 55) return "C"
  if (score >= 40) return "D"
  return "F"
}

function buildSessionRecap(
  input: BuildExecutionReplayInput,
  analytics: ExecutionReplayAnalytics,
  drifts: ExecutionDriftItem[],
): ExecutionReplaySessionRecap {
  const pillars = [
    { label: "Execution", score: analytics.executionQuality },
    { label: "Discipline", score: analytics.disciplineQuality },
    { label: "Emotion", score: analytics.emotionalStability },
    { label: "Rules", score: analytics.ruleAdherence },
  ]
  const overallScore = clamp(
    Math.round(pillars.reduce((sum, pillar) => sum + pillar.score, 0) / pillars.length),
  )
  const grade = gradeFromScore(overallScore)
  const criticalCount = drifts.filter((drift) => drift.severity === "critical").length

  let verdict: ExecutionReplaySessionRecap["verdict"] = "review"
  if (overallScore >= 72 && criticalCount === 0) {
    verdict = input.trade.result === "WIN" ? "process_win" : "process_loss"
  } else if (criticalCount > 0 || overallScore < 50) {
    verdict = "mixed"
  }

  let headline = "Solid process — execution stayed aligned with plan."
  if (criticalCount > 0) {
    headline = `${criticalCount} critical drift(s) — review before next session.`
  } else if (drifts.length > 0) {
    headline = "Minor drift detected — tighten execution on the next setup."
  } else if (input.trade.result === "LOSS" && overallScore >= 70) {
    headline = "Acceptable process loss — rules held under pressure."
  } else if (input.trade.result === "WIN" && overallScore < 55) {
    headline = "Win with weak process — don't repeat this execution path."
  }

  return {
    overallScore,
    grade,
    headline,
    verdict,
    pillars,
  }
}

function buildRrCollapse(
  input: BuildExecutionReplayInput,
  drifts: ExecutionDriftItem[],
): ExecutionReplayRrCollapse | null {
  const rrDrift = drifts.find((drift) => drift.id === "changed_rr" || drift.id === "poor_rr")
  if (!rrDrift) return null

  const ctx = input.session?.planned_context
  const plannedRr = calculateRiskReward({
    direction: ctx?.direction || input.trade.direction,
    entry_price: ctx?.entry_price || String(input.trade.entry_price ?? ""),
    stop_loss: ctx?.stop_loss || String(input.trade.stop_loss ?? ""),
    take_profit: ctx?.take_profit || String(input.trade.take_profit ?? ""),
  })
  const actualRr =
    input.trade.risk_reward ??
    calculateRiskReward({
      direction: input.trade.direction,
      entry_price: String(input.trade.entry_price ?? ""),
      stop_loss: String(input.trade.stop_loss ?? ""),
      take_profit: String(input.trade.take_profit ?? ""),
    })

  if (plannedRr === null || actualRr === null) {
    return {
      plannedRr: plannedRr ?? 0,
      actualRr: actualRr ?? 0,
      delta: 0,
      severity: rrDrift.severity === "critical" ? "critical" : "warning",
      message: rrDrift.description,
    }
  }

  return {
    plannedRr,
    actualRr,
    delta: Number((actualRr - plannedRr).toFixed(2)),
    severity: Math.abs(actualRr - plannedRr) > 0.75 || rrDrift.severity === "critical" ? "critical" : "warning",
    message: rrDrift.description,
  }
}

function buildEntryComparisonFromComparisons(
  comparisons: PlannedVsActualComparison[],
): ExecutionReplayEntryComparison {
  const entryCompare = comparisons.find((item) => item.field === "Entry")
  const slCompare = comparisons.find((item) => item.field === "Stop loss")
  const tpCompare = comparisons.find((item) => item.field === "Take profit")
  const riskCompare = comparisons.find((item) => item.field === "Risk")

  const entryAligned = entryCompare?.aligned ?? true
  const stopAligned = slCompare?.aligned ?? true
  const targetAligned = tpCompare?.aligned ?? true

  return {
    plannedEntry: entryCompare?.planned ?? "—",
    actualEntry: entryCompare?.actual ?? "—",
    plannedStopLoss: slCompare?.planned ?? "—",
    actualStopLoss: slCompare?.actual ?? "—",
    plannedTakeProfit: tpCompare?.planned ?? "—",
    actualTakeProfit: tpCompare?.actual ?? "—",
    plannedRr: null,
    actualRr: riskCompare?.actual ?? null,
    entryAligned,
    stopAligned,
    targetAligned,
    summary:
      entryAligned && stopAligned && targetAligned
        ? "Execution matched the planned entry structure."
        : "Drift detected versus the pre-trade plan.",
  }
}

export function enrichExecutionReplayResult(result: ExecutionReplayResult): ExecutionReplayResult {
  const candles = result.candles?.length ? result.candles : buildCandleStates(result.events)
  const changes = result.changes?.length ? result.changes : buildChangeItems(result.comparisons)
  const rrCollapse =
    result.rrCollapse ??
    (result.drifts.some((drift) => drift.id === "changed_rr" || drift.id === "poor_rr")
      ? {
          plannedRr: 0,
          actualRr: 0,
          delta: 0,
          severity: "warning" as const,
          message:
            result.drifts.find((drift) => drift.id === "changed_rr" || drift.id === "poor_rr")
              ?.description ?? "Risk / reward drift detected.",
        }
      : null)
  const sessionRecap =
    result.sessionRecap ??
    (() => {
      const pillars = [
        { label: "Execution", score: result.analytics.executionQuality },
        { label: "Discipline", score: result.analytics.disciplineQuality },
        { label: "Emotion", score: result.analytics.emotionalStability },
        { label: "Rules", score: result.analytics.ruleAdherence },
      ]
      const overallScore = clamp(
        Math.round(pillars.reduce((sum, pillar) => sum + pillar.score, 0) / pillars.length),
      )
      return {
        overallScore,
        grade: gradeFromScore(overallScore),
        headline: result.analytics.summary,
        verdict: "review" as const,
        pillars,
      }
    })()
  const entryComparison = result.entryComparison ?? buildEntryComparisonFromComparisons(result.comparisons)
  const markers =
    result.markers?.length ? result.markers : buildTimelineMarkers(candles, result.drifts, result.events, rrCollapse)

  return {
    ...result,
    candles,
    markers,
    entryComparison,
    changes,
    sessionRecap,
    rrCollapse,
  }
}

export function buildExecutionReplay(input: BuildExecutionReplayInput): ExecutionReplayResult {
  const postTrade = resolvePostTradeAnalysis(input)
  const comparisons =
    input.feedback?.planned_vs_actual || postTrade?.plannedVsActual || []

  const playbookMatch = input.session?.planned_context?.playbook_match
  const drifts = detectExecutionDrifts(comparisons, input, playbookMatch)
  const analytics = buildAnalytics(input, comparisons, drifts, postTrade)

  const events: ExecutionReplayEvent[] = [
    buildPreTradePlanEvent(input),
    buildAiAnalysisEvent(input),
    buildEntryExecutionEvent(input, comparisons),
    buildEmotionDriftEvent(input, comparisons),
    buildRuleViolationsEvent(drifts, comparisons),
    buildTradeCloseEvent(input),
    buildAiDebriefEvent(input, postTrade, analytics),
  ]

  const candles = buildCandleStates(events)
  const rrCollapse = buildRrCollapse(input, drifts)
  const entryComparison = buildEntryComparison(input, comparisons)
  const changes = buildChangeItems(comparisons)
  const sessionRecap = buildSessionRecap(input, analytics, drifts)
  const markers = buildTimelineMarkers(candles, drifts, events, rrCollapse)

  return {
    version: 1,
    tradeId: input.trade.id,
    hasCoachSession: Boolean(input.session),
    events,
    drifts,
    analytics,
    comparisons,
    candles,
    markers,
    entryComparison,
    changes,
    sessionRecap,
    rrCollapse,
  }
}

export const REPLAY_PHASE_ORDER: ExecutionReplayPhase[] = [
  "pre_trade_plan",
  "ai_analysis",
  "entry_execution",
  "emotion_drift",
  "rule_violations",
  "trade_close",
  "ai_debrief",
]
