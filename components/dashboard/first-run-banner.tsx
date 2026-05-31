"use client"

import Link from "next/link"
import { BookOpen, Crosshair, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { APP_HOME_PATH } from "@/lib/branding"

type FirstRunBannerProps = {
  onLogTrade: () => void
  onOpenWarRoom: () => void
}

export function FirstRunBanner({ onLogTrade, onOpenWarRoom }: FirstRunBannerProps) {
  return (
    <DashboardInsetPanel className="border-cyan-glow/20 bg-gradient-to-br from-cyan-glow/[0.06] via-transparent to-profit/[0.04] px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-cyan-glow" />
            <p className="text-sm font-semibold text-foreground/90">Welcome to Vyronis HQ</p>
          </div>
          <p className="max-w-xl text-[12px] leading-relaxed text-muted-foreground/80">
            Your dashboard stays empty until you log a trade. Plan in War Room, execute, then journal —
            analytics and coaching build from real entries only.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/[0.08]"
            onClick={onOpenWarRoom}
          >
            <Crosshair className="mr-1.5 size-3.5" />
            Open War Room
          </Button>
          <Button type="button" size="sm" className="btn-primary" onClick={onLogTrade}>
            <BookOpen className="mr-1.5 size-3.5" />
            Log first trade
          </Button>
          <Link
            href={`${APP_HOME_PATH}?tab=journal`}
            className="text-[11px] font-medium text-cyan-glow/85 hover:text-cyan-glow"
          >
            See journal →
          </Link>
        </div>
      </div>
    </DashboardInsetPanel>
  )
}
