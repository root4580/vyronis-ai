"use client"

import { LogOut, Settings } from "lucide-react"
import {
  UserProfileCard,
  UserProfileCardEmptyHint,
  type UserProfileCardProps,
} from "@/components/dashboard/user-profile-card"

type DashboardUserBarProps = {
  profileCard: UserProfileCardProps
  showProfileEmptyHint?: boolean
  onOpenSettings: () => void
  onLogout: () => void
  isLoggingOut?: boolean
}

export function DashboardUserBar({
  profileCard,
  showProfileEmptyHint = false,
  onOpenSettings,
  onLogout,
  isLoggingOut = false,
}: DashboardUserBarProps) {
  return (
    <div className="dashboard-container px-4 pt-4 md:px-6 md:pt-5">
      <div className="dashboard-user-bar">
        <div className="min-w-0">
          <UserProfileCard {...profileCard} />
          {showProfileEmptyHint && <UserProfileCardEmptyHint />}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded-[10px] border border-transparent p-2 transition-all duration-200 hover:border-white/[0.06] hover:bg-white/[0.04] group"
            title="Account Settings"
          >
            <Settings className="size-4 text-muted-foreground transition-colors group-hover:text-cyan-glow" />
          </button>
          <button
            type="button"
            onClick={onLogout}
            disabled={isLoggingOut}
            className="rounded-[10px] border border-transparent p-2 transition-all duration-200 hover:border-loss/20 hover:bg-loss/[0.08] group"
            title="Logout"
          >
            {isLoggingOut ? (
              <div className="size-4 animate-spin rounded-full border-2 border-loss/30 border-t-loss" />
            ) : (
              <LogOut className="size-4 text-muted-foreground transition-colors group-hover:text-loss" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
