import { resolveAiProvider } from "@/lib/ai/providers"
import type { CommandCenterMessageRecord } from "@/lib/command-center/types"
import type { CompanionIntent } from "@/lib/intelligence/companion-intent-engine"
import {
  isAnalysisIntent,
  resolveCompanionIntentWithMedia,
} from "@/lib/intelligence/companion-intent-engine"
import { pickTraderMemoryLines } from "@/lib/intelligence/trader-memory-retrieval"
import { generateCompanionDialogue } from "@/lib/intelligence/companion-dialogue-engine"
import {
  extractMentionedWarningIds,
  filterFreshWarnings,
  weaveWarningInline,
  wasWarningMentionedRecently,
} from "@/lib/intelligence/conversation-continuity"
import {
  buildThinkingPhases,
  pickFollowUpQuestion,
} from "@/lib/intelligence/conversational-state-engine"
import type { CompanionConversationalState } from "@/lib/intelligence/conversational-types"
import type {
  CompanionChatEngineResult,
  FullTraderContext,
  TradeDecisionResult,
} from "@/lib/intelligence/intelligence-types"
import {
  serializeTraderContextForLlm,
} from "@/lib/intelligence/trader-context-builder"
import { serializeBundleVisionForLlm } from "@/lib/intelligence/command-center-bundle-vision-engine"
import {
  serializeVisionForLlm,
  type CommandCenterVisionAnalysis,
} from "@/lib/intelligence/command-center-vision-engine"
import {
  assembleChartReviewReply,
  evaluateChartReviewDecision,
  formatChartReviewFooter,
  hasChartReviewFooter,
  buildChartReviewFooter,
  reconcileChartReviewVerdict,
} from "@/lib/intelligence/chart-review-format"
import {
  buildComparativeMemoryLine,
} from "@/lib/intelligence/comparative-memory-engine"
import { synthesizeMtfNarrative } from "@/lib/intelligence/mtf-synthesis-engine"
import {
  resolveTraderResponseMode,
  TRADER_MODE_LABELS,
} from "@/lib/intelligence/trader-response-mode"
import { evaluateTradeDecision } from "@/lib/intelligence/trade-decision-engine"
import { enrichTraderContextWithCognitive } from "@/lib/cognitive/orchestrator"
import { enrichTraderContextWithTradingOs } from "@/lib/trading-os/orchestrator"
import { enrichTraderContextWithAdaptiveCognition } from "@/lib/adaptive-cognition/orchestrator"
import { enrichTraderContextWithVyronisCore } from "@/lib/vyronis-core/orchestrator"
import { buildEmotionalIntelligence } from "@/lib/intelligence/emotional-intelligence-engine"
import {
  inferMessageTone,
  mapToneForCognitive,
} from "@/lib/intelligence/tone-memory-engine"

function joinParts(parts: string[]): string {
  return parts.filter(Boolean).join(" ")
}

function resolveStateForIntent(
  intent: CompanionIntent,
  context: FullTraderContext,
): CompanionConversationalState {
  if (intent === "casual_conversation") return "calm"
  if (intent === "emotional_check_in") return "reflective"
  if (intent === "market_check") return context.memory.snapshot.plannedCount > 0 ? "analytical" : "calm"
  if (intent === "pre_trade_coaching") return "analytical"
  if (intent === "post_trade_review") return "reflective"
  if (context.memory.warnings.some((w) => w.severity === "critical")) return "protective"
  if (context.memory.warnings.some((w) => w.source === "pattern")) return "warning"
  return "calm"
}

function buildConversationBlock(messages: CommandCenterMessageRecord[]): string {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-12)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n")
}

