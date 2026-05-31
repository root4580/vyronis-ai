"use client"

import { useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  clearLocalAuthSession,
  redirectToLogin,
  signOutWithTimeout,
} from "@/lib/auth-sign-out"
import { clearClientSessionData } from "@/lib/client-session"
import {
  clearLastActiveAt,
  getIdleAwayMs,
  IDLE_REFRESH_MS,
  IDLE_SIGN_OUT_MS,
  readLastActiveAt,
  touchLastActiveAt,
} from "@/lib/idle-return-policy"
import { createClient } from "@/lib/supabase/client"

type UseIdleReturnPolicyOptions = {
  enabled?: boolean
}

export function useIdleReturnPolicy({ enabled = true }: UseIdleReturnPolicyOptions = {}) {
  const router = useRouter()
  const handlingRef = useRef(false)
  const hiddenAtRef = useRef<number | null>(null)
  const lastActiveRef = useRef(readLastActiveAt())

  const handleLongIdle = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    clearClientSessionData(user?.id)
    clearLastActiveAt()
    await clearLocalAuthSession(supabase)
    void signOutWithTimeout(supabase)
    redirectToLogin()
    window.setTimeout(() => redirectToLogin(), 1500)
  }, [])

  const handleShortIdle = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    touchLastActiveAt()
    clearClientSessionData(user?.id)
    router.refresh()
    window.location.reload()
  }, [router])

  const evaluateReturn = useCallback(async () => {
    if (!enabled || handlingRef.current) return
    if (document.visibilityState === "hidden") return

    const baseline = hiddenAtRef.current ?? lastActiveRef.current
    const awayMs = getIdleAwayMs(Date.now(), baseline)
    hiddenAtRef.current = null

    if (awayMs >= IDLE_SIGN_OUT_MS) {
      handlingRef.current = true
      await handleLongIdle()
      return
    }

    if (awayMs >= IDLE_REFRESH_MS) {
      handlingRef.current = true
      await handleShortIdle()
      return
    }

    const now = Date.now()
    lastActiveRef.current = now
    touchLastActiveAt(now)
  }, [enabled, handleLongIdle, handleShortIdle])

  useEffect(() => {
    if (!enabled) return

    const initialAwayMs = getIdleAwayMs()
    if (initialAwayMs >= IDLE_SIGN_OUT_MS) {
      handlingRef.current = true
      void handleLongIdle()
    } else if (initialAwayMs >= IDLE_REFRESH_MS) {
      handlingRef.current = true
      void handleShortIdle()
    } else {
      const now = Date.now()
      lastActiveRef.current = now
      touchLastActiveAt(now)
    }

    function markActive() {
      if (handlingRef.current) return
      const now = Date.now()
      lastActiveRef.current = now
      touchLastActiveAt(now)
    }

    function handleHidden() {
      hiddenAtRef.current = Date.now()
      touchLastActiveAt(hiddenAtRef.current)
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        handleHidden()
        return
      }
      void evaluateReturn()
    }

    function handleFocus() {
      if (document.visibilityState === "hidden") return
      void evaluateReturn()
    }

    const activityEvents = ["pointerdown", "keydown", "touchstart", "scroll"] as const
    for (const event of activityEvents) {
      window.addEventListener(event, markActive, { passive: true })
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleFocus)

    return () => {
      for (const event of activityEvents) {
        window.removeEventListener(event, markActive)
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
    }
  }, [enabled, evaluateReturn, handleLongIdle, handleShortIdle])
}
