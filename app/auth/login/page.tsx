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
import { sanitizeRedirectPath } from "@/lib/auth-routes"

export default function LoginPage() {
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
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    const nextPath =
      typeof window !== "undefined"
        ? sanitizeRedirectPath(new URLSearchParams(window.location.search).get("next"))
        : "/"

    setLoading(false)
    // Full navigation so middleware receives auth cookies on Vercel (client router alone can bounce back to login).
    window.location.assign(nextPath)
  }

  return (
    <AuthShell title="Welcome Back" subtitle="Sign in to access your trading dashboard">
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
              href="/auth/forgot-password"
              className="text-[11px] font-medium text-cyan-glow/90 transition-colors hover:text-cyan-glow hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {error && <AuthErrorBanner message={error} />}

        <AuthSubmitButton loading={loading} loadingLabel="Authenticating..." label="Access Dashboard" />
      </form>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/auth/sign-up" className="font-medium text-cyan-glow hover:underline">
          Create Account
        </Link>
      </div>
    </AuthShell>
  )
}
