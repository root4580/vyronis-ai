"use client"

import { useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowRight, Lock, Mail } from "lucide-react"
import {
  AuthErrorBanner,
  AuthField,
  AuthShell,
  AuthSubmitButton,
} from "@/components/auth/auth-shell"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"

export default function SignUpPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
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

    const redirectTo =
      process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
      `${window.location.origin}/auth/callback`

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.session?.user) {
      await ensureDefaultSettings(data.session.user.id)
      await ensureDefaultProfile(data.session.user.id)
      router.push("/")
      router.refresh()
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <AuthShell
        title="Check Your Email"
        subtitle="Confirm your email to activate your Vyronis AI account"
        accent="profit"
      >
        <div className="text-center">
          <p className="text-sm leading-relaxed text-muted-foreground">
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">{email}</span>.
          </p>
          <Link
            href="/auth/login"
            className="mt-6 inline-flex items-center gap-2 font-medium text-cyan-glow hover:underline"
          >
            <ArrowRight className="size-4 rotate-180" />
            Back to Login
          </Link>
        </div>
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
