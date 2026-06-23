"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Mail } from "lucide-react"
import {
  AuthErrorBanner,
  AuthField,
  AuthShell,
  AuthSubmitButton,
} from "@/components/auth/auth-shell"
import { AuthEmailSentPanel } from "@/components/auth/auth-email-sent-panel"

const RESEND_KEY_PREFIX = "vyronis-auth-signup-sent:"

async function sendConfirmationViaApi(email: string) {
  const res = await fetch("/api/auth/send-confirmation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  })
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
  if (!body.ok) {
    return { error: body.error ?? "Could not send confirmation email." }
  }
  return { error: null }
}

function VerifyEmailForm() {
  const searchParams = useSearchParams()
  const initialEmail = searchParams.get("email") ?? ""

  const [email, setEmail] = useState(initialEmail)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function resendVerification(targetEmail: string) {
    return sendConfirmationViaApi(targetEmail)
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
        subtitle="Check your inbox to activate your Vyronis HQ account"
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
      subtitle="Resend the confirmation link for your Vyronis HQ account"
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
