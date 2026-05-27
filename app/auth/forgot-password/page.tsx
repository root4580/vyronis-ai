"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Mail } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getPasswordResetRedirectUrl } from "@/lib/auth-reset"
import {
  AuthErrorBanner,
  AuthField,
  AuthShell,
  AuthSubmitButton,
  AuthSuccessBanner,
} from "@/components/auth/auth-shell"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const trimmed = email.trim()
    if (!trimmed) {
      setError("Enter the email address for your account.")
      setLoading(false)
      return
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: getPasswordResetRedirectUrl(),
    })

    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <AuthShell
        title="Check Your Email"
        subtitle="If an account exists, we sent a password reset link"
        accent="profit"
      >
        <div className="space-y-4 text-center">
          <AuthSuccessBanner
            message={`Reset instructions were sent to ${email.trim()}. The link expires in about one hour.`}
          />
          <p className="text-sm leading-relaxed text-muted-foreground/80">
            Open the link on this device to set a new password. Check spam if you do not see it within a few minutes.
          </p>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-cyan-glow hover:underline"
          >
            <ArrowLeft className="size-4" />
            Back to Login
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Reset Password"
      subtitle="Enter your email and we will send a secure reset link"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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

        {error && <AuthErrorBanner message={error} />}

        <AuthSubmitButton
          loading={loading}
          loadingLabel="Sending link..."
          label="Send Reset Link"
        />
      </form>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/auth/login" className="inline-flex items-center gap-1.5 font-medium text-cyan-glow hover:underline">
          <ArrowLeft className="size-3.5" />
          Back to Login
        </Link>
      </div>
    </AuthShell>
  )
}
