"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { clearLocalAuthSession, redirectToLogin, signOutWithTimeout } from "@/lib/auth-sign-out"
import { clearClientSessionData } from "@/lib/client-session"
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
  const [propFirmSize, setPropFirmSize] = useState<string | null>(null)

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
          .select("prop_firm_size")
          .eq("user_id", authUser.id)
          .maybeSingle(),
      ])

      if (cancelled) return

      if (profileResult.status === "fulfilled" && profileResult.value.profile) {
        setUserProfile(profileResult.value.profile)
      }

      if (settingsResult.status === "fulfilled" && settingsResult.value.data) {
        setPropFirmSize(settingsResult.value.data.prop_firm_size ?? null)
      }

      setIsLoadingProfile(false)
      setIsAuthReady(true)
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [options.loginNextPath, router, supabase])

  const profileCard: UserProfileCardProps = buildUserProfileCardProps({
    profile: userProfile,
    email: user?.email,
    propFirmSize,
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
    setUser(null)

    await clearLocalAuthSession(supabase)
    void signOutWithTimeout(supabase)

    redirectToLogin()
    window.setTimeout(() => redirectToLogin(), 1500)
  }, [isLoggingOut, supabase, toast, user?.id])

  return {
    user,
    isAuthReady,
    isLoggingOut,
    profileCard,
    showProfileEmptyHint,
    handleLogout,
    supabase,
  }
}
