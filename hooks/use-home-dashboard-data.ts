"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { createClient } from "@/lib/supabase/client"
import { filterTradesForAccount } from "@/lib/account-status"
import { journalTradesOrFilter } from "@/lib/analytics/trade-scope"
import {
  DASHBOARD_TRADE_SELECT,
  DASHBOARD_TRADE_SELECT_WITHOUT_REFLECTION,
  DASHBOARD_TRADE_SELECT_WITHOUT_TRADE_REFLECTION,
  DASHBOARD_TRADES_LIMIT,
} from "@/lib/trades/dashboard-trade-query"
import { readCachedTrades, TRADES_LOAD_TIMEOUT_MS, writeCachedTrades } from "@/lib/dashboard-cache"
import { withTimeout, DASHBOARD_LOAD_TIMEOUT_MS } from "@/lib/dashboard-loading-debug"
import {
  DEFAULT_USER_SETTINGS,
  normalizeUserSettings,
  type UserSettingsForm,
  type UserSettingsRecord,
} from "@/lib/user-settings"
import {
  DEFAULT_USER_PROFILE,
  loadUserProfile,
  readCachedUserProfile,
  type UserProfileForm,
} from "@/lib/user-profile"
import type { SetupCoachingInsight, SetupScoreBreakdown } from "@/lib/trade-coach/setup-score-engine"
import type { VyronisScoreBreakdown } from "@/types/strategy"
import { type VyronisJournalEvaluationRecord } from "@/lib/strategy/vyronis-journal-bridge"

/** Same shape as the local `Trade` type in app/(app)/hq/page.tsx — kept in sync intentionally. */
export type HomeDashboardTrade = {
  id: string
  pair: string
  direction: string
  result: string
  pnl: number
  emotion: string
  setup: string
  strategy_name: string | null
  risk_percent: number | null
  rule_followed: boolean | null
  user_id: string | null
  account_id?: string | null
  trade_date: string | null
  higher_timeframe: string | null
  entry_timeframe: string | null
  confirmation_timeframe: string | null
  confirmation_signal: string | null
  session: string | null
  screenshot_url: string | null
  reflection_chart_url?: string | null
  entry_price?: number | null
  stop_loss?: number | null
  take_profit?: number | null
  risk_reward?: number | null
  lots?: number | null
  opened_at?: string | null
  closed_at?: string | null
  hold_minutes?: number | null
  emotion_after?: string | null
  mistake_tags?: string | null
  trade_notes?: string | null
  thinking_before?: string | null
  thinking_during?: string | null
  thinking_after?: string | null
  biggest_mistake?: string | null
  lesson_learned?: string | null
  what_worked?: string | null
  what_didnt_work?: string | null
  setup_score?: number | null
  setup_classification?: string | null
  setup_score_breakdown?: SetupScoreBreakdown | VyronisScoreBreakdown | null
  setup_coaching_insights?: SetupCoachingInsight[] | null
  weekly_bias?: string | null
  daily_bias?: string | null
  h4_bias?: string | null
  aoi_type?: string | null
  confirmation_type?: string | null
  entry_quality?: string | null
  vyronis_evaluation?: VyronisJournalEvaluationRecord | null
  import_source?: string | null
  plan_id?: string | null
  created_at: string
}

type UseHomeDashboardDataOptions = {
  supabase: ReturnType<typeof createClient>
  userId: string | undefined
  userMetadata?: Record<string, unknown>
  activeAccountId: string | null | undefined
  legacyAccountId?: string | null
}

/**
 * Trades + settings + profile wiring for the new Home tab — mirrors the
 * data-fetching in app/(app)/hq/page.tsx's "dashboard" tab (same queries,
 * same cache, same fallback-on-missing-column behavior) without pulling in
 * that file's unrelated tab/modal logic. Kept independent on purpose while
 * both routes exist side by side.
 */
