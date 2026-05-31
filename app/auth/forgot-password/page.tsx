"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Mail } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getPasswordResetRedirectUrl } from "@/lib/auth-email"
import { AuthPageFrame } from "@/components/auth/auth-page-frame"
import {
  AuthErrorBanner,
  AuthField,
  AuthShell,
  AuthSubmitButton,
} from "@/components/auth/auth-shell"
import { AuthEmailSentPanel } from "@/components/auth/auth-email-sent-panel"
import { formatAuthError } from "@/lib/auth-errors"

const RESEND_KEY_PREFIX = "vyronis-auth-reset-sent:"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  async function sendResetEmail(targetEmail: string) {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: getPasswordResetRedirectUrl(),
    })

    if (resetError) {
      return { error: formatAuthError(resetError.message) }
    }

    return { error: null }
  }

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

    const result = await sendResetEmail(trimmed)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    window.localStorage.setItem(`${RESEND_KEY_PREFIX}${trimmed}`, String(Date.now()))
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    const trimmed = email.trim()
    return (
      <AuthPageFrame>
        <AuthShell
          compact
          title="Check Your Email"
          subtitle="If an account exists, we sent a password reset link"
          accent="profit"
        >
          <AuthEmailSentPanel
            email={trimmed}
            title="Password reset email sent"
            description="Open the link on this device to set a new password. The link expires in about one hour."
            resendLabel="Resend reset link"
            resendSuccessMessage="Password reset email sent again."
            resendStorageKey={`${RESEND_KEY_PREFIX}${trimmed}`}
            onResend={() => sendResetEmail(trimmed)}
          />
        </AuthShell>
      </AuthPageFrame>
    )
  }

  return (
    <AuthPageFrame>
      <AuthShell
        compact
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
    </AuthPageFrame>
  )
}
