"use client"

import { useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Lock, Mail } from "lucide-react"
import { AuthPageFrame } from "@/components/auth/auth-page-frame"
import {
  AuthErrorBanner,
  AuthField,
  AuthShell,
  AuthSubmitButton,
} from "@/components/auth/auth-shell"
import { APP_HOME_PATH } from "@/lib/branding"
import { formatAuthError, isEmailNotConfirmedError } from "@/lib/auth-errors"
import { getVerifyEmailPageUrl } from "@/lib/auth-email"
import { sanitizeRedirectPath } from "@/lib/auth-routes"

export default function LoginPage() {
  const searchParams = useSearchParams()
  const nextQuery =
    sanitizeRedirectPath(searchParams.get("next")) === APP_HOME_PATH
      ? ""
      : `?next=${encodeURIComponent(sanitizeRedirectPath(searchParams.get("next")))}`
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (signInError) {
      setError(formatAuthError(signInError.message))
      setLoading(false)
      return
    }

    const nextPath = sanitizeRedirectPath(searchParams.get("next"))

    setLoading(false)
    window.location.assign(nextPath)
  }

  const showVerifyLink = error ? isEmailNotConfirmedError(error) : false

  return (
    <AuthPageFrame>
      <AuthShell
        compact
        title="Welcome back"
        subtitle="Sign in to your Vyronis command center"
      >
        <form onSubmit={handleLogin} className="space-y-4">
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

        <div className="space-y-2">
          <AuthField
            label="Password"
            icon={Lock}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
          <div className="flex justify-end">
            <Link
              href={`/auth/forgot-password${nextQuery}`}
              className="text-[11px] font-medium text-cyan-glow/90 transition-colors hover:text-cyan-glow hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {error && <AuthErrorBanner message={error} />}

        {showVerifyLink && (
          <Link
            href={getVerifyEmailPageUrl(email.trim())}
            className="block rounded-xl border border-cyan-glow/20 bg-cyan-glow/[0.06] px-3 py-2.5 text-center text-sm font-medium text-cyan-glow hover:bg-cyan-glow/[0.1]"
          >
            Resend verification email
          </Link>
        )}

        <AuthSubmitButton loading={loading} loadingLabel="Authenticating..." label="Access Dashboard" />
      </form>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href={`/auth/sign-up${nextQuery}`} className="font-medium text-cyan-glow hover:underline">
          Create Account
        </Link>
      </div>
      </AuthShell>
    </AuthPageFrame>
  )
}
