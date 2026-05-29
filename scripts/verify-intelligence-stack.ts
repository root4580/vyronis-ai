/**
 * Local verification for emotional intelligence, calibration, tone, and phase 7.
 * Run: npx tsx scripts/verify-intelligence-stack.ts
 */
import { buildEmotionalIntelligence } from "../lib/intelligence/emotional-intelligence-engine"
import { buildTraderStateTimeline } from "../lib/intelligence/trader-state-timeline-engine"
import { computeVerdictCalibration } from "../lib/intelligence/verdict-calibration-engine"
import {
  inferMessageTone,
  mapToneForCognitive,
  toneMemoryFromMessages,
} from "../lib/intelligence/tone-memory-engine"
import { resolveVerdictWithReasoning } from "../lib/intelligence/verdict-reasoning-engine"
import { buildPreTradeApproval } from "../lib/vyronis-core/phase5-engine"
import { evaluateShadowMode } from "../lib/autonomous/shadow-mode-engine"
import { buildSessionRecovery } from "../lib/intelligence/session-recovery-engine"
import { evaluateAutonomousIntervention } from "../lib/trading-os/intervention-layer"
import { monitorLiveSession } from "../lib/trading-os/live-session-monitor"
import { buildVisionIntelligenceSnapshot } from "../lib/vyronis-core/phase7-engine"
import { buildOutcomeLesson } from "../lib/learning/outcome-learning-engine"
import type { FullTraderContext } from "../lib/intelligence/intelligence-types"
import type { ConfidenceFactor } from "../lib/intelligence/weighted-confidence-engine"

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log(`  ✓ ${msg}`)
}

const stubPrimaryLeak = {
  id: "stub",
  status: "insufficient_data" as const,
  confidence: 0,
  headline: "",
  correctiveAction: "",
  dimensions: [],
  evidence: null,
  minTradesRequired: 10,
  tradesRemaining: 10,
}

function baseContext(overrides: Partial<FullTraderContext> = {}): FullTraderContext {
  return {
    traderName: "Alex",
    preferredSession: "NY Session",
    settings: {
      starting_balance: 10000,
      daily_drawdown_limit: 5,
      max_risk_per_trade: 1,
      max_trades_per_day: 3,
      prop_firm_size: 100000,
      profit_target: 10,
      preferred_session: "NY Session",
    },
    risk: { todayLossPercent: 2, todayPnL: -80, tradesRemaining: 1 },
    dailyRules: [{ rule: "Max 3 trades", checked: true }],
    memory: {
      snapshot: {
        tradeCount: 5,
        todayTradeCount: 2,
        todayPnL: -80,
        winRate: 42,
        plannedCount: 0,
        unreadSignalCount: 0,
      },
      primaryLeak: stubPrimaryLeak,
      warnings: [],
      topPatterns: [],
      plannedSessions: [],
      greeting: { headline: "", subline: "", sessionLabel: "NY" },
    },
    recentTrades: [
      {
        id: "t1",
        pair: "EURUSD",
        direction: "LONG",
        result: "LOSS",
        pnl: -50,
        emotion: "revenge",
        session: "London",
        trade_date: "2026-05-27",
        created_at: "2026-05-27",
        rule_followed: false,
      },
      {
        id: "t2",
        pair: "GBPUSD",
        direction: "SHORT",
        result: "LOSS",
        pnl: -30,
        emotion: "fomo",
        session: "London",
        trade_date: "2026-05-27",
        created_at: "2026-05-27",
        rule_followed: false,
      },
    ],
    mistakeHeatmap: [],
    emotionalState: {
      dominantEmotion: "revenge",
      impulsiveCount: 2,
      recentEmotions: ["revenge", "fomo"],
      trend: "volatile",
      note: "Elevated",
    },
    sessionPerformance: [],
    weeklyReview: null,
    playbooks: [],
    compressedMemories: [],
    recentMessages: [],
    activePlannedContext: null,
    autonomous: {
      shadow: {
        emotionalRiskScore: 78,
        disciplineConfidence: 42,
        executionQualityPrediction: 40,
        overtradingProbability: 55,
        revengeTradingSignal: 62,
        impulsiveEntryLikelihood: 58,
        disciplineDrift: 30,
        overallRiskLevel: "high",
        flags: [],
        proactiveMessage: "Elevated risk",
        shouldPause: true,
      },
    } as unknown as FullTraderContext["autonomous"],
    ...overrides,
  } as FullTraderContext
}

const factors: ConfidenceFactor[] = [
  { key: "htf", label: "HTF", score: 72, weight: 0.18, note: "aligned" },
  { key: "confirmation", label: "Confirm", score: 68, weight: 0.14, note: "ok" },
  { key: "emotional", label: "Emotional", score: 35, weight: 0.14, note: "volatile" },
  { key: "performance", label: "Perf", score: 40, weight: 0.12, note: "losses" },
]

console.log("\n=== Tone inference ===")
assert(inferMessageTone("I'm not sure if I should take this") === "hesitant", "hesitant")
assert(inferMessageTone("This is a sure thing can't lose") === "overconfident", "overconfident")
assert(mapToneForCognitive("hesitant") === "anxious", "map hesitant")

console.log("\n=== Emotional intelligence ===")
const ctx = baseContext()
const ei = buildEmotionalIntelligence({ context: ctx, recentMessageTone: "hesitant" })
assert(ei.activeSignals.includes("revenge_behavior"), "detects revenge")
assert(ei.activeSignals.includes("emotional_drift"), "detects drift")
assert(ei.impulsiveRiskScore >= 50, "elevated impulsive risk")

