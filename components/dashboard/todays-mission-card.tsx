"use client"

import { useMemo } from "react"
import { CheckCircle2, Circle, Target } from "lucide-react"
import { buildTodaysMission } from "@/lib/todays-mission"
import type { SettingsTrade, UserSettingsForm } from "@/lib/user-settings"
import { cn } from "@/lib/utils"

type TodaysMissionCardProps = {
  settings: UserSettingsForm
  trades: SettingsTrade[]
  className?: string
}

export function TodaysMissionCard({ settings, trades, className }: TodaysMissionCardProps) {
  const items = useMemo(() => buildTodaysMission(settings, trades), [settings, trades])
  const completedCount = items.filter((item) => item.checked).length

  return (
    <section
      aria-label="Today's Mission"
      className={cn(
        "relative overflow-hidden rounded-2xl border border-cyan-glow/20 bg-gradient-to-br from-cyan-glow/[0.08] via-white/[0.02] to-profit/[0.04] p-4 shadow-[0_0_40px_rgb(from_var(--color-accent)_r_g_b_/_0.08)] sm:p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl border border-cyan-glow/25 bg-cyan-glow/[0.1]">
            <Target className="size-4 text-cyan-glow" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-glow/85">
              Today&apos;s Mission
            </p>
            <p className="mt-0.5 text-[13px] text-muted-foreground/80">
              Your daily trading checklist — verified from journal data when trades are logged.
            </p>
          </div>
        </div>
        <span className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-[10px] font-medium tabular-nums text-foreground/85">
          {completedCount}/{items.length}
        </span>
      </div>

      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[12px]",
              item.checked
                ? "border-profit/20 bg-profit/[0.05] text-foreground/90"
                : "border-white/[0.06] bg-black/15 text-muted-foreground/85",
            )}
          >
            {item.checked ? (
              <CheckCircle2 className="size-4 shrink-0 text-profit" aria-hidden />
            ) : (
              <Circle className="size-4 shrink-0 text-muted-foreground/45" aria-hidden />
            )}
            <span className="leading-snug">{item.label}</span>
            {!item.verifiable && item.id !== "max-trades" ? (
              <span className="ml-auto text-[10px] text-muted-foreground/55">Pending</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
