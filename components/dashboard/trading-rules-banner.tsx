"use client"

import Link from "next/link"
import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { TradingRulesSnapshot } from "@/lib/trading-rules/types"
import { getPracticeRoomHref } from "@/lib/dashboard-nav"
import { cn } from "@/lib/utils"

type TradingRulesBannerProps = {
  snapshot: TradingRulesSnapshot | null
  onRunCooldownCoach?: () => void
  className?: string
}

export function TradingRulesBanner({
  snapshot,
  onRunCooldownCoach,
  className,
}: TradingRulesBannerProps) {
  if (!snapshot) return null

  if (snapshot.cooldownRequired) {
    return (
      <div
        className={cn(
          "border-b border-loss/40 bg-loss/[0.14] px-3 py-2.5 md:px-6",
          className,
        )}
        role="alert"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[12px] font-medium leading-snug text-loss">
              Real trading locked — {snapshot.lossStreak} consecutive loss
              {snapshot.lossStreak === 1 ? "" : "es"} this week. Run Cooldown Coach to unlock live
              trading.
            </p>
            <p className="mt-0.5 text-[11px] text-loss/85">
              Practice your setups here instead. Paper trading stays available during cooldown.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 border-violet-400/35 bg-violet-500/[0.08] text-violet-100 hover:bg-violet-500/[0.14]"
              asChild
            >
              <Link href={getPracticeRoomHref()}>Open Practice Room</Link>
            </Button>
            {onRunCooldownCoach ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 border-loss/35 bg-loss/[0.08] text-loss hover:bg-loss/[0.14]"
                onClick={onRunCooldownCoach}
              >
                Run Cooldown Coach
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  if (snapshot.weeklyLimitReached) {
    return (
      <div
        className={cn(
          "border-b border-warning/35 bg-warning/[0.1] px-3 py-2.5 md:px-6",
          className,
        )}
        role="alert"
      >
        <div className="mx-auto flex max-w-7xl items-center gap-2">
          <ShieldAlert className="size-4 shrink-0 text-warning-muted" />
          <p className="text-[12px] font-medium text-warning-muted">
            Weekly trade limit reached. Come back next week.
          </p>
        </div>
      </div>
    )
  }

  return null
}
