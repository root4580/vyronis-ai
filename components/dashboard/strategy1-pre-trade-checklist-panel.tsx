"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, ChevronDown, Circle, ClipboardCheck, XCircle } from "lucide-react"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { VyronisGradeBadge } from "@/components/dashboard/vyronis-grade-badge"
import type { TradeFormState } from "@/lib/trade-form-config"
import {
  DEFAULT_STRATEGY1_MANUAL_CHECKS,
  evaluateStrategy1PlusChecklist,
  type Strategy1ManualChecks,
} from "@/lib/strategy/strategy1-plus-checklist"
import { cn } from "@/lib/utils"

type Strategy1PreTradeChecklistPanelProps = {
  form: TradeFormState
  riskReward: number | null
  defaultOpen?: boolean
}

function StatusIcon({ status }: { status: "pass" | "fail" | "warn" | "pending" }) {
  if (status === "pass") return <CheckCircle2 className="size-3.5 shrink-0 text-profit" />
  if (status === "fail") return <XCircle className="size-3.5 shrink-0 text-loss" />
  return <Circle className="size-3.5 shrink-0 text-muted-foreground/50" />
}

export function Strategy1PreTradeChecklistPanel({
  form,
  riskReward,
  defaultOpen = false,
}: Strategy1PreTradeChecklistPanelProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [manual, setManual] = useState<Strategy1ManualChecks>(DEFAULT_STRATEGY1_MANUAL_CHECKS)

  const result = useMemo(
    () => evaluateStrategy1PlusChecklist(form, riskReward, manual),
    [form, riskReward, manual],
  )

  const toggleManual = (key: keyof Strategy1ManualChecks) => {
    setManual((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <DashboardInsetPanel className="overflow-hidden border-white/[0.08] p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left sm:px-4"
      >
        <div className="flex min-w-0 items-center gap-2">
          <ClipboardCheck className="size-4 shrink-0 text-cyan-glow" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground/90">
              A+ Setup Gate
            </p>
            <p className="truncate text-[10px] text-muted-foreground/70">
              Pre-flight checklist · maps to Vyronis journal fields
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <VyronisGradeBadge grade={result.grade} size="sm" />
          <ChevronDown
            className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </div>
      </button>

      {open && (
        <div className="space-y-3 border-t border-white/[0.06] px-3 pb-3 sm:px-4 sm:pb-4">
          <p className="pt-3 text-[11px] leading-relaxed text-muted-foreground/85">{result.summary}</p>

          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 tabular-nums">
              {result.passCount}/{result.items.length} passed
            </span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 font-medium",
                result.tradeLive
                  ? "border-profit/30 bg-profit/[0.08] text-profit"
                  : "border-warning/30 bg-warning/[0.08] text-warning-muted",
              )}
            >
              {result.tradeLive ? "OK to trade live" : "Skip on live account"}
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">
              Chart confirms — check when you see it
            </p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {(
                [
                  ["liquiditySwept", "Liquidity swept before setup"],
                  ["displacementSeen", "Displacement after sweep"],
                  ["retestEntry", "Retest entry (not chase)"],
                  ["inKillZone", "In kill zone right now"],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-[10px] text-foreground/85"
                >
                  <input
                    type="checkbox"
                    checked={manual[key]}
                    onChange={() => toggleManual(key)}
                    className="size-3.5 rounded border-white/20 accent-cyan-glow"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <ol className="space-y-2">
            {result.items.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "rounded-lg border px-2.5 py-2 sm:px-3",
                  item.status === "pass" && "border-profit/15 bg-profit/[0.04]",
                  item.status === "fail" && "border-loss/20 bg-loss/[0.04]",
                  item.status === "warn" && "border-warning/20 bg-warning/[0.04]",
                  item.status === "pending" && "border-white/[0.06] bg-white/[0.02]",
                )}
              >
                <div className="flex items-start gap-2">
                  <StatusIcon status={item.status} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-foreground/90">
                      {item.step}. {item.title}
                      {item.strategy2Steal && (
                        <span className="ml-1 text-[9px] font-normal uppercase text-cyan-glow/70">
                          · S2
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground/75">{item.rule}</p>
                    <p className="mt-1 text-[9px] text-muted-foreground/55">
                      Journal: {item.vyronisFields.join(", ")}
                    </p>
                    {item.hint && (
                      <p className="mt-1 text-[10px] text-warning-muted/90">{item.hint}</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {result.improvement && (
            <div className="rounded-lg border border-cyan-glow/20 bg-cyan-glow/[0.05] px-3 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-cyan-glow/80">
                One fix before next trade
              </p>
              <p className="mt-1 text-[11px] text-foreground/85">{result.improvement}</p>
            </div>
          )}
        </div>
      )}
    </DashboardInsetPanel>
  )
}