function buildSystemPrompt(input: {
  intent: CompanionIntent
  context: FullTraderContext
  freshWarnings: ReturnType<typeof filterFreshWarnings>
  decision?: TradeDecisionResult
  visionBlock?: string
  isChartReview?: boolean
  traderMode?: ReturnType<typeof resolveTraderResponseMode>
  memoryLines?: string[]
  userMessage?: string
  needsDeepContext?: boolean
}): string {
  const name = input.context.traderName?.split(" ")[0] || "trader"
  const conversational =
    input.intent === "casual_conversation" || input.intent === "emotional_check_in"
  const needsDeepContext =
    input.needsDeepContext ??
    (input.isChartReview || isAnalysisIntent(input.intent) || Boolean(input.decision))

  const intentGuide: Record<CompanionIntent, string> = {
    casual_conversation: `Casual opener — greet ${name} like a calm trading psychologist. One warm line + one short question. No stats dump, no warnings unless critical.`,
    market_check: `${name} wants a session pulse — 2-3 sentences: today P&L, trade count, one behavioral note.`,
    pre_trade_coaching: `Chart/setup coaching for ${name}. Sound like a strategist, not a dashboard. Lead with human read, then verdict.`,
    post_trade_review: `Reflective debrief for ${name} — plan vs execution, one lesson, no shame.`,
    emotional_check_in: `Support ${name} first — slow down, validate feelings, no trade pushing or warning spam.`,
    analytics_pattern: `Answer ${name} with specific journal patterns — tight, evidence-based, not a data dump.`,
  }

  const safetyBlock =
    !conversational && input.freshWarnings.length > 0
      ? `\n## Fresh warnings (mention at most ONE if relevant — never repeat warnings already in thread)\n${input.freshWarnings
          .slice(0, 2)
          .map((w) => `- [${w.severity}] ${w.message}`)
          .join("\n")}`
      : conversational && input.freshWarnings.some((w) => w.severity === "critical")
        ? `\n## Critical only (one line if needed)\n${input.freshWarnings.find((w) => w.severity === "critical")?.message}`
        : ""

  const vr = input.decision?.weightedConfidence?.verdictReasoning
  const decisionBlock = input.decision && (input.isChartReview || needsDeepContext)
    ? `\n## Verdict engine (authoritative)\n` +
      (vr
        ? `Technical quality: ${vr.technicalSetupVerdict} (${vr.technicalSetupScore}/100)\n` +
          `Emotional state: ${vr.traderStateVerdict} (${vr.traderStateScore}/100)\n` +
          `Risk conditions: ${vr.riskConditionsVerdict} (${vr.riskConditionsScore}/100)\n` +
          `Final verdict: ${vr.verdict} (${input.decision.confidence}%)\n` +
          `${vr.finalDecisionExplanation}\n` +
          (vr.psychologyClarification ? `${vr.psychologyClarification}\n` : "") +
          (vr.psychologyOverride && vr.overrideReasons.length > 0
            ? `Override conditions: ${vr.overrideReasons.join("; ")}\n`
            : vr.psychologyOverride
              ? "Aligned setup but SKIP — psychology/risk overrides; chart is not the main problem.\n"
              : "")
        : `Verdict: ${input.decision.recommendation} (${input.decision.confidence}%)\n`) +
      `Dominant factor: ${vr?.dominantDecidingFactor ?? input.decision.evidence[0] ?? "weighted score"}`
    : ""

  const modeGuide = input.traderMode
    ? `Active mode: ${TRADER_MODE_LABELS[input.traderMode.mode]}. ${input.traderMode.toneGuide}`
    : ""

  const memoryBlock =
    input.memoryLines && input.memoryLines.length > 0
      ? `\n## Organic memory (weave ONE line naturally if relevant — never list as "memory")\n${input.memoryLines.map((l) => `- ${l}`).join("\n")}`
      : ""

  const toneBlock =
    input.context.toneMemory?.companionStyleHint && !conversational
      ? `\n## Conversational tone memory\n${input.context.toneMemory.companionStyleHint}`
      : input.context.toneMemory?.companionStyleHint && conversational
        ? `\n## Tone\n${input.context.toneMemory.companionStyleHint}`
        : ""

  const emotionalBlock =
    input.context.emotionalIntelligence &&
    (needsDeepContext || input.isChartReview)
      ? `\n## Emotional intelligence (infer — do not ask user to label their mood)\n` +
        `Headline: ${input.context.emotionalIntelligence.headline}\n` +
        `${input.context.emotionalIntelligence.narrative}\n` +
        (input.context.traderStateTimeline
          ? `State timeline: ${input.context.traderStateTimeline.narrative}\n`
          : "") +
        (input.context.verdictCalibration?.sampleCount &&
        input.context.verdictCalibration.sampleCount >= 3
          ? `Calibration: ${input.context.verdictCalibration.narrative}\n`
          : "")
      : input.context.emotionalIntelligence && conversational
        ? `\n## Trader read\n${input.context.emotionalIntelligence.headline}`
        : ""

  const autonomousBlock =
    needsDeepContext && input.context.autonomous
    ? `\n## Autonomous intelligence (proactive — weave naturally, do not dump scores)\n` +
      `Shadow: ${input.context.autonomous.shadow.proactiveMessage}\n` +
      `Session: ${input.context.autonomous.session.narrative}\n` +
      (input.context.autonomous.patternMatch.narrative
        ? `Pattern memory: ${input.context.autonomous.patternMatch.narrative}\n`
        : "") +
      (input.context.autonomous.traderDna.weeklyInsight
        ? `DNA insight: ${input.context.autonomous.traderDna.weeklyInsight}\n`
        : "") +
      `Tone: calm companion, not dashboard. Lead with guidance when risk is elevated.`
    : ""

  const cog = input.context.cognitive
  const os = input.context.tradingOs
  const ac = input.context.adaptiveCognition
  const core = input.context.vyronisCore
  const vyronisCoreBlock =
    needsDeepContext && input.isChartReview && core
    ? `\n## Vyronis unified core (Phase 5 pre-trade — authoritative)\n` +
      `Pre-trade: ${core.phase5.preTradeApproval.headline} → ${core.phase5.preTradeApproval.verdict}\n` +
      `Status: ${core.phase5.preTradeApproval.status} · Risk mult: ${core.phase5.preTradeApproval.riskMultiplier}\n` +
      (core.phase5.preTradeApproval.psychologyOverride
        ? "Psychology override may block TAKE despite chart quality.\n"
        : "") +
      `Setup probability: ${core.phase5.setupProbability.score}/100\n` +
      `Confidence decay: ${core.phase5.confidenceDecay.currentConfidence}/100\n` +
      `Live state: ${core.phase5.liveTraderState.narrative}\n` +
      (core.phase5.interventionPrompt ? `Intervention: ${core.phase5.interventionPrompt}\n` : "")
    : ""

  const adaptiveBlock =
    needsDeepContext && !conversational && ac
    ? `\n## Adaptive cognition (philosophy: market is the mirror — optimize the human)\n` +
      `Becoming: ${ac.identity.becoming}\n` +
      `Identity maturity: ${ac.identity.overallMaturity}/100 · ${ac.identity.archetype}\n` +
      `${ac.headline}\n` +
      (ac.performance.luckyWinWarning ? `Lucky win warning: ${ac.performance.luckyWinWarning}\n` : "") +
      `Companion style: ${ac.companion.communicationStyle} · Challenge: ${ac.companion.challengeLevel}\n` +
      `Irrational checks:\n${ac.companion.irrationalThinkingChecks.map((c) => `- ${c}`).join("\n")}\n` +
      `Proactive insights:\n${ac.insights.slice(0, 3).map((i) => `- ${i.message}`).join("\n")}\n` +
      `Personal OS mode: ${ac.personalOs.recommendedMode} — ${ac.personalOs.dailyReflectionPrompt}`
    : ""

  const tradingOsBlock =
    needsDeepContext && os?.intervention.active
      ? os
      : needsDeepContext && os && !conversational
        ? os
        : null
  const tradingOsBlockStr = tradingOsBlock
    ? (() => {
        const snap = tradingOsBlock
        return (
          `\n## Autonomous Trading OS (proactive — enforce when active)\n` +
          `Headline: ${snap.proactiveHeadline}\n` +
          (snap.intervention.active
            ? `INTERVENTION ACTIVE: ${snap.intervention.message}\n` +
              `Can proceed to entry: ${snap.intervention.canProceedToEntry ? "yes" : "NO"}\n` +
              (snap.intervention.reflectionPrompt
                ? `Reflection required: ${snap.intervention.reflectionPrompt}\n`
                : "")
            : "") +
          (snap.liveSession.alerts[0]
            ? `Live alert: ${snap.liveSession.alerts[0].message}\n`
            : "") +
          `Strategy: ${snap.strategy.adaptiveGuidance[0] ?? "Follow playbook"}`
        )
      })()
    : ""

  const cognitiveBlock =
    needsDeepContext && !conversational && cog
    ? `\n## Cognitive architecture (authoritative — adapt tone and strictness)\n` +
      `Trader state: ${cog.state.primary} — ${cog.state.narrative}\n` +
      `Coaching mode: ${cog.coaching.mode} — ${cog.coaching.headline}\n` +
      `${cog.coaching.toneGuide}\n` +
      `Verdict strictness: ${cog.state.verdictStrictness}/100 · Risk permission: ${cog.state.riskPermission}/100\n` +
      `Market environment: ${cog.marketEnvironment.labels.join(", ")} — ${cog.marketEnvironment.tradingBias}\n` +
      (cog.confidenceGraph.fakeConfidence
        ? "Confidence warning: perceived confidence exceeds trade quality (fake confidence).\n"
        : "") +
      (cog.confidenceGraph.hesitationPattern
        ? "Confidence warning: hesitation pattern — do not rush into marginal setups.\n"
        : "") +
      `Predictions: ${cog.predictions.narrative}\n` +
      `Cross-memory: ${cog.memory.crossMemorySynthesis}`
    : ""

  const chartVerdict = input.decision?.weightedConfidence?.verdictReasoning?.verdict
    ?? input.decision?.recommendation
  const chartReviewGuide = input.isChartReview
    ? [
        "CHART REVIEW — synthesize, don't list each timeframe.",
        `- OPENING SENTENCE MUST reflect final verdict ${chartVerdict ?? "from engine"} — never sound like a green light if verdict is CAUTION or SKIP.`,
        chartVerdict === "CAUTION"
          ? "- CAUTION tone: acknowledge chart edge, then emphasize smaller/slower/wait-for-confirmation. Forbidden: 'good opportunity', 'take this', 'solid setup today'."
          : chartVerdict === "SKIP"
            ? "- SKIP tone: stand down first; chart quality is secondary. Forbidden: bullish entry language."
            : "- TAKE tone: structure and state align — still mention risk and invalidation.",
        "- Lead with one synthesized HTF vs LTF read (e.g. HTF bullish but LTF fighting trend).",
        "- ONE comparative journal line (winners/losers/emotional pattern) woven naturally.",
        "- Verdict MUST match engine decision in ## Verdict engine block — never contradict it.",
        "- If final is SKIP but technical setup is TAKE/CAUTION, say psychology/trader state overrides — chart is not the main problem.",
        "- Use Technical quality / Emotional state / Risk conditions / Final reasoning from the verdict engine.",
        "- Do NOT repeat full verdict reasoning in the footer — UI shows expandable detail.",
        "- SKIP only when critical blockers override strong metrics; otherwise use CAUTION.",
        "- Footer (exact labels):",
        "**Bias:** | **Setup Quality:** | **Risk State:** | **Verdict:** (engine verdict + score/100) | **One thing to wait for:** | **Mindset:** (only if psych risk)",
        "- Footer labels only: Bias, Setup Quality, Risk State, Verdict, wait-for, Mindset if needed.",
        `- Max ${input.traderMode?.maxParagraphs ?? 2} short paragraphs before footer.`,
      ].join("\n")
    : ""

  return [
    "You are Vyronis — a calm, intelligent trading companion (not a dashboard bot).",
    "Conversation first, analytics second. Never invent trades.",
    modeGuide,
    input.isChartReview
      ? chartReviewGuide
      : "Keep casual replies to 1-2 sentences. One natural follow-up question max.",
    input.visionBlock && !input.isChartReview
      ? "Vision data is attached — reference trend/structure briefly; do not contradict it."
      : "",
    input.visionBlock && input.isChartReview
      ? `\n## Vision ground truth\n${input.visionBlock}`
      : "",
    `Intent: ${input.intent}. ${intentGuide[input.intent]}`,
    memoryBlock,
    toneBlock,
    emotionalBlock,
    autonomousBlock,
    cognitiveBlock,
    tradingOsBlockStr,
    adaptiveBlock,
    vyronisCoreBlock,
    safetyBlock,
    decisionBlock,
    !input.isChartReview
      ? `\n## Trader context\n${serializeTraderContextForLlm(input.context, conversational ? "lite" : "full")}`
      : `\n## Trader snapshot\nToday: ${input.context.memory.snapshot.todayTradeCount} trades, ${input.context.memory.snapshot.todayPnL >= 0 ? "+" : ""}${input.context.memory.snapshot.todayPnL.toFixed(2)} P&L.`,
  ]
    .filter(Boolean)
    .join("\n")
}

