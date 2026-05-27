"use client"

import { AuthShell } from "@/components/auth/auth-shell"

export function AuthLoadingState({
  title,
  subtitle = "Please wait…",
}: {
  title: string
  subtitle?: string
}) {
  return (
    <AuthShell title={title} subtitle={subtitle}>
      <div className="flex flex-col items-center gap-3 py-6" role="status" aria-live="polite">
        <span className="size-8 animate-spin rounded-full border-2 border-cyan-glow/30 border-t-cyan-glow" />
        <p className="text-sm text-muted-foreground/80">{subtitle}</p>
      </div>
    </AuthShell>
  )
}
