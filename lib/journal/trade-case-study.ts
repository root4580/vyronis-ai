import type { TradeIntelligenceBundle } from "@/lib/intelligence/trade-intelligence-types"
import type { MarketBiasRecord, PairPlanRecord } from "@/lib/strategy-brain/types"
import {
  compareSetupFingerprints,
  buildSetupFingerprint,
  type FingerprintComparison,
  type FingerprintTradeInput,
} from "@/lib/journal/setup-fingerprint"
import { findSimilarTradeMemory } from "@/lib/strategy-brain/trade-memory-engine"
import { defaultConfirmationChecklist } from "@/lib/strategy-brain/confirmation-engine"
import type { TradeDetails } from "@/components/dashboard/trade-details-modal"
import { scoreHtfAlignment } from "@/lib/learning/trade-memory-engine"

export type CaseStudySection = {
  id: string
  title: string
  summary: string
  bullets: string[]
  tone: "neutral" | "positive" | "warning" | "insight"
}

export type TradeCaseStudy = {
  sections: CaseStudySection[]
  fingerprint: FingerprintComparison
  memoryLine: string | null
  discretionaryNote: string
  needsIntelligenceSync: boolean
  historyTradeCount: number
}

function toneFromScore(score: number): CaseStudySection["tone"] {
  if (score >= 75) return "positive"
  if (score >= 50) return "neutral"
  return "warning"
}

