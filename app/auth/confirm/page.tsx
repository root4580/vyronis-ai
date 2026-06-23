"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Mail } from "lucide-react"
import { AuthPageFrame } from "@/components/auth/auth-page-frame"
import { AuthShell } from "@/components/auth/auth-shell"
import { AuthLoadingState } from "@/components/auth/auth-loading-state"

/**
 * Legacy / direct email links may still land here. Forward auth params to the server
 * callback route, which performs exchangeCodeForSession / verifyOtp with cookies.
 */
export default function AuthConfirmPage() {
  const [phase, setPhase] = useState<"loading" | "idle">("loading")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const hasAuthParams = params.has("code") || params.has("token_hash")

    if (hasAuthParams) {
      window.location.replace(`/auth/callback?${params.toString()}`)
      return
    }

    setPhase("idle")
  }, [])

  if (phase === "loading") {
    return (
      <AuthLoadingState
        title="Confirming your email"
        subtitle="Finishing verification on the server…"
      />
    )
  }

  return (
    <AuthPageFrame>
      <AuthShell
        title="Check your email"
        subtitle="Open the confirmation link we sent you"
        accent="profit"
      >
        <p className="text-center text-sm leading-relaxed text-muted-foreground">
          After you tap the link in your email, you&apos;ll be signed in automatically. Open it
          in Safari or Chrome — not an in-app mail preview.
        </p>
        <div className="mt-6 space-y-2">
          <Link
            href="/auth/verify-email"
            className="inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl border border-cyan-glow/25 bg-cyan-glow/[0.06] py-3 text-sm font-medium text-cyan-glow hover:bg-cyan-glow/[0.1]"
          >
            <Mail className="size-4" />
            Resend verification email
          </Link>
          <Link
            href="/auth/login"
            className="auth-submit-btn inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl btn-primary py-3"
          >
            Back to Login
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </AuthShell>
    </AuthPageFrame>
  )
}
