"use client"

import Link from "next/link"
import { ChevronRight, UserRound } from "lucide-react"
import { getProfileDisplayName, getProfileInitials, getProfileSubtitle } from "@/lib/user-profile"

export type UserProfileCardProps = {
  displayName: string
  subtitle: string
  initials: string
  isLoading?: boolean
}

export function UserProfileCardSkeleton() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="skeleton-shimmer size-9 shrink-0 rounded-[10px]" />
      <div className="min-w-0 space-y-2">
        <div className="skeleton-shimmer h-3.5 w-32 rounded-md" />
        <div className="skeleton-shimmer h-2.5 w-24 rounded-md" />
      </div>
    </div>
  )
}

export function UserProfileCard({
  displayName,
  subtitle,
  initials,
  isLoading = false,
}: UserProfileCardProps) {
  if (isLoading) {
    return <UserProfileCardSkeleton />
  }

  return (
    <Link
      href="/profile"
      className="group flex min-w-0 items-center gap-3 rounded-[12px] border border-transparent px-1 py-0.5 transition-all hover:border-cyan-glow/15 hover:bg-cyan-glow/[0.04]"
      title="Edit profile"
    >
      <div className="relative flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-cyan-glow/20 bg-gradient-to-br from-cyan-glow/[0.12] to-cyan-glow/[0.04] shadow-[0_0_16px_rgba(34,211,238,0.08)]">
        <span className="text-[11px] font-semibold tracking-wide text-cyan-glow">{initials}</span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold tracking-tight text-foreground transition-colors group-hover:text-cyan-glow">
          {displayName}
        </p>
        <p className="truncate text-[11px] text-muted-foreground/70">{subtitle}</p>
      </div>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-cyan-glow/80" />
    </Link>
  )
}

export function buildUserProfileCardProps(options: {
  profile: { first_name: string; last_name: string } | null
  email?: string | null
  propFirmSize?: string | null
  isLoading?: boolean
}): UserProfileCardProps {
  const profile = options.profile
  return {
    displayName: getProfileDisplayName(profile, options.email),
    subtitle: getProfileSubtitle(options.propFirmSize),
    initials: getProfileInitials(profile, options.email),
    isLoading: options.isLoading,
  }
}

export function UserProfileCardEmptyHint() {
  return (
    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
      <UserRound className="size-3" />
      <span>Add your name in Profile Settings</span>
    </div>
  )
}
