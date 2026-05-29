import { evaluateMarketBias } from "../lib/strategy-brain/market-bias-engine"
import { evaluateConfirmation } from "../lib/strategy-brain/confirmation-engine"
import { calculateAPlusScore } from "../lib/strategy-brain/aplus-scoring-engine"
import { evaluateEmotionCheck } from "../lib/strategy-brain/emotion-engine"
import { evaluateStrategySetup } from "../lib/strategy-brain/orchestrator"
import { BORDERLINE_AUTO_SKIP_THRESHOLD } from "../lib/strategy-brain/borderline-engine"
import {
  buildSetupFingerprint,
  compareSetupFingerprints,
} from "../lib/journal/setup-fingerprint"
import { findSimilarTradeMemory } from "../lib/strategy-brain/trade-memory-engine"
import { defaultConfirmationChecklist } from "../lib/strategy-brain/confirmation-engine"

let failed = 0

function assert(label: string, ok: boolean) {
  if (ok) {
    console.log(`  ✓ ${label}`)
  } else {
    console.log(`  ✗ ${label}`)
    failed++
  }
}

console.log("\n=== Market bias ===")
const aligned = evaluateMarketBias({
  weekly_bias: "Bullish",
  daily_bias: "Bullish",
  h4_bias: "Bullish",
})
assert("directional permission when aligned", aligned.directional_permission)
assert("setup valid when aligned", aligned.setup_valid)

const conflict = evaluateMarketBias({
  weekly_bias: "Bullish",
  daily_bias: "Bearish",
  h4_bias: "Bullish",
})
assert("conflict invalidates setup", !conflict.setup_valid)

console.log("\n=== Confirmation ===")
const weak = evaluateConfirmation({
  break_and_retest: false,
  ltf_structure_shift: false,
  momentum_confirmation: "borderline",
  ema_confirmation: false,
  clear_invalidation: false,
  acceptable_rr: false,
})
assert("weak setup detected", weak.setup_strength === "weak")

console.log("\n=== A+ scoring ===")
const score = calculateAPlusScore({
  marketBias: aligned,
  pairBias: "Bullish",
  confirmation: {
    break_and_retest: true,
    ltf_structure_shift: true,
    momentum_confirmation: true,
    ema_confirmation: true,
    clear_invalidation: true,
    acceptable_rr: true,
  },
  aoiReached: true,
  riskReward: 2.5,
  emotionScore: 85,
  majorNewsRisk: false,
})
assert("high score A+ or B", score.grade === "A+" || score.grade === "B")
assert("borderline threshold constant", BORDERLINE_AUTO_SKIP_THRESHOLD === 2)

console.log("\n=== Emotion ===")
const calm = evaluateEmotionCheck({
  calm: true,
  fomo: false,
  chasing: false,
  revenge: false,
  emotion_stable: true,
  major_news: false,
})
assert("calm scores high", calm.emotion_score >= 80)

console.log("\n=== Orchestrator ===")
const full = evaluateStrategySetup({
  pair: "GBPJPY",
  pair_bias: "Bullish",
  market_bias: {
    weekly_bias: "Bullish",
    daily_bias: "Bullish",
    h4_bias: "Bullish",
  },
  confirmation: {
    break_and_retest: true,
    ltf_structure_shift: true,
    momentum_confirmation: true,
    ema_confirmation: true,
    clear_invalidation: true,
    acceptable_rr: true,
  },
  aoi_reached: true,
  risk_reward: 2,
  emotion_answers: {
    calm: true,
    fomo: false,
    chasing: false,
    revenge: false,
    emotion_stable: true,
    major_news: false,
  },
})
assert("orchestrator returns scoring", full.scoring.totalScore > 0)

console.log("\n=== Setup fingerprints ===")
const fp = buildSetupFingerprint({
  id: "a",
  pair: "GBPJPY",
  direction: "BUY",
  result: "LOSS",
  emotion: "FOMO",
  setup: "Breakout",
  confirmation_signal: "Breakout",
  mistake_tags: "Early entry",
})
assert("fingerprint has structure", fp.structureType === "Breakout")
const cmp = compareSetupFingerprints(fp, [
  buildSetupFingerprint({
    id: "b",
    pair: "GBPJPY",
    direction: "BUY",
    result: "LOSS",
    emotion: "FOMO",
    setup: "Breakout",
    confirmation_signal: "Breakout",
    mistake_tags: "Early entry",
    trade_date: "2026-01-01",
  }),
])
assert("comparison finds loss insight", Boolean(cmp.insight))
const mem = findSimilarTradeMemory({
  pair: "GBPJPY",
  trades: [
    {
      id: "b",
      pair: "GBPJPY",
      direction: "BUY",
      result: "LOSS",
      pnl: -50,
      emotion: "fomo",
      setup: "Breakout",
      confirmation_signal: "Breakout",
      mistake_tags: "Early entry",
      trade_date: "2026-01-01",
    },
  ],
  confirmation: defaultConfirmationChecklist(),
  currentTradeId: "a",
  currentTrade: {
    id: "a",
    pair: "GBPJPY",
    direction: "BUY",
    result: "LOSS",
    emotion: "FOMO",
    setup: "Breakout",
    confirmation_signal: "Breakout",
  },
})
assert("memory engine uses fingerprints", Boolean(mem))

if (failed > 0) {
  console.error(`\n❌ ${failed} check(s) failed.\n`)
  process.exit(1)
}
console.log("\n✅ Strategy Brain checks passed.\n")
