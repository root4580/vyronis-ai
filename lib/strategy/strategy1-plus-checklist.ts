/**
 * Strategy 1 (FXAlexG) + stolen Strategy 2 rules — pre-trade checklist mapped to Vyronis journal fields.
 */

import type { TradeFormState } from "@/lib/trade-form-config"

export type Strategy1ManualChecks = {
  liquiditySwept: boolean
  displacementSeen: boolean
  retestEntry: boolean
  inKillZone: boolean
}

export const DEFAULT_STRATEGY1_MANUAL_CHECKS: Strategy1ManualChecks = {
  liquiditySwept: false,
  displacementSeen: false,
  retestEntry: false,
  inKillZone: false,
}

export type ChecklistItemStatus = "pass" | "fail" | "warn" | "pending"

export type Strategy1ChecklistItem = {
  id: string
  step: number
  title: string
  rule: string
  strategy2Steal: boolean
  vyronisFields: string[]
  status: ChecklistItemStatus
  hint?: string
}

export type Strategy1ChecklistResult = {
  items: Strategy1ChecklistItem[]
  passCount: number
  totalScored: number
  grade: "A+" | "B" | "Skip"
  tradeLive: boolean
  summary: string
  improvement?: string
}

const KILL_ZONE_SESSIONS = new Set([
  "London",
  "New York",
  "London + New York Overlap",
  "NY AM",
  "NY PM",
])

function biasMatchesDirection(bias: string, direction: string): boolean {
  if (!bias) return false
  if (direction === "BUY") return bias === "bullish"
  if (direction === "SELL") return bias === "bearish"
  return false
}

function htfAligned(form: TradeFormState): ChecklistItemStatus {
  const { weekly_bias, daily_bias, h4_bias, direction } = form
  if (!weekly_bias || !daily_bias || !h4_bias) return "fail"
  const aligned =
    biasMatchesDirection(weekly_bias, direction) &&
    biasMatchesDirection(daily_bias, direction) &&
    biasMatchesDirection(h4_bias, direction)
  if (aligned) return "pass"
  const allNeutral = [weekly_bias, daily_bias, h4_bias].every((b) => b === "neutral")
  return allNeutral ? "warn" : "fail"
}

function confirmationOk(form: TradeFormState): ChecklistItemStatus {
  if (!form.confirmation_type || form.confirmation_type === "none") return "fail"
  if (form.confirmation_type === "choch" || form.confirmation_type === "bos") return "pass"
  return "pass"
}

function entryQualityOk(form: TradeFormState, manual: Strategy1ManualChecks): ChecklistItemStatus {
  if (form.entry_quality === "impulsive" || form.entry_quality === "early") return "fail"
  if (form.entry_quality === "late") return "warn"
  if (form.entry_quality === "perfect" || manual.retestEntry) return "pass"
  return "pending"
}

function emotionOk(form: TradeFormState): ChecklistItemStatus {
  if (form.emotion === "Revenge" || form.emotion === "Impulsive") return "fail"
  if (form.emotion === "Calm" || form.emotion === "Confident") return "pass"
  return "warn"
}

function rrStatus(rr: number | null): ChecklistItemStatus {
  if (rr == null || rr <= 0) return "pending"
  if (rr >= 3) return "pass"
  if (rr >= 2) return "pass"
  return "fail"
}

function liquidityStatus(form: TradeFormState, manual: Strategy1ManualChecks): ChecklistItemStatus {
  if (form.aoi_type === "liquidity_sweep") return "pass"
  if (manual.liquiditySwept) return "pass"
  return "pending"
}

function sessionStatus(form: TradeFormState, manual: Strategy1ManualChecks): ChecklistItemStatus {
  if (manual.inKillZone) return "pass"
  if (form.session && KILL_ZONE_SESSIONS.has(form.session)) return "pass"
  if (form.session === "Asia" || form.session === "Pre-Market") return "warn"
  return "pending"
}

