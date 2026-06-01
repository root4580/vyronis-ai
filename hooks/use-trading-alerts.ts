"use client"

import { useEffect, useRef } from "react"
import { maybeShowDailyLossNotification } from "@/lib/alerts/daily-loss-notification"
import { mapTradeToRiskHistory } from "@/lib/dashboard-risk-awareness"
import type { UserSettingsForm } from "@/lib/user-settings"

type AlertTrade = Parameters<typeof mapTradeToRiskHistory>[0]

type UseTradingAlertsInput = {
  userId?: string | null
  trades: AlertTrade[]
  settings: UserSettingsForm
  startingBalance: number
}

function runServerAlertCheck(): void {
  void fetch("/api/alerts/check", {
    method: "POST",
    credentials: "same-origin",
  }).catch(() => undefined)
}

export function useTradingAlerts(input: UseTradingAlertsInput): void {
  const dailyCheckKeyRef = useRef<string>("")
  const tradeCheckKeyRef = useRef<string>("")

  useEffect(() => {
    if (!input.userId || input.trades.length === 0) return

    const history = input.trades.map(mapTradeToRiskHistory)

    void maybeShowDailyLossNotification({
      userId: input.userId,
      settings: input.settings,
      trades: history,
      startingBalance: input.startingBalance,
    })
  }, [input.userId, input.trades, input.settings, input.startingBalance])

  useEffect(() => {
    if (!input.userId) return

    const today = new Date().toISOString().slice(0, 10)
    const dailyKey = `${input.userId}:${today}`
    if (dailyCheckKeyRef.current === dailyKey) return
    dailyCheckKeyRef.current = dailyKey

    runServerAlertCheck()
  }, [input.userId])

  useEffect(() => {
    if (!input.userId || input.trades.length === 0) return

    const latestTrade = [...input.trades].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0]
    if (!latestTrade) return

    const checkKey = `${input.userId}:${latestTrade.id}:${latestTrade.result}:${latestTrade.pnl}`
    if (tradeCheckKeyRef.current === checkKey) return
    tradeCheckKeyRef.current = checkKey

    runServerAlertCheck()
  }, [input.userId, input.trades])
}
