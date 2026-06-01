import { getWeekRange } from "@/lib/ai/weekly-debrief-engine"
import { getRecentLossStreak, type TradeRiskGuardHistoryTrade } from "@/lib/trade-risk-guard"
import { getSignedPnL } from "@/lib/trade-utils"
import { getTradeTimestamp } from "@/lib/user-settings"
import { loadCoachChapterContext } from "@/lib/coach-chapters/context-service"
import { sendMorningChapterEmail } from "@/lib/alerts/morning-chapter-email"
import { sendLossStreakAlertEmail } from "@/lib/alerts/loss-streak-email"
import { sendWeeklyDebriefReadyEmail } from "@/lib/alerts/weekly-debrief-email"
import { toWeekStartISO } from "@/lib/weekly-chapters/week-utils"
import {
  mergeDashboardPreferences,
  parseDashboardPreferences,
  type AlertPreferences,
} from "@/lib/user-preferences"
import type { SupabaseClient } from "@supabase/supabase-js"

export const LOSS_STREAK_EMAIL_THRESHOLD = 5
export const DAILY_LOSS_NOTIFY_RATIO = 0.8

function countTradesInWeek(
  trades: TradeRiskGuardHistoryTrade[],
  weekStart: Date,
  weekEnd: Date,
): number {
  const startMs = weekStart.getTime()
  const endMs = weekEnd.getTime()
  return trades.filter((trade) => {
    const ts = getTradeTimestamp(trade)
    return ts >= startMs && ts <= endMs
  }).length
}

export function getLatestLossTradeId(trades: TradeRiskGuardHistoryTrade[]): string | null {
  const sorted = [...trades].sort(
    (a, b) =>
      new Date(b.trade_date || b.created_at).getTime() -
      new Date(a.trade_date || a.created_at).getTime(),
  )

  for (const trade of sorted) {
    const signed = getSignedPnL(trade.pnl, trade.result)
    if (signed < 0) return trade.id ?? null
    if (trade.result !== "BREAKEVEN") break
  }

  return null
}

export function getWeekKey(referenceDate = new Date()): string {
  const { start } = getWeekRange(referenceDate, 0)
  return start.toISOString().slice(0, 10)
}

export function formatWeekLabel(referenceDate = new Date()): string {
  const { start, end } = getWeekRange(referenceDate, 0)
  const startLabel = start.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  return `${startLabel} – ${endLabel}`
}

export async function evaluateLossStreakEmailAlert(input: {
  supabase: SupabaseClient
  userId: string
  email: string
  trades: TradeRiskGuardHistoryTrade[]
}): Promise<{ sent: boolean; streak: number }> {
  const streak = getRecentLossStreak(input.trades)
  if (streak < LOSS_STREAK_EMAIL_THRESHOLD) {
    return { sent: false, streak }
  }

  const triggerTradeId = getLatestLossTradeId(input.trades)
  if (!triggerTradeId) {
    return { sent: false, streak }
  }

  const { data: settingsRow } = await input.supabase
    .from("user_settings")
    .select("dashboard_preferences")
    .eq("user_id", input.userId)
    .maybeSingle()

  const prefs = parseDashboardPreferences(settingsRow?.dashboard_preferences)
  if (prefs.alerts?.lossStreak5TradeId === triggerTradeId) {
    return { sent: false, streak }
  }

  const result = await sendLossStreakAlertEmail({ to: input.email, streak })
  if (!result.sent) {
    return { sent: false, streak }
  }

  const nextAlerts: AlertPreferences = {
    ...prefs.alerts,
    lossStreak5TradeId: triggerTradeId,
  }

  await input.supabase
    .from("user_settings")
    .update({
      dashboard_preferences: mergeDashboardPreferences(settingsRow?.dashboard_preferences, {
        alerts: nextAlerts,
      }),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", input.userId)

  return { sent: true, streak }
}

export async function evaluateWeeklyDebriefEmailAlert(input: {
  supabase: SupabaseClient
  userId: string
  email: string
  trades: TradeRiskGuardHistoryTrade[]
  referenceDate?: Date
}): Promise<{ sent: boolean; tradeCount: number }> {
  const referenceDate = input.referenceDate ?? new Date()
  const weekRange = getWeekRange(referenceDate, 0)
  const tradeCount = countTradesInWeek(input.trades, weekRange.start, weekRange.end)
  if (tradeCount === 0) {
    return { sent: false, tradeCount: 0 }
  }

  const weekKey = getWeekKey(referenceDate)
  const { data: settingsRow } = await input.supabase
    .from("user_settings")
    .select("dashboard_preferences")
    .eq("user_id", input.userId)
    .maybeSingle()

  const prefs = parseDashboardPreferences(settingsRow?.dashboard_preferences)
  if (prefs.alerts?.weeklyDebriefWeekKey === weekKey) {
    return { sent: false, tradeCount }
  }

  const result = await sendWeeklyDebriefReadyEmail({
    to: input.email,
    weekLabel: formatWeekLabel(referenceDate),
    tradeCount,
  })

  if (!result.sent) {
    return { sent: false, tradeCount }
  }

  const nextAlerts: AlertPreferences = {
    ...prefs.alerts,
    weeklyDebriefWeekKey: weekKey,
  }

  await input.supabase
    .from("user_settings")
    .update({
      dashboard_preferences: mergeDashboardPreferences(settingsRow?.dashboard_preferences, {
        alerts: nextAlerts,
      }),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", input.userId)

  return { sent: true, tradeCount }
}

export async function evaluateMorningChapterEmailAlert(input: {
  supabase: SupabaseClient
  userId: string
  email: string
  accountId: string | null
  referenceDate?: Date
}): Promise<{ sent: boolean }> {
  const referenceDate = input.referenceDate ?? new Date()
  if (referenceDate.getDay() !== 1) {
    return { sent: false }
  }

  if (!input.accountId) {
    return { sent: false }
  }

  const weekKey = toWeekStartISO(referenceDate)

  const { data: settingsRow } = await input.supabase
    .from("user_settings")
    .select("dashboard_preferences")
    .eq("user_id", input.userId)
    .maybeSingle()

  const prefs = parseDashboardPreferences(settingsRow?.dashboard_preferences)
  if (prefs.alerts?.morningBriefingDateKey === weekKey) {
    return { sent: false }
  }

  const chapterContext = await loadCoachChapterContext(
    input.supabase,
    input.userId,
    input.accountId,
  ).catch(() => null)

  if (!chapterContext) {
    return { sent: false }
  }

  const result = await sendMorningChapterEmail({
    to: input.email,
    traderFirstName: chapterContext.traderFirstName,
    chapterNumber: chapterContext.currentChapterNumber,
    openingMessage: chapterContext.openingMessage,
    tradesUsedLabel: null,
  })

  if (!result.sent) {
    return { sent: false }
  }

  const nextAlerts: AlertPreferences = {
    ...prefs.alerts,
    morningBriefingDateKey: weekKey,
  }

  await input.supabase
    .from("user_settings")
    .update({
      dashboard_preferences: mergeDashboardPreferences(settingsRow?.dashboard_preferences, {
        alerts: nextAlerts,
      }),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", input.userId)

  return { sent: true }
}
