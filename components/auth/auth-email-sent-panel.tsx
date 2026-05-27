"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Mail, RefreshCw } from "lucide-react"
import { AUTH_RESEND_COOLDOWN_MS, getResendCooldown } from "@/lib/auth-email"
import { AuthErrorBanner, AuthSuccessBanner } from "@/components/auth/auth-shell"

type AuthEmailSentPanelProps = {
  email: string
  title: string
  description: string
  resendLabel: string
  resendStorageKey: string
  resendSuccessMessage?: string
  onResend: () => Promise<{ error: string | null }>
  backHref?: string
  backLabel?: string
}

export function AuthEmailSentPanel({
  email,
  title,
  description,
  resendLabel,
  resendStorageKey,
  resendSuccessMessage = "Verification email sent again.",
  onResend,
  backHref = "/auth/login",
  backLabel = "Back to Login",
}: AuthEmailSentPanelProps) {
  const [resendError, setResendError] = useState<string | null>(null)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? window.localStorage.getItem(resendStorageKey) : null
    const lastSent = stored ? Number(stored) : null
    const initial = getResendCooldown(Number.isFinite(lastSent) ? lastSent : null)
    setCooldownSeconds(initial.secondsRemaining)
  }, [resendStorageKey])

  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const timer = window.setInterval(() => {
      const stored = window.localStorage.getItem(resendStorageKey)
      const lastSent = stored ? Number(stored) : null
      const { secondsRemaining } = getResendCooldown(Number.isFinite(lastSent) ? lastSent : null)
      setCooldownSeconds(secondsRemaining)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [cooldownSeconds, resendStorageKey])

  async function handleResend() {
    setResendError(null)
    setResendSuccess(false)
    setResending(true)

    const stored = window.localStorage.getItem(resendStorageKey)
    const lastSent = stored ? Number(stored) : null
    const { allowed, secondsRemaining } = getResendCooldown(
      Number.isFinite(lastSent) ? lastSent : null,
    )

    if (!allowed) {
      setCooldownSeconds(secondsRemaining)
      setResending(false)
      return
    }

    const { error } = await onResend()
    setResending(false)

    if (error) {
      setResendError(error)
      return
    }

    window.localStorage.setItem(resendStorageKey, String(Date.now()))
    setCooldownSeconds(Math.ceil(AUTH_RESEND_COOLDOWN_MS / 1000))
    setResendSuccess(true)
  }

  return (
    <div className="space-y-4 text-center">
      <AuthSuccessBanner message={title} />
      <p className="text-sm leading-relaxed text-muted-foreground/80">{description}</p>
      <p className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-foreground">
        <Mail className="size-4 shrink-0 text-cyan-glow/80" />
        <span className="truncate">{email}</span>
      </p>
      <p className="text-[11px] leading-relaxed text-muted-foreground/65">
        Check spam and promotions. Delivery can take up to 5 minutes.
      </p>

      {resendError && <AuthErrorBanner message={resendError} />}
      {resendSuccess && (
        <p className="text-xs text-profit">{resendSuccessMessage}</p>
      )}

      <button
        type="button"
        onClick={() => void handleResend()}
        disabled={resending || cooldownSeconds > 0}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-glow/25 bg-cyan-glow/[0.06] px-4 py-3 text-sm font-medium text-cyan-glow transition-colors hover:bg-cyan-glow/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {resending ? (
          <>
            <span className="size-4 animate-spin rounded-full border-2 border-cyan-glow/30 border-t-cyan-glow" />
            Sending…
          </>
        ) : cooldownSeconds > 0 ? (
          <>Resend available in {cooldownSeconds}s</>
        ) : (
          <>
            <RefreshCw className="size-4" />
            {resendLabel}
          </>
        )}
      </button>

      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm font-medium text-cyan-glow hover:underline"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>
    </div>
  )
}
