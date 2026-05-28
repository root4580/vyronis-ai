import { resolveAiProvider } from "@/lib/ai/providers"
import type { CommandCenterMessageRecord } from "@/lib/command-center/types"
import type { CompanionIntent } from "@/lib/intelligence/companion-intent-engine"
import { detectCompanionIntent } from "@/lib/intelligence/companion-intent-engine"
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
import { evaluateTradeDecision } from "@/lib/intelligence/trade-decision-engine"

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
}): string {
  const name = input.context.traderName?.split(" ")[0] || "trader"

  const intentGuide: Record<CompanionIntent, string> = {
    casual_conversation: `Casual opener. Greet ${name} warmly. Do NOT lead with trade stats, warnings, or journal data. Ask a natural follow-up about their day or focus.`,
    market_check: "User wants a session read. Summarize today, planned setups, risk state, and one behavioral note — concise and grounded in data.",
    pre_trade_coaching: "Pre-trade mode. Help them think through the setup like a psychologist + risk manager. Reference historical similarity if provided.",
    post_trade_review: "Post-trade debrief. Compare plan vs execution. Be reflective, not punitive.",
    emotional_check_in: "Emotional support first. Slow them down. No trade pushing.",
    analytics_pattern: "Answer with journal patterns, mistakes, and stats. Be specific.",
  }

  const safetyBlock =
    input.freshWarnings.length > 0
      ? `\n## Safety warnings (respect — mention gently when relevant, never as the whole reply)\n${input.freshWarnings
          .map((w) => `- [${w.severity}] ${w.message}`)
          .join("\n")}`
      : ""

  const decisionBlock = input.decision
    ? `\n## Decision engine (ground your advice here)\nRecommendation: ${input.decision.recommendation}\nConfidence: ${input.decision.confidence}%\nEvidence:\n${input.decision.evidence.map((e) => `- ${e}`).join("\n")}\nNext question to consider: ${input.decision.nextQuestion}`
    : ""

  return [
    "You are Vyronis — an elite trading psychologist, risk manager, and market coach.",
    "You reason from the trader's real journal data. Sound like ChatGPT + coach, not a notification bot.",
    "Be concise (2-5 short paragraphs max). Use their name occasionally.",
    "Never invent trades or stats not in context. If data is missing, say so.",
    `Current intent: ${input.intent}. ${intentGuide[input.intent]}`,
    safetyBlock,
    decisionBlock,
    `\n## Trader context (source of truth)\n${serializeTraderContextForLlm(input.context)}`,
  ].join("\n")
}

function applySafetyWarnings(input: {
  body: string
  intent: CompanionIntent
  freshWarnings: ReturnType<typeof filterFreshWarnings>
  recentMessages: CommandCenterMessageRecord[]
}): { body: string; mentionedWarningIds: string[]; isCriticalHighlight: boolean } {
  const mentionedWarningIds: string[] = []
  let isCriticalHighlight = false
  let body = input.body

  if (input.intent === "casual_conversation") {
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

export async function generateCompanionIntelligenceReply(input: {
  userMessage: string
  context: FullTraderContext
  recentMessages: CommandCenterMessageRecord[]
}): Promise<CompanionChatEngineResult> {
  const intent = detectCompanionIntent(input.userMessage)
  const companionState = resolveStateForIntent(intent, input.context)
  const thinkingPhases = buildThinkingPhases({
    userMessage: input.userMessage,
    state: companionState,
    intent,
  })

  const mentionedIds = extractMentionedWarningIds(input.recentMessages)
  const freshWarnings = filterFreshWarnings(input.context.memory.warnings, mentionedIds)

  const decision =
    intent === "pre_trade_coaching" || input.context.activePlannedContext
      ? evaluateTradeDecision({
          context: input.context,
          mentionedWarningIds: mentionedIds,
        })
      : undefined

  const provider = resolveAiProvider()
  let engine: CompanionChatEngineResult["engine"] = "heuristic"
  let body = ""
  let followUpQuestion: string | undefined

  if (provider?.completeText) {
    try {
      const systemPrompt = buildSystemPrompt({
        intent,
        context: input.context,
        freshWarnings,
        decision: decision ?? undefined,
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
        maxTokens: 700,
        temperature: intent === "casual_conversation" ? 0.6 : 0.35,
      })
      engine = "llm"
    } catch {
      body = ""
    }
  }

  if (!body.trim()) {
    const fallback = generateCompanionDialogue({
      userMessage: input.userMessage,
      memory: input.context.memory,
      recentTrades: input.context.recentTrades,
      recentMessages: input.recentMessages,
      traderName: input.context.traderName,
    })
    body = fallback.content
    followUpQuestion = fallback.followUpQuestion
    engine = "heuristic"
  }

  followUpQuestion =
    followUpQuestion ||
    pickFollowUpQuestion({
      state: companionState,
      memory: input.context.memory,
      userMessage: input.userMessage,
      intent,
    }) ||
    decision?.nextQuestion

  const safety = applySafetyWarnings({
    body,
    intent,
    freshWarnings,
    recentMessages: input.recentMessages,
  })

  if (followUpQuestion && !safety.body.includes(followUpQuestion)) {
    safety.body = `${safety.body} ${followUpQuestion}`
  }

  return {
    content: safety.body.trim(),
    followUpQuestion,
    companionState,
    thinkingPhases,
    mentionedWarningIds: safety.mentionedWarningIds,
    isCriticalHighlight: safety.isCriticalHighlight,
    intent,
    engine,
    decision: decision ?? undefined,
    primaryLeak: input.context.memory.primaryLeak,
    topPatterns: input.context.memory.topPatterns,
  }
}
