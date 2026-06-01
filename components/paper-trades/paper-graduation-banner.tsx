"use client"

import Link from "next/link"
import { GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { APP_HOME_PATH } from "@/lib/branding"
import { getWarRoomHref } from "@/lib/dashboard-nav"
import { cn } from "@/lib/utils"

type PaperGraduationBannerProps = {
  winStreak: number
  className?: string
  /** HQ card vs Practice Room — same CTA, slightly different copy density. */
  variant?: "hq" | "practice"
}

export function PaperGraduationBanner({
  winStreak,
  className,
  variant = "practice",
}: PaperGraduationBannerProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border border-profit/30 bg-profit/[0.08] px-4 py-3.5",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <GraduationCap className="mt-0.5 size-5 shrink-0 text-profit" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-profit">🎓 Setup proven — ready to go live?</p>
          <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">
            {winStreak} winning paper trade{winStreak === 1 ? "" : "s"} in a row. Your process held on
            paper — run War Room Coach, then log live when your rules allow.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button
              asChild
              size="sm"
              className="min-h-10 flex-1 bg-profit text-[12px] font-semibold text-[var(--surface-page)] hover:bg-profit/90"
            >
              <Link href={getWarRoomHref()}>Open War Room →</Link>
            </Button>
            {variant === "practice" ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="min-h-10 flex-1 border-profit/30 text-[12px] text-profit hover:bg-profit/[0.08]"
              >
                <Link href={`${APP_HOME_PATH}?action=new-trade`}>Log live trade →</Link>
              </Button>
            ) : (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="min-h-10 flex-1 border-profit/30 text-[12px] text-profit hover:bg-profit/[0.08]"
              >
                <Link href="/practice-room">Review paper setups →</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
