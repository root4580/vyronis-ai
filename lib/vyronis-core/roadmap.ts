import type { VyronisPhaseDefinition } from "@/lib/vyronis-core/types"

function pct(active: number, total: number): number {
  return Math.round((active / total) * 100)
}

/** Long-term Vyronis evolution roadmap — Phases 5–10 */
export const VYRONIS_EVOLUTION_ROADMAP: VyronisPhaseDefinition[] = [
  {
    phase: 5,
    title: "Autonomous Intelligence",
    goal: "Vyronis proactively protects and guides the trader instead of only reacting.",
    goalFeeling: "A protective risk manager with emotional awareness.",
    completionPercent: pct(9, 11),
    capabilities: [
      { id: "shadow-mode", label: "Shadow Mode", status: "active", module: "lib/autonomous/shadow-mode-engine.ts", goalFeeling: "Passive pre-trade observer" },
      { id: "emotional-risk", label: "Emotional risk prediction", status: "active", module: "lib/autonomous/shadow-mode-engine.ts", goalFeeling: "Predict tilt before click" },
      { id: "overtrading", label: "Overtrading detection", status: "active", module: "lib/trading-os/live-session-monitor.ts", goalFeeling: "Escalation alerts" },
      { id: "revenge-prob", label: "Revenge trading probability", status: "active", module: "lib/cognitive/prediction-layer.ts", goalFeeling: "Spiral prevention" },
      { id: "discipline-drift", label: "Discipline drift monitoring", status: "active", module: "lib/autonomous/shadow-mode-engine.ts", goalFeeling: "Process vs outcome drift" },
      { id: "live-trader-state", label: "Live trader state engine", status: "active", module: "lib/vyronis-core/phase5-engine.ts", goalFeeling: "Unified real-time state" },
      { id: "intervention-prompts", label: "Real-time intervention prompts", status: "active", module: "lib/trading-os/intervention-layer.ts", goalFeeling: "Stand down / reduce size" },
      { id: "setup-probability", label: "Setup probability scoring", status: "active", module: "lib/vyronis-core/phase5-engine.ts", goalFeeling: "Historical edge score" },
      { id: "confidence-decay", label: "Confidence decay tracking", status: "active", module: "lib/vyronis-core/phase5-engine.ts", goalFeeling: "Session fatigue decay" },
      { id: "pre-trade-approval", label: "Pre-trade approval system", status: "active", module: "lib/vyronis-core/phase5-engine.ts", goalFeeling: "Approve / reduce / block" },
      { id: "adaptive-risk", label: "Adaptive risk restriction", status: "active", module: "lib/vyronis-core/phase5-engine.ts", goalFeeling: "Dynamic risk caps" },
      { id: "verdict-reasoning", label: "TAKE / CAUTION / SKIP reasoning", status: "active", module: "lib/intelligence/verdict-reasoning-engine.ts", goalFeeling: "Structured verdicts" },
      { id: "psychology-override", label: "Psychology override system", status: "active", module: "lib/intelligence/verdict-reasoning-engine.ts", goalFeeling: "Chart OK, trader not" },
      { id: "danger-escalation", label: "Emotional danger escalation", status: "active", module: "lib/vyronis-core/phase5-engine.ts", goalFeeling: "Critical emotional lane" },
      { id: "session-fatigue", label: "Session fatigue awareness", status: "active", module: "lib/vyronis-core/phase5-engine.ts", goalFeeling: "Fatigue in decay model" },
      { id: "rule-forecast", label: "Rule violation forecasting", status: "active", module: "lib/vyronis-core/phase5-engine.ts", goalFeeling: "Predict rule breaks" },
    ],
  },
  {
    phase: 6,
    title: "Trader Identity & Memory Engine",
    goal: "Vyronis understands WHO the trader is becoming over time.",
    goalFeeling: "Vyronis remembers and understands the trader deeply.",
    completionPercent: pct(10, 12),
    capabilities: [
      { id: "trader-dna", label: "Trader DNA profile", status: "active", module: "lib/autonomous/trader-dna-engine.ts", goalFeeling: "Evolving profile" },
      { id: "emotional-fingerprint", label: "Emotional fingerprinting", status: "active", module: "lib/adaptive-cognition/identity-layer.ts", goalFeeling: "Emotion patterns" },
      { id: "setup-fingerprint", label: "Setup fingerprint memory", status: "active", module: "lib/autonomous/pattern-fingerprint-engine.ts", goalFeeling: "Win/loss clusters" },
      { id: "confidence-profile", label: "Confidence profile", status: "active", module: "lib/cognitive/decision-confidence-graph.ts", goalFeeling: "Perceived vs actual" },
      { id: "discipline-evolution", label: "Discipline evolution tracking", status: "active", module: "lib/trading-os/trader-evolution.ts", goalFeeling: "Long-term discipline" },
      { id: "recovery-speed", label: "Recovery-speed tracking", status: "active", module: "lib/adaptive-cognition/behavioral-modeling.ts", goalFeeling: "Post-loss recovery" },
      { id: "streak-psychology", label: "Streak psychology", status: "partial", module: "lib/adaptive-cognition/behavioral-modeling.ts", goalFeeling: "Win/loss streaks" },
      { id: "archetype", label: "Trader archetype detection", status: "active", module: "lib/autonomous/trader-dna-engine.ts", goalFeeling: "Operator archetype" },
      { id: "memory-trade", label: "Trade memory", status: "active", module: "lib/learning/trade-memory-engine.ts", goalFeeling: "Per-trade recall" },
      { id: "memory-emotional", label: "Emotional memory", status: "active", module: "lib/cognitive/multi-layer-memory.ts", goalFeeling: "Emotion layer" },
      { id: "memory-market", label: "Market memory", status: "active", module: "lib/cognitive/multi-layer-memory.ts", goalFeeling: "Session context" },
      { id: "memory-setup", label: "Setup memory", status: "active", module: "lib/intelligence/setup-similarity-engine.ts", goalFeeling: "Setup comparisons" },
      { id: "memory-behavioral", label: "Behavioral memory", status: "active", module: "lib/intelligence/pattern-intelligence-engine.ts", goalFeeling: "Behavior patterns" },
      { id: "memory-coaching", label: "Coaching memory", status: "active", module: "lib/autonomous/reflection-engine.ts", goalFeeling: "Lessons" },
      { id: "compare-setups", label: "Compare live vs past setups", status: "active", module: "lib/intelligence/comparative-memory-engine.ts", goalFeeling: "Journal similarity" },
      { id: "destructive-behaviors", label: "Destructive behavior detection", status: "active", module: "lib/intelligence/pattern-intelligence-engine.ts", goalFeeling: "Recurring mistakes" },
    ],
  },
  {
    phase: 7,
    title: "Vision Intelligence System",
    goal: "Vyronis develops advanced visual market understanding.",
    goalFeeling: "Vyronis sees structure and patterns before the trader does.",
    completionPercent: pct(8, 12),
    capabilities: [
      { id: "mtf-vision", label: "Multi-timeframe understanding", status: "active", module: "lib/intelligence/command-center-bundle-vision-engine.ts", goalFeeling: "Bundle analysis" },
      { id: "tf-inference", label: "Automatic timeframe inference", status: "active", module: "lib/intelligence/command-center-bundle-vision-engine.ts", goalFeeling: "Label inference" },
      { id: "bos", label: "BOS detection", status: "active", module: "lib/coach/visual-mtf-engine.ts", goalFeeling: "Break of structure" },
      { id: "choch", label: "CHOCH detection", status: "active", module: "lib/coach/visual-mtf-engine.ts", goalFeeling: "Character of change" },
      { id: "liquidity-sweep", label: "Liquidity sweep detection", status: "active", module: "lib/coach/visual-mtf-engine.ts", goalFeeling: "Sweep flags" },
      { id: "aoi", label: "AOI recognition", status: "partial", module: "lib/chart-annotations/annotation-engine.ts", goalFeeling: "Order blocks / AOI" },
      { id: "ema-structure", label: "EMA structure understanding", status: "partial", module: "lib/coach/visual-mtf-engine.ts", goalFeeling: "Trend alignment" },
      { id: "vol-compression", label: "Volatility compression analysis", status: "active", module: "lib/cognitive/market-environment-engine.ts", goalFeeling: "Compression label" },
      { id: "continuation-reversal", label: "Continuation vs reversal", status: "active", module: "lib/cognitive/market-environment-engine.ts", goalFeeling: "Environment class" },
      { id: "pattern-similarity", label: "Pattern similarity engine", status: "active", module: "lib/intelligence/setup-similarity-engine.ts", goalFeeling: "Historical match" },
      { id: "chart-replay", label: "Chart replay analysis", status: "active", module: "lib/replay/execution-replay-engine.ts", goalFeeling: "Execution replay" },
      { id: "visual-overlays", label: "Visual markup overlays", status: "active", module: "lib/chart-annotations/top-down-overlay-engine.ts", goalFeeling: "Annotation overlays" },
    ],
  },
  {
    phase: 8,
    title: "Voice & Real-Time Companion",
    goal: "Vyronis becomes a living conversational trading companion.",
    goalFeeling: "Vyronis feels alive, attentive, and always present.",
    completionPercent: pct(2, 10),
    capabilities: [
      { id: "voice-realtime", label: "Real-time voice conversations", status: "planned", module: "lib/vyronis-core/voice-roadmap.ts", goalFeeling: "Spoken companion" },
      { id: "airpods-review", label: "AirPods session reviews", status: "planned", module: "lib/vyronis-core/voice-roadmap.ts", goalFeeling: "Post-session audio" },
      { id: "live-prep", label: "Live market prep conversations", status: "partial", module: "lib/intelligence/companion-llm-engine.ts", goalFeeling: "Text prep today" },
      { id: "spoken-checkin", label: "Spoken emotional check-ins", status: "planned", module: "lib/vyronis-core/voice-roadmap.ts", goalFeeling: "Voice check-in" },
      { id: "voice-reflection", label: "Trade reflection voice mode", status: "planned", module: "lib/vyronis-core/voice-roadmap.ts", goalFeeling: "Voice debrief" },
      { id: "voice-coaching", label: "Real-time conversational coaching", status: "partial", module: "lib/intelligence/companion-llm-engine.ts", goalFeeling: "Streaming text coach" },
      { id: "voice-journal", label: "Voice journaling", status: "planned", module: "lib/vyronis-core/voice-roadmap.ts", goalFeeling: "Spoken journal" },
      { id: "adaptive-pacing", label: "Adaptive conversational pacing", status: "partial", module: "lib/adaptive-cognition/companion-evolution.ts", goalFeeling: "Tone adaptation" },
      { id: "spoken-warnings", label: "Proactive spoken warnings", status: "planned", module: "lib/trading-os/intervention-layer.ts", goalFeeling: "Audio alerts" },
      { id: "session-voice-updates", label: "Session transition updates", status: "planned", module: "lib/trading-os/live-session-monitor.ts", goalFeeling: "Spoken session shift" },
    ],
  },
  {
    phase: 9,
    title: "Execution Intelligence Layer",
    goal: "Vyronis becomes a real execution co-pilot.",
    goalFeeling: "Vyronis actively protects execution quality in real time.",
    completionPercent: pct(4, 10),
    capabilities: [
      { id: "mt5", label: "MT5 integration", status: "partial", module: "mt5/experts/", goalFeeling: "EA foundation" },
      { id: "tv-sync", label: "TradingView live sync", status: "partial", module: "lib/tradingview/", goalFeeling: "Webhook signals" },
      { id: "live-monitor", label: "Live trade monitoring", status: "partial", module: "lib/trading-os/live-trade-companion.ts", goalFeeling: "Planned trade watch" },
      { id: "sl-tp-awareness", label: "SL/TP management awareness", status: "planned", module: "lib/vyronis-core/execution-roadmap.ts", goalFeeling: "Live SL/TP" },
      { id: "execution-quality", label: "Execution quality analysis", status: "active", module: "lib/replay/execution-replay-engine.ts", goalFeeling: "Post-trade quality" },
      { id: "spread-slippage", label: "Slippage/spread awareness", status: "planned", module: "lib/vyronis-core/execution-roadmap.ts", goalFeeling: "Cost awareness" },
      { id: "emotional-interrupt", label: "Emotional interruption layer", status: "active", module: "lib/trading-os/intervention-layer.ts", goalFeeling: "Impulse block" },
      { id: "live-discipline", label: "Live discipline monitoring", status: "partial", module: "lib/trading-os/live-trade-companion.ts", goalFeeling: "Rule deviation flags" },
      { id: "funded-protection", label: "Funded-account protection", status: "active", module: "lib/cognitive/adaptive-coaching-engine.ts", goalFeeling: "Guardian mode" },
      { id: "execution-replay", label: "Execution replay reconstruction", status: "active", module: "lib/replay/execution-replay-engine.ts", goalFeeling: "Full replay" },
    ],
  },
  {
    phase: 10,
    title: "Cognitive Operating System",
    goal: "Vyronis evolves into a full high-performance cognitive companion.",
    goalFeeling: "An adaptive cognitive OS for decisions under uncertainty.",
    completionPercent: pct(12, 16),
    capabilities: [
      { id: "life-correlation", label: "Sleep/stress correlation", status: "active", module: "lib/adaptive-cognition/life-context.ts", goalFeeling: "Life × trading" },
      { id: "burnout-pred", label: "Burnout prediction", status: "active", module: "lib/adaptive-cognition/behavioral-modeling.ts", goalFeeling: "Burnout cycles" },
      { id: "confidence-inflation", label: "Confidence inflation detection", status: "active", module: "lib/adaptive-cognition/behavioral-modeling.ts", goalFeeling: "Oversized wins" },
      { id: "luck-vs-skill", label: "Luck vs skill attribution", status: "active", module: "lib/adaptive-cognition/performance-intelligence.ts", goalFeeling: "Process attribution" },
      { id: "personal-os", label: "Personal operating system", status: "active", module: "lib/adaptive-cognition/personal-os.ts", goalFeeling: "Focus/recovery flows" },
      { id: "strategic-thinking", label: "Strategic thinking layer", status: "active", module: "lib/adaptive-cognition/strategic-thinking.ts", goalFeeling: "Scale/preserve" },
      { id: "identity-layer", label: "Identity layer", status: "active", module: "lib/adaptive-cognition/identity-layer.ts", goalFeeling: "Who you're becoming" },
      { id: "insight-gen", label: "Autonomous insight generation", status: "active", module: "lib/adaptive-cognition/insight-generation.ts", goalFeeling: "Proactive insights" },
      { id: "desktop", label: "Desktop app", status: "partial", module: "web app", goalFeeling: "Current web" },
      { id: "mobile", label: "Mobile app", status: "planned", module: "lib/adaptive-cognition/ecosystem.ts", goalFeeling: "Mobile companion" },
      { id: "wearable", label: "Wearable integrations", status: "planned", module: "lib/adaptive-cognition/ecosystem.ts", goalFeeling: "Stress nudges" },
      { id: "portfolio-cognition", label: "Portfolio cognition layer", status: "planned", module: "lib/adaptive-cognition/ecosystem.ts", goalFeeling: "Multi-account" },
      { id: "collective-intel", label: "Collective pattern intelligence", status: "planned", module: "lib/vyronis-core/ecosystem-roadmap.ts", goalFeeling: "Anonymized patterns" },
    ],
  },
]

export const VYRONIS_DESIGN_PHILOSOPHY = {
  tagline: "Bloomberg Terminal × ChatGPT × trading psychologist × behavioral intelligence",
  pillars: [
    "One unified intelligence layer",
    "One evolving memory system",
    "One conversational companion",
    "Multiple specialized engines feeding the same cognitive core",
    "The market is the mirror — optimize the human",
  ],
}

export function computeOverallMaturity(phases: VyronisPhaseDefinition[]): number {
  if (phases.length === 0) return 0
  return Math.round(
    phases.reduce((s, p) => s + p.completionPercent, 0) / phases.length,
  )
}

export function currentPhaseFocus(phases: VyronisPhaseDefinition[]): VyronisPhaseDefinition["phase"] {
  const sorted = [...phases].sort((a, b) => a.completionPercent - b.completionPercent)
  const focus = sorted.find((p) => p.completionPercent < 85)
  return focus?.phase ?? 10
}
