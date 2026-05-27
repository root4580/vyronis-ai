"use client"

import { useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Lock, Mail } from "lucide-react"
import {
  AuthErrorBanner,
  AuthField,
  AuthShell,
  AuthSubmitButton,
} from "@/components/auth/auth-shell"
import { AuthEmailSentPanel } from "@/components/auth/auth-email-sent-panel"
import { formatAuthError } from "@/lib/auth-errors"
import { getSignupEmailRedirectUrl } from "@/lib/auth-email"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"

const RESEND_KEY_PREFIX = "vyronis-auth-signup-sent:"

export default function SignUpPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  async function ensureDefaultSettings(userId: string) {
    await supabase.from("user_settings").upsert(
      {
        user_id: userId,
        ...DEFAULT_USER_SETTINGS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    )
  }

  async function ensureDefaultProfile(userId: string) {
    await supabase.from("user_profiles").upsert(
      {
        user_id: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    )
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const trimmedEmail = email.trim()

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      setLoading(false)
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        emailRedirectTo: getSignupEmailRedirectUrl(),
      },
    })

    if (signUpError) {
      setError(formatAuthError(signUpError.message))
      setLoading(false)
      return
    }

    if (data.session?.user) {
      await ensureDefaultSettings(data.session.user.id)
      await ensureDefaultProfile(data.session.user.id)
      window.location.assign("/")
      return
    }

    window.localStorage.setItem(`${RESEND_KEY_PREFIX}${trimmedEmail}`, String(Date.now()))
    setSuccess(true)
    setLoading(false)
  }

  async function resendSignupEmail() {
    const trimmedEmail = email.trim()
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: trimmedEmail,
      options: {
        emailRedirectTo: getSignupEmailRedirectUrl(),
      },
    })

    return { error: resendError ? formatAuthError(resendError.message) : null }
  }

  if (success) {
    return (
      <AuthShell
        title="Check Your Email"
        subtitle="Confirm your email to activate your Vyronis AI account"
        accent="profit"
      >
        <AuthEmailSentPanel
          email={email.trim()}
          title="Verification email sent"
          description="Open the link in your email to activate your account and access your trading dashboard."
          resendLabel="Resend verification email"
          resendStorageKey={`${RESEND_KEY_PREFIX}${email.trim()}`}
          onResend={resendSignupEmail}
        />
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Create Account" subtitle="Start journaling trades with cloud sync and analytics">
      <form onSubmit={handleSignUp} className="space-y-4">
        <AuthField
          label="Email"
          icon={Mail}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="trader@example.com"
          autoComplete="email"
          required
        />

        <AuthField
          label="Password"
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

        <AuthSubmitButton loading={loading} loadingLabel="Creating Account..." label="Create Account" />
      </form>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/auth/login" className="font-medium text-cyan-glow hover:underline">
          Sign In
        </Link>
      </div>
    </AuthShell>
  )
}
