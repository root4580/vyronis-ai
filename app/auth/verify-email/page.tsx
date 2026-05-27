"use client"

import { Suspense, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Mail } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  AuthErrorBanner,
  AuthField,
  AuthShell,
  AuthSubmitButton,
} from "@/components/auth/auth-shell"
import { AuthEmailSentPanel } from "@/components/auth/auth-email-sent-panel"
import { formatAuthError } from "@/lib/auth-errors"
import { getSignupEmailRedirectUrl } from "@/lib/auth-email"

const RESEND_KEY_PREFIX = "vyronis-auth-signup-sent:"

function VerifyEmailForm() {
  const searchParams = useSearchParams()
  const initialEmail = searchParams.get("email") ?? ""

  const [email, setEmail] = useState(initialEmail)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  async function resendVerification(targetEmail: string) {
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: targetEmail,
      options: {
        emailRedirectTo: getSignupEmailRedirectUrl(),
      },
    })

    if (resendError) {
      return { error: formatAuthError(resendError.message) }
    }

    return { error: null }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const trimmed = email.trim()
    if (!trimmed) {
      setError("Enter the email you used to sign up.")
      setLoading(false)
      return
    }

    const result = await resendVerification(trimmed)
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
      <AuthShell
        title="Verification Sent"
        subtitle="Check your inbox to activate your Vyronis AI account"
        accent="profit"
      >
        <AuthEmailSentPanel
          email={trimmed}
          title="Verification email sent"
          description="Click the link in your email to confirm your account, then sign in."
          resendLabel="Resend verification email"
          resendStorageKey={`${RESEND_KEY_PREFIX}${trimmed}`}
          onResend={() => resendVerification(trimmed)}
        />
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Verify Your Email"
      subtitle="Resend the confirmation link for your Vyronis AI account"
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
          loadingLabel="Sending…"
          label="Resend Verification Email"
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

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  )
}
