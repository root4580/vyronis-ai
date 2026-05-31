"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Lock } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { AuthChangeEvent } from "@supabase/supabase-js"
import {
  AuthErrorBanner,
  AuthField,
  AuthShell,
  AuthSubmitButton,
  AuthSuccessBanner,
} from "@/components/auth/auth-shell"
import { AuthLoadingState } from "@/components/auth/auth-loading-state"
import { formatAuthError } from "@/lib/auth-errors"

type ResetPhase = "checking" | "ready" | "invalid" | "success"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState<ResetPhase>("checking")
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let cancelled = false

    async function verifyRecoverySession() {
      const params = new URLSearchParams(window.location.search)
      const code = params.get("code")
      const tokenHash = params.get("token_hash")
      const type = params.get("type")

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (cancelled) return

        if (exchangeError) {
          setPhase("invalid")
          setError(formatAuthError("This reset link is invalid or has expired. Request a new one."))
          return
        }

        window.history.replaceState({}, "", "/auth/reset-password")
      } else if (tokenHash && type === "recovery") {
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        })
        if (cancelled) return

        if (otpError) {
          setPhase("invalid")
          setError(formatAuthError("This reset link is invalid or has expired. Request a new one."))
          return
        }

        window.history.replaceState({}, "", "/auth/reset-password")
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (cancelled) return

      if (sessionError || !session?.user) {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (cancelled) return

        if (userError || !user) {
          setPhase("invalid")
          setError("Your reset session expired. Request a new password reset link.")
          return
        }

        setPhase("ready")
        return
      }

      setPhase("ready")
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === "PASSWORD_RECOVERY") {
        setPhase("ready")
        setError(null)
      }
    })

    void verifyRecoverySession()

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(formatAuthError(updateError.message))
      setLoading(false)
      return
    }

    await supabase.auth.signOut()
    setPhase("success")
    setLoading(false)
  }

  if (phase === "checking") {
    return (
      <AuthLoadingState
        title="Reset Password"
        subtitle="Verifying your secure reset link…"
      />
    )
  }

  if (phase === "success") {
    return (
      <AuthShell
        title="Password Updated"
        subtitle="Your account is ready — sign in with your new password"
        accent="profit"
      >
        <div className="space-y-4 text-center">
          <AuthSuccessBanner message="Password saved successfully." />
          <Link
            href="/auth/login"
            className="auth-submit-btn inline-flex w-full items-center justify-center gap-2 rounded-xl btn-primary py-3"
          >
            Sign In
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </AuthShell>
    )
  }

  if (phase === "invalid") {
    return (
      <AuthShell
        title="Link Expired"
        subtitle="Request a new password reset to continue"
        accent="loss"
      >
        <div className="space-y-4">
          {error && <AuthErrorBanner message={error} />}
          <Link
            href="/auth/forgot-password"
            className="auth-submit-btn inline-flex w-full items-center justify-center gap-2 rounded-xl btn-primary py-3"
          >
            Request New Link
          </Link>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/auth/login" className="font-medium text-cyan-glow hover:underline">
              Back to Login
            </Link>
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="New Password" subtitle="Choose a strong password for your Vyronis account">
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          label="New Password"
          icon={Lock}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          required
          minLength={6}
        />

        <AuthField
          label="Confirm Password"
          icon={Lock}
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          required
          minLength={6}
        />

        {error && <AuthErrorBanner message={error} />}

        <AuthSubmitButton
          loading={loading}
          loadingLabel="Saving password..."
          label="Update Password"
        />
      </form>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/auth/login" className="font-medium text-cyan-glow hover:underline">
          Back to Login
        </Link>
      </div>
    </AuthShell>
  )
}
