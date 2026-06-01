"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { clearLocalAuthSession, redirectToLogin, signOutWithTimeout } from "@/lib/auth-sign-out"
import { clearClientSessionData } from "@/lib/client-session"
import { clearLastActiveAt, touchLastActiveAt } from "@/lib/idle-return-policy"
import {
  buildUserProfileCardProps,
  type UserProfileCardProps,
} from "@/components/dashboard/user-profile-card"
import {
  DEFAULT_USER_PROFILE,
  loadUserProfile,
  readCachedUserProfile,
} from "@/lib/user-profile"
import { useToast } from "@/hooks/use-toast"
import { useIdleReturnPolicy } from "@/hooks/use-idle-return-policy"
import { useActiveTradingAccount } from "@/hooks/use-active-trading-account"
import { useTradingRules } from "@/hooks/use-trading-rules"
import { TradingRulesBanner } from "@/components/dashboard/trading-rules-banner"
import { CooldownUnlockModal } from "@/components/dashboard/cooldown-unlock-modal"
import {
  DEFAULT_DASHBOARD_PREFERENCES,
  parseDashboardPreferences,
  type DashboardPreferences,
} from "@/lib/user-preferences"

type UseDashboardChromeOptions = {
  loginNextPath?: string
}

export function useDashboardChrome(options: UseDashboardChromeOptions = {}) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = useMemo(() => createClient(), [])
  const signingOutRef = useRef(false)

  const [user, setUser] = useState<User | null>(null)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [userProfile, setUserProfile] = useState(DEFAULT_USER_PROFILE)
  const [dashboardPreferences, setDashboardPreferences] = useState<DashboardPreferences>(
    DEFAULT_DASHBOARD_PREFERENCES,
  )

  const handlePreferencesChange = useCallback((preferences: DashboardPreferences) => {
    setDashboardPreferences(preferences)
  }, [])

  const tradingAccount = useActiveTradingAccount({
    supabase,
    userId: user?.id,
    dashboardPreferences,
    onPreferencesChange: handlePreferencesChange,
  })

  const tradingRules = useTradingRules({
    accountId: tradingAccount.activeAccountId,
    enabled: isAuthReady && Boolean(user),
  })

  const tradingRulesBanner = useMemo(
    () => (
      <TradingRulesBanner
        snapshot={tradingRules.snapshot}
        onRunCooldownCoach={() => tradingRules.setCooldownModalOpen(true)}
      />
    ),
    [tradingRules.snapshot, tradingRules.setCooldownModalOpen],
  )

  const tradingRulesModal = useMemo(
    () => (
      <CooldownUnlockModal
        open={tradingRules.cooldownModalOpen}
        accountId={tradingAccount.activeAccountId}
        traderFirstName={userProfile?.first_name}
        minEmotionalScore={tradingRules.snapshot?.rules.min_emotional_score ?? 7}
        onClose={() => tradingRules.setCooldownModalOpen(false)}
        onCompleted={(unlocked, message) => {
          toast({
            title: unlocked ? "Trading unlocked" : "Not ready yet",
            description: message,
            variant: unlocked ? "default" : "destructive",
          })
          void tradingRules.refresh()
          void tradingAccount.loadAccounts()
        }}
      />
    ),
    [
      tradingRules.cooldownModalOpen,
      tradingRules.snapshot?.rules.min_emotional_score,
      tradingRules.refresh,
      tradingRules.setCooldownModalOpen,
      tradingAccount.activeAccountId,
      tradingAccount.loadAccounts,
      userProfile?.first_name,
      toast,
    ],
  )

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (cancelled) return

      if (!authUser) {
        const next = options.loginNextPath
          ? `?next=${encodeURIComponent(options.loginNextPath)}`
          : ""
        router.replace(`/auth/login${next}`)
        return
      }

      setUser(authUser)

      const cachedProfile = readCachedUserProfile(authUser.id)
      if (cachedProfile) {
        setUserProfile(cachedProfile)
        setIsLoadingProfile(false)
      }

      const [profileResult, settingsResult] = await Promise.allSettled([
        loadUserProfile(supabase, authUser.id, authUser.user_metadata),
        supabase
          .from("user_settings")
          .select("dashboard_preferences")
          .eq("user_id", authUser.id)
          .maybeSingle(),
      ])

      if (cancelled) return

      if (profileResult.status === "fulfilled" && profileResult.value.profile) {
        setUserProfile(profileResult.value.profile)
      }

      if (settingsResult.status === "fulfilled" && settingsResult.value.data) {
        setDashboardPreferences(
          parseDashboardPreferences(settingsResult.value.data.dashboard_preferences),
        )
      }

      setIsLoadingProfile(false)
      setIsAuthReady(true)
      touchLastActiveAt()
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [options.loginNextPath, router, supabase])

  const profileCard: UserProfileCardProps = buildUserProfileCardProps({
    profile: userProfile,
    email: user?.email,
    propFirmSize: tradingAccount.activeAccount?.name ?? null,
    isLoading: isLoadingProfile && !userProfile.first_name && !userProfile.last_name,
  })

  const showProfileEmptyHint =
    !isLoadingProfile &&
    !userProfile.first_name?.trim() &&
    !userProfile.last_name?.trim()

  const handleLogout = useCallback(async () => {
    if (signingOutRef.current || isLoggingOut) return

    signingOutRef.current = true
    setIsLoggingOut(true)

    toast({
      title: "Signing out...",
      description: "Redirecting to login.",
    })

    clearClientSessionData(user?.id)
    clearLastActiveAt()
    setUser(null)

    await clearLocalAuthSession(supabase)
    void signOutWithTimeout(supabase)

    redirectToLogin()
    window.setTimeout(() => redirectToLogin(), 1500)
  }, [isLoggingOut, supabase, toast, user?.id])

  useIdleReturnPolicy({
    enabled: isAuthReady && Boolean(user) && !isLoggingOut,
  })

  return {
    user,
    isAuthReady,
    isLoggingOut,
    profileCard,
    showProfileEmptyHint,
    handleLogout,
    supabase,
    dashboardPreferences,
    ...tradingAccount,
    tradingRules,
    tradingRulesBanner,
    tradingRulesModal,
  }
}
