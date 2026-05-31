"use client"

import { AuthMarketingPanel } from "@/components/auth/auth-marketing-panel"
import { AuthShellSkeleton } from "@/components/auth/auth-shell-skeleton"

export function AuthPageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-page-frame flex min-h-[100dvh] bg-background">
      <AuthMarketingPanel />
      <div className="flex flex-1 items-center justify-center px-4 py-6 sm:p-6">{children}</div>
    </div>
  )
}

export function AuthPageSuspenseFallback() {
  return (
    <AuthPageFrame>
      <AuthShellSkeleton />
    </AuthPageFrame>
  )
}