export function buildTradeCaseStudy(input: {
  trade: TradeDetails
  bundle: TradeIntelligenceBundle | null
  history: FingerprintTradeInput[]
  pairPlan?: PairPlanRecord | null
  marketBias?: MarketBiasRecord | null
}): TradeCaseStudy {
  const { trade, bundle, history, pairPlan, marketBias } = input
  const fingerprint = compareSetupFingerprints(
    buildSetupFingerprint(trade),
    history.map(buildSetupFingerprint),
  )

  const memoryLine = findSimilarTradeMemory({
    pair: trade.pair,
    trades: history.map((t) => ({
      id: String(t.id),
      pair: t.pair,
      direction: t.direction,
      result: t.result,
      pnl: t.pnl ?? 0,
      emotion: t.emotion ?? null,
      setup: t.setup ?? null,
      confirmation_signal: t.confirmation_signal ?? null,
      mistake_tags: t.mistake_tags ?? null,
      trade_date: t.trade_date ?? null,
    })),
    confirmation: defaultConfirmationChecklist(),
    emotionUnstable: /fomo|revenge|anxious/i.test(trade.emotion || ""),
  })

  const htfScore = bundle
    ? Math.round(
        (bundle.historicalComparison.topMatches[0]?.similarityScore ?? 0) * 0.3 +
          scoreHtfAlignment(trade as Parameters<typeof scoreHtfAlignment>[0]) * 0.7,
      )
    : scoreHtfAlignment(trade as Parameters<typeof scoreHtfAlignment>[0])

  const structureBullets: string[] = []
  if (marketBias) {
    structureBullets.push(
      `Market: W ${marketBias.weekly_bias} · D ${marketBias.daily_bias} · H4 ${marketBias.h4_bias}`,
    )
    if (marketBias.conflict_summary) {
      structureBullets.push(marketBias.conflict_summary)
    }
  }
  if (pairPlan) {
    structureBullets.push(
      `Weekly plan: ${pairPlan.directional_bias} · AOI ${pairPlan.aoi_low ?? "—"} – ${pairPlan.aoi_high ?? "—"}`,
    )
    if (pairPlan.invalidation != null) {
      structureBullets.push(`Invalidation level: ${pairPlan.invalidation}`)
    }
    structureBullets.push(`AOI status: ${pairPlan.aoi_status.replace(/_/g, " ")}`)
  }
  const htf = (trade as TradeDetails & { higher_timeframe?: string | null }).higher_timeframe
  if (htf) {
    structureBullets.push(`Logged HTF: ${htf}`)
  }
  structureBullets.push(`Alignment score: ${htfScore}/100`)

  const confirmQuality = fingerprint.current.confirmationQuality
  const confirmationBullets = [
    trade.confirmation_signal
      ? `Signal: ${trade.confirmation_signal}`
      : "No confirmation signal logged",
    `Fingerprint quality: ${confirmQuality}`,
    ...(bundle?.analysis.coachingFeedback.slice(0, 2) ?? []),
  ]

  const emotionBullets = [
    `Before: ${bundle?.emotion.before.label ?? trade.emotion}`,
    bundle?.emotion.after
      ? `After: ${bundle.emotion.after.label}`
      : trade.emotion_after
        ? `After: ${trade.emotion_after}`
        : "Post-trade emotion not logged",
    bundle?.emotion.insight ?? "Log emotion on every trade for carryover detection.",
  ]
  if (bundle) {
    emotionBullets.push(`Recent stability index: ${bundle.emotion.emotionalStabilityScore}/100`)
  }

  const setupBullets = bundle
    ? [
        `Grade: ${bundle.setupScore.classification} (${bundle.setupScore.score})`,
        ...(bundle.setupScore.strengths.slice(0, 1).map((s) => `Strength: ${s}`)),
        ...(bundle.setupScore.warnings.slice(0, 2).map((w) => `Watch: ${w}`)),
        ...bundle.setupScore.insights.slice(0, 2).map((i) => i.message),
      ]
    : ["Tap Sync memory below for setup grade (A+/B/C) and coaching notes."]

  const mistakeBullets =
    bundle && bundle.tags.mistakeTags.length > 0
      ? bundle.tags.mistakeTags
      : fingerprint.current.mistakes.length > 0
        ? fingerprint.current.mistakes
        : ["No mistakes tagged — add tags when execution drifted."]

  const aiBullets = bundle
    ? [
        bundle.analysis.summary,
        ...bundle.analysis.coachingFeedback.slice(0, 3),
        ...(bundle.coachFeedback?.coaching_summary
          ? [`Coach: ${bundle.coachFeedback.coaching_summary}`]
          : []),
      ]
    : ["AI observations appear after intelligence sync."]

  const similarBulletsRaw = [
    ...(fingerprint.insight ? [fingerprint.insight] : []),
    ...(memoryLine && memoryLine !== fingerprint.insight ? [memoryLine] : []),
    ...fingerprint.losses.map((m) => m.narrative),
    ...fingerprint.wins.map((m) => m.narrative),
    ...(bundle?.comparisonNarratives ?? []),
  ]
  const similarBullets: string[] = []
  const seenSimilar = new Set<string>()
  for (const line of similarBulletsRaw) {
    const key = line.trim()
    if (!key || seenSimilar.has(key)) continue
    seenSimilar.add(key)
    similarBullets.push(line)
    if (similarBullets.length >= 6) break
  }
  if (similarBullets.length === 0) {
    similarBullets.push("Not enough journal history yet — fingerprints improve with each logged trade.")
  }

  const improveBullets: string[] = []
  if (bundle) {
    improveBullets.push(...bundle.tradeInsights.map((i) => i.message).slice(0, 4))
  }
  if (trade.result === "LOSS" && confirmQuality === "weak") {
    improveBullets.push("Wait for full confirmation before entry — your losses cluster on weak confirmation.")
  }
  if (/fomo|revenge/i.test(trade.emotion || "")) {
    improveBullets.push("Reset emotionally before the next decision — Session Guard is advisory, not a lock.")
  }
  if (pairPlan?.aoi_status === "INVALIDATED") {
    improveBullets.push("Weekly thesis invalidated — rebuild bias before re-engaging this pair.")
  }
  if (improveBullets.length === 0) {
    improveBullets.push("Maintain current process; document what made this trade repeatable or avoidable.")
  }

  const sections: CaseStudySection[] = [
    {
      id: "structure",
      title: "Structure alignment",
      summary: "HTF bias, weekly plan, and logged structure vs your doctrine.",
      bullets: structureBullets,
      tone: htfScore >= 70 ? "positive" : htfScore >= 50 ? "neutral" : "warning",
    },
    {
      id: "confirmation",
      title: "Confirmation quality",
      summary: "How clean the entry signal was — not whether Vyronis auto-enters.",
      bullets: confirmationBullets,
      tone: confirmQuality === "strong" ? "positive" : confirmQuality === "weak" ? "warning" : "neutral",
    },
    {
      id: "emotion",
      title: "Emotion analysis",
      summary: "Psychological state before and after — execution coach lens.",
      bullets: emotionBullets,
      tone: /fomo|revenge|anxious/i.test(trade.emotion || "") ? "warning" : "insight",
    },
    {
      id: "setup",
      title: "Setup quality",
      summary: "A+ scoring and grade explanation from your journal data.",
      bullets: setupBullets,
      tone: toneFromScore(bundle?.setupScore.score ?? 50),
    },
    {
      id: "mistakes",
      title: "Mistake analysis",
      summary: "Tagged execution and discipline errors.",
      bullets: mistakeBullets,
      tone: mistakeBullets[0]?.includes("No mistakes") ? "neutral" : "warning",
    },
    {
      id: "ai",
      title: "AI observations",
      summary: "Synthesized coaching — assists judgment, does not replace it.",
      bullets: aiBullets,
      tone: bundle?.analysis.verdict === "strong" ? "positive" : "insight",
    },
    {
      id: "similar",
      title: "Similar historical trades",
      summary: "Setup fingerprints compared to past wins and losses.",
      bullets: similarBullets,
      tone: fingerprint.losses.length >= 2 ? "warning" : "insight",
    },
    {
      id: "improve",
      title: "Improvement recommendations",
      summary: "Actionable focus for the next session — human executes.",
      bullets: improveBullets.slice(0, 5),
      tone: "insight",
    },
  ]

  return {
    sections,
    fingerprint,
    memoryLine,
    discretionaryNote:
      "AI coach only — you choose when to trade, entry timing, and size. Vyronis does not place orders.",
    needsIntelligenceSync: bundle == null,
    historyTradeCount: history.length,
  }
}