function applySafetyWarnings(input: {
  body: string
  intent: CompanionIntent
  freshWarnings: ReturnType<typeof filterFreshWarnings>
  recentMessages: CommandCenterMessageRecord[]
  skipForChartReview?: boolean
}): { body: string; mentionedWarningIds: string[]; isCriticalHighlight: boolean } {
  const mentionedWarningIds: string[] = []
  let isCriticalHighlight = false
  let body = input.body

  if (input.skipForChartReview && hasChartReviewFooter(body)) {
    return { body, mentionedWarningIds, isCriticalHighlight }
  }

  if (input.intent === "casual_conversation" || input.intent === "emotional_check_in") {
    const critical = input.freshWarnings.find((w) => w.severity === "critical")
    if (critical && !wasWarningMentionedRecently(input.recentMessages, critical.id)) {
      body = joinParts([body, `One heads-up when you're ready: ${critical.message}`])
      mentionedWarningIds.push(critical.id)
      isCriticalHighlight = true
    }
    return { body, mentionedWarningIds, isCriticalHighlight }
  }

  const critical = input.freshWarnings.find((w) => w.severity === "critical")
  const inlineWarning =
    critical || input.freshWarnings.find((w) => w.source !== "planned" && w.source !== "leak")

  if (inlineWarning && !wasWarningMentionedRecently(input.recentMessages, inlineWarning.id)) {
    const woven = weaveWarningInline(inlineWarning, false)
    if (woven && !body.includes(inlineWarning.message.slice(0, 24))) {
      body = joinParts([body, woven])
      mentionedWarningIds.push(inlineWarning.id)
      if (inlineWarning.severity === "critical") isCriticalHighlight = true
    }
  }

  return { body, mentionedWarningIds, isCriticalHighlight }
}