export function useHomeDashboardData({
  supabase,
  userId,
  userMetadata,
  activeAccountId,
  legacyAccountId,
}: UseHomeDashboardDataOptions) {
  const [trades, setTrades] = useState<HomeDashboardTrade[]>([])
  const [isLoadingTrades, setIsLoadingTrades] = useState(true)
  const [userSettings, setUserSettings] = useState<UserSettingsRecord | null>(null)
  const [settingsForm, setSettingsForm] = useState<UserSettingsForm>(DEFAULT_USER_SETTINGS)
  const [userProfile, setUserProfile] = useState<UserProfileForm>(DEFAULT_USER_PROFILE)

  const refetchTrades = useCallback(
    async (targetUserId?: string) => {
      const uid = targetUserId ?? userId
      if (!uid) return

      type TradesQueryResult = Promise<{
        data: HomeDashboardTrade[] | null
        error: { message: string; code?: string } | null
      }>

      try {
        const query = supabase
          .from("trades")
          .select(DASHBOARD_TRADE_SELECT)
          .eq("user_id", uid)
          .or(journalTradesOrFilter())
          .order("created_at", { ascending: false })
          .limit(DASHBOARD_TRADES_LIMIT)

        let { data, error } = await withTimeout(
          query as unknown as TradesQueryResult,
          TRADES_LOAD_TIMEOUT_MS,
          "trades.select",
        )

        if (error) {
          const retry = await withTimeout(
            supabase
              .from("trades")
              .select(DASHBOARD_TRADE_SELECT_WITHOUT_TRADE_REFLECTION)
              .eq("user_id", uid)
              .or(journalTradesOrFilter())
              .order("created_at", { ascending: false })
              .limit(DASHBOARD_TRADES_LIMIT) as unknown as TradesQueryResult,
            TRADES_LOAD_TIMEOUT_MS,
            "trades.select.retry",
          )
          data = retry.data
          error = retry.error
        }

        if (error) {
          const retry = await withTimeout(
            supabase
              .from("trades")
              .select(DASHBOARD_TRADE_SELECT_WITHOUT_REFLECTION)
              .eq("user_id", uid)
              .or(journalTradesOrFilter())
              .order("created_at", { ascending: false })
              .limit(DASHBOARD_TRADES_LIMIT) as unknown as TradesQueryResult,
            TRADES_LOAD_TIMEOUT_MS,
            "trades.select.retry2",
          )
          data = retry.data
          error = retry.error
        }

        const nextTrades = data ?? []
        setTrades(nextTrades)
        writeCachedTrades(uid, nextTrades)
      } catch {
        // keep cached/last-known trades on failure
      } finally {
        setIsLoadingTrades(false)
      }
    },
    [supabase, userId],
  )

  useEffect(() => {
    if (!userId) return
    const uid = userId

    let cancelled = false

    const cached = readCachedTrades<HomeDashboardTrade>(uid)
    if (cached.length > 0) setTrades(cached)

    const cachedProfile = readCachedUserProfile(uid)
    if (cachedProfile) setUserProfile(cachedProfile)

    async function fetchSettings() {
      try {
        const { data } = await withTimeout(
          supabase.from("user_settings").select("*").eq("user_id", uid).maybeSingle() as unknown as Promise<{
            data: UserSettingsRecord | null
            error: { message: string; code?: string } | null
          }>,
          DASHBOARD_LOAD_TIMEOUT_MS,
          "user_settings.select",
        )
        if (cancelled) return
        if (data) {
          setUserSettings(data)
          setSettingsForm(normalizeUserSettings(data))
        }
      } catch {
        // keep defaults on failure
      }
    }

    async function fetchProfile() {
      try {
        const result = await withTimeout(
          loadUserProfile(supabase, uid, userMetadata ?? {}),
          DASHBOARD_LOAD_TIMEOUT_MS,
          "user_profiles.load",
        )
        if (cancelled) return
        if (result.profile) setUserProfile(result.profile)
      } catch {
        // keep cached/default profile on failure
      }
    }

    void refetchTrades(uid)
    void fetchSettings()
    void fetchProfile()

    return () => {
      cancelled = true
    }
  }, [supabase, userId, userMetadata, refetchTrades])

  const accountTrades = useMemo(
    () => filterTradesForAccount(trades, activeAccountId, legacyAccountId),
    [trades, activeAccountId, legacyAccountId],
  )

  const winRate = useMemo(() => {
    if (accountTrades.length === 0) return 0
    const winCount = accountTrades.filter((t) => t.result === "WIN").length
    return Math.round((winCount / accountTrades.length) * 100)
  }, [accountTrades])

  return {
    trades,
    setTrades,
    refetchTrades,
    accountTrades,
    isLoadingTrades,
    userSettings,
    setUserSettings,
    settingsForm,
    setSettingsForm,
    userProfile,
    winRate,
  }
}