console.log("\n=== State timeline ===")
const timeline = buildTraderStateTimeline(
  [
    {
      snapshot: { state: { primary: "impulsive", verdictStrictness: 70, stability: 45 } },
      created_at: new Date().toISOString(),
    },
    {
      snapshot: { state: { primary: "calm", verdictStrictness: 55, stability: 62 } },
      created_at: new Date().toISOString(),
    },
  ],
  70,
)
assert(timeline.sampleCount >= 1, "timeline samples")

console.log("\n=== Verdict calibration ===")
const lesson = buildOutcomeLesson({
  trade: {
    id: "1",
    pair: "EURUSD",
    direction: "LONG",
    result: "LOSS",
    pnl: -50,
    emotion: "revenge",
    rule_followed: false,
    setup: "breakout",
  },
  vyronisVerdictAtPlan: "SKIP",
})
const cal = computeVerdictCalibration([
  lesson,
  { ...lesson, tradeId: "2", vyronisWasRight: true },
  { ...lesson, tradeId: "3", vyronisWasRight: true },
])
assert(cal.sampleCount >= 2, "calibration samples")

console.log("\n=== Session recovery ===")
const yKey = "2020-06-01"
const recoveryCtx = baseContext({
  autonomous: null,
  memory: {
    snapshot: {
      tradeCount: 0,
      todayTradeCount: 0,
      todayPnL: 0,
      winRate: 42,
      plannedCount: 0,
      unreadSignalCount: 0,
    },
    primaryLeak: stubPrimaryLeak,
    warnings: [],
    topPatterns: [],
    plannedSessions: [],
    greeting: { headline: "", subline: "", sessionLabel: "NY" },
  },
  recentTrades: [
    {
      id: "y1",
      pair: "EURUSD",
      direction: "LONG",
      result: "LOSS",
      pnl: -50,
      emotion: "revenge",
      session: "London",
      trade_date: yKey,
      created_at: `${yKey}T14:00:00Z`,
      rule_followed: false,
    },
    {
      id: "y2",
      pair: "GBPUSD",
      direction: "SHORT",
      result: "LOSS",
      pnl: -30,
      emotion: "fomo",
      session: "London",
      trade_date: yKey,
      created_at: `${yKey}T16:00:00Z`,
      rule_followed: false,
    },
  ],
  emotionalState: {
    dominantEmotion: "revenge",
    impulsiveCount: 2,
    recentEmotions: ["revenge", "fomo"],
    trend: "volatile",
    note: "Prior",
  },
})
const recovery = buildSessionRecovery(recoveryCtx)
assert(recovery.sessionGuardMode === "soft_caution", "soft caution when no trades today")
assert(
  recovery.carryoverMode === "historical_caution" || recovery.phase === "RECOVERING",
  "historical not active instability",
)
assert(
  recovery.probabilityNarrative.includes("not confirmed") ||
    recovery.probabilityNarrative.includes("caution"),
  "probability narrative",
)
assert(recovery.adjustedEmotionalRisk < recovery.rawHistoricalRisk, "emotional risk decays")

console.log("\n=== Trading day boundary ===")
const freshMorningCtx = {
  ...recoveryCtx,
  sessionRecovery: recovery,
} as FullTraderContext
const freshShadow = evaluateShadowMode({ context: freshMorningCtx })
assert(!freshShadow.shouldPause, "shadow pause off on fresh day after prior losses")
const freshLive = monitorLiveSession({ context: freshMorningCtx, lastKnownSession: null })
const freshIntervention = evaluateAutonomousIntervention({
  os: { context: { ...freshMorningCtx, autonomous: { shadow: freshShadow } as FullTraderContext["autonomous"] } },
  liveSession: freshLive,
})
assert(
  !freshIntervention.active ||
    freshIntervention.headline !== "Pause — protect capital and process",
  "no critical Session Guard pause on fresh morning",
)
const freshPreTrade = buildPreTradeApproval(freshMorningCtx)
assert(
  freshPreTrade.status === "approved",
  "pre-trade approved on fresh companion morning (no planned setup)",
)
assert(
  !freshPreTrade.headline.includes("Reflection"),
  "no reflection headline on fresh companion morning",
)

console.log("\n=== Verdict reasoning + human signals ===")
const vr = resolveVerdictWithReasoning({
  score: 58,
  factors,
  context: { ...ctx, emotionalIntelligence: ei, verdictCalibration: cal },
})
assert(vr.humanSignals.length >= 0, "human signals array")
assert(
  vr.traderStateVerdict === "SKIP" || vr.verdict === "SKIP" || vr.verdict === "CAUTION",
  "protective verdict under revenge context",
)

console.log("\n=== Phase 7 vision facade ===")
const phase7 = buildVisionIntelligenceSnapshot({
  context: ctx,
  chartVision: {
    available: true,
    imageUrl: "x",
    vision: { visionScore: 65 } as import("../lib/coach/types").ChartVisionResult,
    legacy: null,
    summary: "ok",
    checklist: [{ label: "Trend", value: "Bullish", status: "good" }],
  },
})
assert(phase7?.available === true, "phase7 snapshot")
assert(phase7 != null && phase7.visionScore === 65, "vision score passthrough")

console.log("\n=== Tone memory ===")
const toneMem = toneMemoryFromMessages([
  {
    id: "1",
    role: "user",
    content: "feeling stressed about entering",
    created_at: new Date().toISOString(),
    message_type: "text",
    payload: {},
    thread_id: "t",
  },
])
assert(toneMem.dominantTone === "anxious", "tone memory dominant")

console.log("\n✅ All intelligence stack checks passed.\n")