function buildHeuristicChartReview(input: {
  context: FullTraderContext
  chartVision: CommandCenterVisionAnalysis
  decision: TradeDecisionResult
  mentionedIds: Set<string>
}): string {
  return assembleChartReviewReply({
    context: input.context,
    chartVision: input.chartVision,
    decision: input.decision,
    mentionedWarningIds: input.mentionedIds,
  })
}

export async function generateCompanionIntelligenceReply(input: {
  userMessage: string
  context: FullTraderContext
  recentMessages: CommandCenterMessageRecord[]
  chartVision?: CommandCenterVisionAnalysis | null
}): Promise<CompanionChatEngineResult> {
  const isBundle = Boolean(input.chartVision?.bundle)
  const hasImage = Boolean(input.chartVision?.imageUrl)
  const isChartReview = hasImage && Boolean(input.chartVision?.vision || input.chartVision?.bundle)
  const intent = resolveCompanionIntentWithMedia(input.userMessage, hasImage)

  if (input.chartVision && !input.chartVision.available) {
    return {
      content: input.chartVision.summary,
      companionState: "analytical",
      thinkingPhases: ["Reading your chart…"],
      mentionedWarningIds: [],
      intent,
      engine: "vision",
      primaryLeak: input.context.memory.primaryLeak,
      topPatterns: input.context.memory.topPatterns,
      chartVision: input.chartVision,
    }
  }

  const messageTone = inferMessageTone(input.userMessage)
  const cognitiveTone = mapToneForCognitive(messageTone)

  const preEmotional = buildEmotionalIntelligence({
    context: input.context,
    stateTimeline: input.context.traderStateTimeline,
    recentMessageTone: messageTone,
  })

  const baseContext = enrichTraderContextWithCognitive(
    { ...input.context, emotionalIntelligence: preEmotional },
    {
      chartVision: input.chartVision ?? undefined,
      recentMessageTone: cognitiveTone,
    },
  )
  const withOs = enrichTraderContextWithTradingOs(baseContext, {
    lastKnownSession: baseContext.tradingOs?.liveSession.activeSession ?? null,
  })
  const withAdaptive = enrichTraderContextWithAdaptiveCognition(withOs, {
    lifeContextHistory:
      input.context.adaptiveCognition?.lifeContext.recentEntries ??
      withOs.adaptiveCognition?.lifeContext.recentEntries,
  })
  const withVyronis = enrichTraderContextWithVyronisCore(
    withAdaptive,
    input.chartVision ?? undefined,
  )
  const emotionalIntelligence = buildEmotionalIntelligence({
    context: withVyronis,
    stateTimeline: withVyronis.traderStateTimeline,
    recentMessageTone: messageTone,
  })
  const context: FullTraderContext = { ...withVyronis, emotionalIntelligence }

  const mentionedIds = extractMentionedWarningIds(input.recentMessages)
  const freshWarnings = filterFreshWarnings(context.memory.warnings, mentionedIds)

  const needsDeepContext =
    isChartReview ||
    isAnalysisIntent(intent) ||
    Boolean(context.activePlannedContext)

  const baseDecision = needsDeepContext
    ? evaluateTradeDecision({
        context,
        mentionedWarningIds: mentionedIds,
      })
    : null

  const decision = isChartReview
    ? evaluateChartReviewDecision({
        context,
        chartVision: input.chartVision,
        mentionedWarningIds: mentionedIds,
        baseDecision,
      })
    : baseDecision ?? undefined

  const traderMode = resolveTraderResponseMode({
    context,
    decision,
    chartVision: input.chartVision,
    intent,
  })

  const companionState = traderMode.companionState

  const memoryLines = pickTraderMemoryLines({
    context,
    userMessage: input.userMessage,
    outcomeLessons: context.outcomeLessons,
    maxLines: isChartReview ? 2 : 1,
  })

  const thinkingPhases = isBundle
    ? [
        "Analyzing timeframe bundle…",
        "Reading timeframe labels on each chart…",
        "Comparing Weekly → Daily → H4 → H1 → M15 → M5…",
        "Checking HTF alignment and entry timing…",
        "Pulling journal similarities…",
      ]
    : hasImage
      ? [
          "Reading your chart…",
          "Checking HTF vs LTF…",
          "Comparing to your journal…",
          "Building your verdict…",
        ]
      : buildThinkingPhases({
          userMessage: input.userMessage,
          state: companionState,
          intent,
        })

  const visionBlock = input.chartVision?.bundle
    ? serializeBundleVisionForLlm(input.chartVision.bundle)
    : input.chartVision?.vision
      ? serializeVisionForLlm(input.chartVision)
      : undefined

  const provider = resolveAiProvider()
  let engine: CompanionChatEngineResult["engine"] = "heuristic"
  let body = ""
  let followUpQuestion: string | undefined

  if (isChartReview && decision) {
    if (provider?.completeText) {
      try {
        const synthesis = input.chartVision?.bundle
          ? synthesizeMtfNarrative(input.chartVision.bundle)
          : null
        const memoryLine = buildComparativeMemoryLine({
          context,
          chartVision: input.chartVision,
        })

        const systemPrompt = buildSystemPrompt({
          intent,
          context,
          freshWarnings,
          decision,
          visionBlock,
          isChartReview: true,
          traderMode,
          memoryLines,
          userMessage: input.userMessage,
          needsDeepContext: true,
        })

        const conversation = buildConversationBlock(input.recentMessages)
        const userPrompt = [
          conversation ? `## Recent conversation\n${conversation}` : "",
          input.chartVision?.bundle
            ? `## ${input.chartVision.bundle.imageUrls.length}-chart bundle (${input.chartVision.bundle.inferredStack})`
            : "## Single chart upload",
          synthesis ? `## Synthesized read\n${synthesis}` : "",
          memoryLine ? `## Journal comparison\n${memoryLine}` : "",
          decision?.weightedConfidence
            ? `## Weighted score\n${decision.weightedConfidence.reasoningSummary}`
            : "",
          `## Message\n${input.userMessage}`,
        ]
          .filter(Boolean)
          .join("\n\n")

        body = await provider.completeText({
          systemPrompt,
          userPrompt,
          maxTokens: 420,
          temperature: 0.32,
        })
        engine = "vision"
      } catch {
        body = ""
      }
    }

    if (!body.trim() || !hasChartReviewFooter(body)) {
      body = buildHeuristicChartReview({
        context,
        chartVision: input.chartVision!,
        decision,
        mentionedIds,
      })
      engine = "vision"
    }
  } else if (provider?.completeText) {
    try {
      const systemPrompt = buildSystemPrompt({
        intent,
        context,
        freshWarnings,
        decision: decision ?? undefined,
        visionBlock,
        traderMode,
        memoryLines,
        userMessage: input.userMessage,
        needsDeepContext,
      })

      const conversation = buildConversationBlock(input.recentMessages)
      const userPrompt = [
        conversation ? `## Recent conversation\n${conversation}` : "",
        `## Current message\n${input.userMessage}`,
      ]
        .filter(Boolean)
        .join("\n\n")

      body = await provider.completeText({
        systemPrompt,
        userPrompt,
        maxTokens: intent === "casual_conversation" ? 280 : 500,
        temperature: intent === "casual_conversation" ? 0.62 : 0.38,
      })
      engine = "llm"
    } catch {
      body = ""
    }
  }

  if (!body.trim()) {
    if (isChartReview && decision && input.chartVision) {
      body = buildHeuristicChartReview({
        context,
        chartVision: input.chartVision,
        decision,
        mentionedIds,
      })
      engine = "vision"
    } else {
      const fallback = generateCompanionDialogue({
        userMessage: input.userMessage,
        memory: context.memory,
        recentTrades: context.recentTrades,
        recentMessages: input.recentMessages,
        traderName: context.traderName,
      })
      body = fallback.content
      followUpQuestion = fallback.followUpQuestion
      engine = "heuristic"
    }
  }

  if (!isChartReview) {
    const conversationalIntent =
      intent === "casual_conversation" || intent === "emotional_check_in"
    followUpQuestion =
      followUpQuestion ||
      pickFollowUpQuestion({
        state: companionState,
        memory: context.memory,
        userMessage: input.userMessage,
        intent,
      }) ||
      (conversationalIntent ? undefined : decision?.nextQuestion)
  }

  if (isChartReview && decision && input.chartVision) {
    body = reconcileChartReviewVerdict({
      content: body,
      context,
      decision,
      chartVision: input.chartVision,
      mentionedWarningIds: mentionedIds,
    })
  }

  const safety = applySafetyWarnings({
    body,
    intent,
    freshWarnings,
    recentMessages: input.recentMessages,
    skipForChartReview: isChartReview,
  })

  if (
    followUpQuestion &&
    !safety.body.includes(followUpQuestion) &&
    !hasChartReviewFooter(safety.body)
  ) {
    safety.body = `${safety.body} ${followUpQuestion}`
  }

  return {
    content: safety.body.trim(),
    followUpQuestion: isChartReview ? decision?.nextQuestion : followUpQuestion,
    companionState,
    thinkingPhases,
    mentionedWarningIds: safety.mentionedWarningIds,
    isCriticalHighlight: safety.isCriticalHighlight,
    intent,
    engine,
    decision: isChartReview && decision ? decision : undefined,
    primaryLeak: context.memory.primaryLeak,
    topPatterns: context.memory.topPatterns,
    chartVision: input.chartVision ?? undefined,
  }
}
