import { buildRiskSnapshot, getLocalDateKey, type UserSettingsForm } from "@/lib/user-settings"
import { DAILY_LOSS_NOTIFY_RATIO } from "@/lib/alerts/evaluate-alerts"
import type { TradeRiskGuardHistoryTrade } from "@/lib/trade-risk-guard"

function storageKey(userId: string, dateKey: string): string {
  return `vyronis-alert-daily-loss-${userId}-${dateKey}`
}

export function shouldNotifyDailyLoss(
  settings: UserSettingsForm,
  trades: TradeRiskGuardHistoryTrade[],
  startingBalance: number,
): { notify: boolean; todayLossPercent: number; dailyLossLimit: number } {
  const snapshot = buildRiskSnapshot(settings, trades, startingBalance)
  const ratio =
    snapshot.dailyLossLimit > 0 ? snapshot.todayLossPercent / snapshot.dailyLossLimit : 0

  return {
    notify: ratio >= DAILY_LOSS_NOTIFY_RATIO,
    todayLossPercent: snapshot.todayLossPercent,
    dailyLossLimit: snapshot.dailyLossLimit,
  }
}

export async function maybeShowDailyLossNotification(input: {
  userId: string
  settings: UserSettingsForm
  trades: TradeRiskGuardHistoryTrade[]
  startingBalance: number
}): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false
  }

  const check = shouldNotifyDailyLoss(input.settings, input.trades, input.startingBalance)
  if (!check.notify) return false

  const dateKey = getLocalDateKey(new Date())
  const key = storageKey(input.userId, dateKey)
  if (window.localStorage.getItem(key)) return false

  if (Notification.permission === "default") {
    await Notification.requestPermission()
  }

  if (Notification.permission !== "granted") {
    return false
  }

  const body = `${check.todayLossPercent.toFixed(1)}% of your ${check.dailyLossLimit}% daily loss limit used — next entry should be A+ size only.`

  new Notification("Near daily loss limit", {
    body,
    tag: key,
  })

  window.localStorage.setItem(key, "1")
  return true
}
