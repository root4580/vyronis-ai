"use client"

import { useEffect } from "react"
import { Activity } from "lucide-react"
import { Toaster } from "@/components/ui/toaster"
import { redirectToLogin } from "@/lib/auth-sign-out"

export function SigningOutScreen() {
  useEffect(() => {
    const id = window.setTimeout(() => redirectToLogin(), 2500)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <div className="auth-page flex min-h-screen flex-col items-center justify-center gap-5 bg-background p-6">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(6,182,212,0.12),transparent_55%)]" />
      <div className="auth-grid-overlay absolute inset-0 opacity-[0.02]" />

      <div className="relative flex flex-col items-center gap-4 text-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-cyan-glow/20 blur-xl" />
          <div className="relative flex size-14 items-center justify-center rounded-2xl border border-cyan-glow/30 bg-gradient-to-br from-cyan-glow/20 to-cyan-glow/5 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
            <Activity className="size-6 animate-pulse text-cyan-glow" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="mx-auto size-5 animate-spin rounded-full border-2 border-cyan-glow/30 border-t-cyan-glow" />
          <p className="text-sm font-medium text-foreground">Signing out...</p>
          <p className="text-xs text-muted-foreground">Securing your session</p>
        </div>
      </div>

      <Toaster />
    </div>
  )
}
