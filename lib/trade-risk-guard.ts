import type { TradeFormState } from "@/lib/trade-form-config"
import { detectCoachRedFlags } from "@/lib/trade-coach/red-flags"
import { buildPlannedContextFromForm } from "@/lib/trade-coach/planned-context"
import { isDangerousMistakeLabel, normalizeMistakeLabel } from "@/lib/mistake-tags"
import {
  buildDailyRules,
  buildRiskSnapshot,
  getTodayTrades,
  getTradeRiskViolation,
  type SettingsTrade,
  type UserSettingsForm,
} from "@/lib/user-settings"
import { getSignedPnL } from "@/lib/trade-utils"

export type TradeRiskGuardSeverity = "clear" | "caution" | "critical"

export type TradeRiskGuardCategory =
  | "emotion"
  | "risk"
  | "discipline"
  | "pattern"
  | "session"

export type TradeRiskGuardFlag = {
  id: string
  category: TradeRiskGuardCategory
  severity: "warning" | "critical"
  title: string
  reason: string
  recommendation: string
}

export type TradeRiskGuardResult = {
  severity: TradeRiskGuardSeverity
  flags: TradeRiskGuardFlag[]
  headline: string
  coachNote: string
  requiresConfirmation: boolean
}

export type TradeRiskGuardHistoryTrade = SettingsTrade & {
  id?: string
  emotion_after?: string | null
  setup_classification?: string | null
  mistake_tags?: string | null
}

export type TradeRiskGuardInput = {
  form: TradeFormState
  settings: UserSettingsForm
  startingBalance: number
  historicalTrades: TradeRiskGuardHistoryTrade[]
  editingTradeId?: string | null
}

const IMPULSIVE_EMOTIONS = new Set(["FOMO", "Revenge", "Euphoric", "Anxious", "Fearful", "Greed"])
const IMPULSIVE_CLASSIFICATIONS = new Set(["Impulsive", "Revenge", "Counter-Trend"])

const COACH_RECOMMENDATIONS: Record<string, string> = {
  euphoric: "Scale down size and re-check your plan — euphoria often follows wins, not edge.",
  revenge: "Step away for 15 minutes. Only return when you can describe the setup without emotion.",
  fomo: "If confirmation isn't on your chart, the correct action is no trade.",
  over_risking: "Resize to your max risk or skip — protect the account before chasing P&L.",
  countertrend: "Align with higher-timeframe bias or wait for a confirmed reversal setup.",
  rules_break: "Name the rule you broke in notes. Proceed only if this is a deliberate exception.",
  emotional_risk: "Run your pre-trade coach or reduce size until your state is Calm or Disciplined.",
}

function pushFlag(
  flags: TradeRiskGuardFlag[],
  flag: TradeRiskGuardFlag,
): void {
  if (flags.some((existing) => existing.id === flag.id)) return
  flags.push(flag)
}

function mapCoachFlag(
  id: string,
  severity: "warning" | "critical",
  title: string,
  reason: string,
  category: TradeRiskGuardCategory,
): TradeRiskGuardFlag {
  return {
    id: `coach-${id}`,
    category,
    severity,
    title,
    reason,
    recommendation: COACH_RECOMMENDATIONS[id] ?? "Pause and run through your pre-trade checklist before continuing.",
  }
}

function getHistoryExcludingEdit(
  trades: TradeRiskGuardHistoryTrade[],
  editingTradeId?: string | null,
): TradeRiskGuardHistoryTrade[] {
  if (!editingTradeId) return trades
  return trades.filter((trade) => trade.id !== editingTradeId)
}

function countTodayImpulsiveLosses(
  trades: TradeRiskGuardHistoryTrade[],
  referenceDate: string,
): number {
  const todayKey = referenceDate.split("T")[0]
  return trades.filter((trade) => {
    const tradeKey = trade.trade_date?.split("T")[0] ?? trade.created_at.split("T")[0]
    if (tradeKey !== todayKey) return false
    const signed = getSignedPnL(trade.pnl, trade.result)
    if (signed >= 0) return false
    if (IMPULSIVE_EMOTIONS.has(trade.emotion)) return true
    if (trade.setup_classification && IMPULSIVE_CLASSIFICATIONS.has(trade.setup_classification)) {
      return true
    }
    return false
  }).length
}

function getRecentLossStreak(trades: TradeRiskGuardHistoryTrade[]): number {
  const sorted = [...trades].sort(
    (a, b) => new Date(b.trade_date || b.created_at).getTime() - new Date(a.trade_date || a.created_at).getTime(),
  )
  let streak = 0
  for (const trade of sorted) {
    const signed = getSignedPnL(trade.pnl, trade.result)
    if (signed < 0) {
      streak++
      continue
    }
    if (trade.result === "BREAKEVEN") continue
    break
  }
  return streak
}

