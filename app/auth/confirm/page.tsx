"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Mail } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AuthPageFrame } from "@/components/auth/auth-page-frame"
import { AuthErrorBanner, AuthShell } from "@/components/auth/auth-shell"
import { AuthLoadingState } from "@/components/auth/auth-loading-state"
import { bootstrapNewUserRecords } from "@/lib/auth-bootstrap"
import {
  exchangeAuthCodeForSession,
  mapVerificationErrorMessage,
  verifyEmailTokenHash,
} from "@/lib/auth-email-verify"
import { APP_HOME_PATH } from "@/lib/branding"
import { sanitizeRedirectPath } from "@/lib/auth-routes"

type ConfirmPhase = "checking" | "success" | "invalid"

export default function AuthConfirmPage() {
  const [phase, setPhase] = useState<ConfirmPhase>("checking")
  const [error, setError] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let cancelled = false

    async function completeVerification() {
      const params = new URLSearchParams(window.location.search)
      const tokenHash = params.get("token_hash")
      const code = params.get("code")
      const type = params.get("type")
      const next = sanitizeRedirectPath(params.get("next"))

      if (type === "recovery") {
        window.location.replace(`/auth/reset-password?${params.toString()}`)
        return
      }

      let verified = false
      let failureMessage = "This confirmation link is invalid or incomplete."

      if (tokenHash) {
        const result = await verifyEmailTokenHash(supabase, tokenHash, type)
        verified = result.ok
        if (!result.ok) {
          failureMessage = mapVerificationErrorMessage(result.message)
        }
      } else if (code) {
        const result = await exchangeAuthCodeForSession(supabase, code)
        verified = result.ok
        if (!result.ok) {
          failureMessage = mapVerificationErrorMessage(result.message)
        }
      }

      if (cancelled) return

      if (!verified) {
        setError(failureMessage)
        setPhase("invalid")
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (cancelled) return

      if (!user) {
        setError("Your session could not be saved on this device. Try opening the link in Safari or Chrome.")
        setPhase("invalid")
        return
      }

      await bootstrapNewUserRecords(supabase, user.id)

      if (cancelled) return

      setPhase("success")
      window.history.replaceState({}, "", "/auth/confirm")
      window.location.assign(next)
    }

    void completeVerification()

    return () => {
      cancelled = true
    }
  }, [supabase])

  if (phase === "checking") {
    return (
      <AuthLoadingState
        title="Confirming your email"
        subtitle="Setting up your Vyronis HQ session…"
      />
    )
  }

  if (phase === "success") {
    return (
      <AuthPageFrame>
        <AuthShell title="Email confirmed" subtitle="Redirecting to your dashboard…" accent="profit">
          <p className="text-center text-sm text-muted-foreground">
            Taking you to Vyronis HQ…
          </p>
        </AuthShell>
      </AuthPageFrame>
    )
  }

  return (
    <AuthPageFrame>
      <AuthShell
        title="Authentication Error"
        subtitle="We could not complete sign-in"
        accent="loss"
      >
        <div className="space-y-4">
          {error && <AuthErrorBanner message={error} />}
          <Link
            href="/auth/login"
            className="auth-submit-btn inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl btn-primary py-3"
          >
            Back to Login
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/auth/verify-email"
            className="inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl border border-cyan-glow/25 bg-cyan-glow/[0.06] py-3 text-sm font-medium text-cyan-glow hover:bg-cyan-glow/[0.1]"
          >
            <Mail className="size-4" />
            Resend verification email
          </Link>
          <p className="text-center text-xs text-muted-foreground">
            Tip: open the newest email link in Safari or Chrome — not an in-app preview.
          </p>
        </div>
      </AuthShell>
    </AuthPageFrame>
  )
}
