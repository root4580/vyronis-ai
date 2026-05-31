"use client"

import { AuthPageFrame } from "@/components/auth/auth-page-frame"
import { AuthShellSkeleton } from "@/components/auth/auth-shell-skeleton"

export function AuthLoadingState({
  title: _title,
  subtitle: _subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <AuthPageFrame>
      <AuthShellSkeleton />
    </AuthPageFrame>
  )
}