export function evaluateStrategy1PlusChecklist(
  form: TradeFormState,
  riskReward: number | null,
  manual: Strategy1ManualChecks = DEFAULT_STRATEGY1_MANUAL_CHECKS,
): Strategy1ChecklistResult {
  const htf = htfAligned(form)
  const session = sessionStatus(form, manual)
  const aoi: ChecklistItemStatus = form.aoi_type ? "pass" : "fail"
  const liquidity = liquidityStatus(form, manual)
  const displacement: ChecklistItemStatus =
    manual.displacementSeen || form.confirmation_type === "choch" || form.confirmation_type === "bos"
      ? "pass"
      : "pending"
  const confirmation = confirmationOk(form)
  const entry = entryQualityOk(form, manual)
  const rr = rrStatus(riskReward)
  const emotion = emotionOk(form)
  const rules: ChecklistItemStatus = form.rule_followed ? "pass" : "fail"

  const items: Strategy1ChecklistItem[] = [
    {
      id: "htf",
      step: 1,
      title: "HTF pro-trend alignment",
      rule: "Weekly, Daily, and H4 bias match your trade direction (Strategy 1 top-down).",
      strategy2Steal: false,
      vyronisFields: ["weekly_bias", "daily_bias", "h4_bias", "direction"],
      status: htf,
      hint: htf === "fail" ? "Set all three biases bullish for BUY, bearish for SELL." : undefined,
    },
    {
      id: "session",
      step: 2,
      title: "Kill zone / session",
      rule: "Trade during London, NY, or overlap — not random hours (stolen from Strategy 2).",
      strategy2Steal: true,
      vyronisFields: ["session"],
      status: session,
    },
    {
      id: "aoi",
      step: 3,
      title: "AOI marked",
      rule: "Clear area of interest — supply, demand, structure, or sweep zone (Strategy 1).",
      strategy2Steal: false,
      vyronisFields: ["aoi_type"],
      status: aoi,
    },
    {
      id: "liquidity",
      step: 4,
      title: "Liquidity swept first",
      rule: "Stops taken before the move — equal highs/lows or obvious swing (Strategy 2 steal).",
      strategy2Steal: true,
      vyronisFields: ["aoi_type → Liquidity sweep"],
      status: liquidity,
    },
    {
      id: "displacement",
      step: 5,
      title: "Displacement after sweep",
      rule: "Strong impulse + structure shift — not slow drift into zone (Strategy 2 steal).",
      strategy2Steal: true,
      vyronisFields: ["confirmation_type → CHoCH / BOS"],
      status: displacement,
    },
    {
      id: "confirmation",
      step: 6,
      title: "Structure confirmation",
      rule: "CHoCH, BOS, break & retest, engulfing, or pin bar at AOI (Strategy 1 + 2).",
      strategy2Steal: false,
      vyronisFields: ["confirmation_type", "confirmation_signal"],
      status: confirmation,
    },
    {
      id: "entry",
      step: 7,
      title: "Retest entry — not a chase",
      rule: "Enter on retest after shift; entry quality Perfect (Strategy 2 steal).",
      strategy2Steal: true,
      vyronisFields: ["entry_quality", "confirmation_type → Break & retest"],
      status: entry,
    },
    {
      id: "rr",
      step: 8,
      title: "R:R math",
      rule: "Minimum 1:2 to submit; aim 1:3 on A+ (Strategy 1 floor, Strategy 2 target).",
      strategy2Steal: true,
      vyronisFields: ["entry_price", "stop_loss", "take_profit", "risk_reward"],
      status: rr,
      hint: rr === "fail" ? "Vyronis warns below 1:2. Extend TP or tighten invalidation." : undefined,
    },
    {
      id: "emotion",
      step: 9,
      title: "Emotional state",
      rule: "Calm or Confident only on live trades — Revenge/Impulsive = auto Skip.",
      strategy2Steal: false,
      vyronisFields: ["emotion"],
      status: emotion,
    },
    {
      id: "rules",
      step: 10,
      title: "Rules followed",
      rule: "You followed your written plan — no moved stop, oversize, or FOMO.",
      strategy2Steal: false,
      vyronisFields: ["rule_followed", "mistake_tags"],
      status: rules,
    },
  ]

  const scored = items.filter((i) => i.status !== "pending")
  const passCount = items.filter((i) => i.status === "pass").length
  const failCount = items.filter((i) => i.status === "fail").length
  const totalScored = scored.length

  const hardSkip =
    emotion === "fail" ||
    htf === "fail" ||
    confirmation === "fail" ||
    form.entry_quality === "impulsive" ||
    form.emotion === "Revenge" ||
    form.emotion === "Impulsive"

  let grade: "A+" | "B" | "Skip" = "Skip"
  if (!hardSkip && passCount >= 8 && rr !== "fail" && entry !== "fail") {
    grade = "A+"
  } else if (!hardSkip && passCount >= 6 && failCount <= 1) {
    grade = "B"
  }

  const tradeLive = grade === "A+" && !hardSkip

  let summary: string
  if (hardSkip) {
    summary = "Skip this trade — hard rule failed (HTF, confirmation, emotion, or impulsive entry)."
  } else if (grade === "A+") {
    summary = "A+ setup — matches Strategy 1 + Strategy 2 steals. OK to execute if you still see it live."
  } else if (grade === "B") {
    summary = "B setup — journal for review, but ONE A+ rule says skip on live account."
  } else {
    summary = "Not enough confluence — wait for a cleaner setup."
  }

  let improvement: string | undefined
  if (liquidity === "pending") {
    improvement = "Wait for liquidity sweep before entry (Strategy 2 steal #1)."
  } else if (displacement === "pending") {
    improvement = "Wait for displacement + CHoCH/BOS after the sweep."
  } else if (entry === "fail" || entry === "pending") {
    improvement = "Don't chase — wait for retest and set entry quality to Perfect."
  } else if (rr === "fail") {
    improvement = "Fix R:R to at least 1:2 before sizing up."
  } else if (grade === "B") {
    improvement = "Only take A+ on live — this is a B at best."
  }

  return {
    items,
    passCount,
    totalScored,
    grade,
    tradeLive,
    summary,
    improvement,
  }
}
