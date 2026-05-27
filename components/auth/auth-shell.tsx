"use client"

import Link from "next/link"
import { Activity, Zap } from "lucide-react"
import type { ReactNode } from "react"

type AuthShellProps = {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
  accent?: "cyan" | "profit" | "loss"
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  accent = "cyan",
}: AuthShellProps) {
  const accentBorder =
    accent === "profit"
      ? "from-profit/50 via-profit/20 to-profit/50"
      : accent === "loss"
        ? "from-loss/50 via-loss/20 to-loss/50"
        : "from-cyan-glow/50 via-cyan-glow/20 to-cyan-glow/50"

  return (
    <div className="auth-page min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(6,182,212,0.12),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(34,211,238,0.06),transparent_50%)]" />
      <div className="auth-grid-overlay absolute inset-0 opacity-[0.02]" />

      <div className="auth-page-panel w-full max-w-md relative">
        <div className="text-center mb-8">
          <Link href="/auth/login" className="inline-flex items-center gap-3 mb-4 group">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-glow/20 blur-xl rounded-full transition-opacity group-hover:opacity-100" />
              <div className="relative flex size-12 items-center justify-center rounded-xl border border-cyan-glow/30 bg-gradient-to-br from-cyan-glow/20 to-cyan-glow/5 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
                <Activity className="size-6 text-cyan-glow" />
              </div>
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Vyronis AI</h1>
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-glow">
                <Zap className="size-3" />
                Trading Intelligence
              </p>
            </div>
          </Link>
        </div>

        <div className="relative">
          <div className={`absolute -inset-[1px] bg-gradient-to-r ${accentBorder} rounded-2xl blur-sm`} />
          <div className="auth-card relative rounded-2xl border border-white/[0.08] bg-card/85 p-8 backdrop-blur-xl">
            <div className="mb-6 text-center">
              <h2 className="text-xl font-semibold text-foreground">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground/80">{subtitle}</p>
            </div>
            {children}
          </div>
        </div>

        {footer ?? (
          <p className="mt-6 text-center text-xs text-muted-foreground/70">
            Secure cloud sync · Per-user data isolation · Supabase Auth
          </p>
        )}
      </div>
    </div>
  )
}

export function AuthErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-loss/30 bg-loss/[0.08] px-3 py-2.5 text-sm text-loss">
      {message}
    </div>
  )
}

export function AuthSuccessBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-profit/30 bg-profit/[0.08] px-3 py-2.5 text-sm text-profit">
      {message}
    </div>
  )
}

export function AuthSubmitButton({
  loading,
  loadingLabel,
  label,
}: {
  loading: boolean
  loadingLabel: string
  label: string
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="auth-submit-btn group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-glow to-cyan-glow/80 py-3 font-semibold text-background transition-all hover:shadow-[0_0_24px_rgba(34,211,238,0.25)] disabled:opacity-50"
    >
      {loading ? (
        <>
          <span className="size-4 animate-spin rounded-full border-2 border-background/30 border-t-background" />
          {loadingLabel}
        </>
      ) : (
        label
      )}
    </button>
  )
}

export function AuthField({
  label,
  icon: Icon,
  ...props
}: {
  label: string
  icon: typeof Activity
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground/80">
        {label}
      </label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
        <input
          {...props}
          className="auth-input w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-3 pl-10 pr-4 text-foreground placeholder:text-muted-foreground/45 transition-all focus:border-cyan-glow/40 focus:outline-none focus:ring-2 focus:ring-cyan-glow/15"
        />
      </div>
    </div>
  )
}