function buildHeadline(severity: TradeRiskGuardSeverity, flags: TradeRiskGuardFlag[]): string {
  if (severity === "clear") return "Execution looks aligned"
  if (severity === "critical") {
    const primary = flags.find((flag) => flag.severity === "critical")
    return primary?.title ?? "High-risk conditions detected"
  }
  return "Proceed with discipline"
}

function buildCoachNote(severity: TradeRiskGuardSeverity, flags: TradeRiskGuardFlag[]): string {
  if (severity === "clear") {
    return "Your inputs align with your risk framework. Stay process-focused through execution."
  }
  if (flags.some((flag) => flag.id.includes("revenge") || flag.title.toLowerCase().includes("revenge"))) {
    return "Revenge entries compound drawdowns faster than bad setups. The elite move is often no trade."
  }
  if (flags.some((flag) => flag.category === "session")) {
    return "Session limits exist to protect your edge. Honor them the same way you honor stop losses."
  }
  return "I'm not blocking you — I'm making sure this trade is intentional. Confirm only if you've genuinely processed the risk."
}

export function evaluateTradeRiskGuard(input: TradeRiskGuardInput): TradeRiskGuardResult {
  const { form, settings, startingBalance, historicalTrades, editingTradeId } = input
  const flags: TradeRiskGuardFlag[] = []
  const history = getHistoryExcludingEdit(historicalTrades, editingTradeId)
  const tradeDate = form.trade_date || new Date().toISOString().split("T")[0]
  const riskPercent = form.risk_percent ? parseFloat(form.risk_percent) : 1
  const maxRisk = settings.max_risk_per_trade

  const plannedContext = buildPlannedContextFromForm(form, maxRisk)
  const coachResponses = {
    emotional_state: form.emotion,
    planned_risk: form.risk_percent ? `${form.risk_percent}%` : undefined,
    rule_check: form.rule_followed ? "yes" : "no",
  }

  for (const coachFlag of detectCoachRedFlags(plannedContext, coachResponses, maxRisk)) {
    const category: TradeRiskGuardCategory =
      coachFlag.id === "over_risking"
        ? "risk"
        : coachFlag.id === "rules_break"
          ? "discipline"
          : coachFlag.id === "countertrend"
            ? "pattern"
            : "emotion"

    pushFlag(
      flags,
      mapCoachFlag(
        coachFlag.id,
        coachFlag.severity === "critical" ? "critical" : "warning",
        coachFlag.id === "revenge"
          ? "Revenge trading state"
          : coachFlag.id === "fomo"
            ? "FOMO detected"
            : coachFlag.id === "over_risking"
              ? "Oversized risk"
              : coachFlag.id === "rules_break"
                ? "Rule violation flagged"
                : coachFlag.id === "countertrend"
                  ? "Counter-trend structure"
                  : "Emotional instability",
        coachFlag.message,
        category,
      ),
    )
  }

  const riskViolation = getTradeRiskViolation(riskPercent, maxRisk)
  if (riskViolation) {
    pushFlag(flags, {
      id: "oversized-risk",
      category: "risk",
      severity: "critical",
      title: "Oversized risk",
      reason: riskViolation,
      recommendation: COACH_RECOMMENDATIONS.over_risking,
    })
  }

  if (!form.rule_followed) {
    pushFlag(flags, {
      id: "rule-violation",
      category: "discipline",
      severity: "critical",
      title: "Trading plan not followed",
      reason: "You marked that this trade breaks your rules.",
      recommendation: COACH_RECOMMENDATIONS.rules_break,
    })
  }

  for (const rawTag of form.mistake_tags) {
    const label = normalizeMistakeLabel(rawTag)
    if (label.toLowerCase().includes("revenge")) {
      pushFlag(flags, {
        id: "mistake-revenge",
        category: "emotion",
        severity: "critical",
        title: "Revenge pattern tagged",
        reason: "This trade is tagged as revenge — a high-correlation mistake in your journal.",
        recommendation: COACH_RECOMMENDATIONS.revenge,
      })
    }
    if (label === "Ignored Rules") {
      pushFlag(flags, {
        id: "mistake-ignored-rules",
        category: "discipline",
        severity: "critical",
        title: "Ignored rules",
        reason: "You're logging a trade while acknowledging rule breakage.",
        recommendation: COACH_RECOMMENDATIONS.rules_break,
      })
    }
    if (label === "Oversized" || rawTag.toLowerCase() === "oversized") {
      pushFlag(flags, {
        id: "mistake-oversized",
        category: "risk",
        severity: "warning",
        title: "Oversized mistake tagged",
        reason: "Position size discipline is already a concern on this entry.",
        recommendation: COACH_RECOMMENDATIONS.over_risking,
      })
    }
    if (isDangerousMistakeLabel(label) && !flags.some((flag) => flag.id.startsWith("mistake-"))) {
      pushFlag(flags, {
        id: `mistake-${label.toLowerCase().replace(/\s+/g, "-")}`,
        category: "discipline",
        severity: "warning",
        title: `${label} flagged`,
        reason: `Mistake tag "${label}" signals elevated execution risk.`,
        recommendation: "Clarify what went wrong in notes before you commit to this entry.",
      })
    }
  }

  const snapshot = buildRiskSnapshot(settings, history, startingBalance)
  const todayTrades = getTodayTrades(history, new Date(tradeDate))
  const dailyRules = buildDailyRules(settings, history, startingBalance)

  if (snapshot.todayLossPercent >= snapshot.dailyLossLimit) {
    pushFlag(flags, {
      id: "daily-loss-limit",
      category: "session",
      severity: "critical",
      title: "Daily loss limit reached",
      reason: `Today's loss is ${snapshot.todayLossPercent.toFixed(1)}% — at or above your ${snapshot.dailyLossLimit}% cap.`,
      recommendation: "Stop live trading for today. Review in journal or sim only.",
    })
  } else if (snapshot.todayLossPercent >= snapshot.dailyLossLimit * 0.8) {
    pushFlag(flags, {
      id: "daily-loss-warning",
      category: "session",
      severity: "warning",
      title: "Approaching daily loss limit",
      reason: `${snapshot.todayLossPercent.toFixed(1)}% of ${snapshot.dailyLossLimit}% daily loss used.`,
      recommendation: "Next trade should be A+ only with minimum size — or pause.",
    })
  }

  if (todayTrades.length >= settings.max_trades_per_day) {
    pushFlag(flags, {
      id: "max-trades-reached",
      category: "session",
      severity: "critical",
      title: "Max trades for today reached",
      reason: `You already logged ${todayTrades.length}/${settings.max_trades_per_day} trades today.`,
      recommendation: "Quality over quantity — additional entries today are statistically costly.",
    })
  }

  const impulsiveLossesToday = countTodayImpulsiveLosses(history, tradeDate)
  const formIsImpulsive = IMPULSIVE_EMOTIONS.has(form.emotion)
  if (impulsiveLossesToday >= 2 && formIsImpulsive) {
    pushFlag(flags, {
      id: "impulsive-loss-cluster",
      category: "pattern",
      severity: "critical",
      title: "Multiple impulsive losses today",
      reason: `${impulsiveLossesToday} emotional/impulsive losses already logged — current state is ${form.emotion}.`,
      recommendation: "End the session or run pre-trade coach before another click.",
    })
  } else if (impulsiveLossesToday >= 2) {
    pushFlag(flags, {
      id: "impulsive-loss-cluster-soft",
      category: "pattern",
      severity: "warning",
      title: "Impulsive loss cluster today",
      reason: `${impulsiveLossesToday} impulsive losses today — discipline decay is showing.`,
      recommendation: "Extra confirmation on every entry for the rest of the session.",
    })
  }

  const lossStreak = getRecentLossStreak(history)
  if (lossStreak >= 3 && formIsImpulsive) {
    pushFlag(flags, {
      id: "loss-streak-emotion",
      category: "pattern",
      severity: "critical",
      title: "Loss streak + emotional entry",
      reason: `${lossStreak} consecutive losses in your journal with ${form.emotion} state on this trade.`,
      recommendation: "Mandatory cooldown — funded accounts rarely survive revenge after streaks.",
    })
  } else if (lossStreak >= 3) {
    pushFlag(flags, {
      id: "loss-streak",
      category: "pattern",
      severity: "warning",
      title: "Loss streak active",
      reason: `${lossStreak} consecutive losses before this entry.`,
      recommendation: "Reduce size 50% or skip until you reset emotionally.",
    })
  }

  const failedRules = dailyRules.filter((rule) => !rule.checked)
  if (failedRules.length >= 2 && (formIsImpulsive || !form.rule_followed)) {
    pushFlag(flags, {
      id: "daily-rules-failing",
      category: "session",
      severity: "warning",
      title: "Daily rules off track",
      reason: `${failedRules.length} daily rules already failing: ${failedRules.map((rule) => rule.rule).join("; ")}.`,
      recommendation: "Fix process before adding P&L risk — review Daily Rules on your dashboard.",
    })
  }

  const hasCritical = flags.some((flag) => flag.severity === "critical")
  const severity: TradeRiskGuardSeverity = hasCritical
    ? "critical"
    : flags.length > 0
      ? "caution"
      : "clear"

  return {
    severity,
    flags,
    headline: buildHeadline(severity, flags),
    coachNote: buildCoachNote(severity, flags),
    requiresConfirmation: flags.length > 0,
  }
}
