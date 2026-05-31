"use client"

import { Check, ChevronDown, Link2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import type { MatchableTradePlan } from "@/lib/trade-planner/plan-match"
import { cn } from "@/lib/utils"

type PlanMatchPromptProps = {
  pair: string
  matchedPlans: MatchableTradePlan[]
  selectedPlanId: string | null
  dismissed: boolean
  manualOpen: boolean
  onManualOpenChange: (open: boolean) => void
  onConfirm: (plan: MatchableTradePlan) => void
  onDismiss: () => void
  onSkip: () => void
  onSelectPlan: (plan: MatchableTradePlan) => void
  onClearSelection: () => void
  className?: string
}

export function PlanMatchPrompt({
  pair,
  matchedPlans,
  selectedPlanId,
  dismissed,
  manualOpen,
  onManualOpenChange,
  onConfirm,
  onDismiss,
  onSkip,
  onSelectPlan,
  onClearSelection,
  className,
}: PlanMatchPromptProps) {
  const singleMatch = matchedPlans.length === 1 ? matchedPlans[0] : null
  const selectedPlan = matchedPlans.find((plan) => plan.id === selectedPlanId) ?? null
  const showAutoPrompt = !dismissed && matchedPlans.length > 0 && !selectedPlanId

  return (
    <div className={cn("space-y-2", className)}>
      {showAutoPrompt && singleMatch ? (
        <DashboardInsetPanel className="border-cyan-glow/25 bg-cyan-glow/[0.06] px-3 py-3">
          <div className="flex items-start gap-2">
            <Link2 className="mt-0.5 size-4 shrink-0 text-cyan-glow" />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-[12px] font-medium text-foreground/90">
                Did this trade follow your {pair} plan?
              </p>
              <p className="text-[11px] leading-relaxed text-muted-foreground/75">
                Planned {singleMatch.direction} · entry {singleMatch.entryPrice} · SL{" "}
                {singleMatch.stopLoss}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 bg-cyan-glow text-black hover:bg-cyan-glow/90"
                  onClick={() => onConfirm(singleMatch)}
                >
                  <Check className="mr-1.5 size-3.5" />
                  Yes, link plan
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 border-white/[0.08] bg-white/[0.03]"
                  onClick={onDismiss}
                >
                  Dismiss
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-muted-foreground"
                  onClick={onSkip}
                >
                  No plan
                </Button>
              </div>
            </div>
          </div>
        </DashboardInsetPanel>
      ) : null}

      {showAutoPrompt && matchedPlans.length > 1 ? (
        <DashboardInsetPanel className="border-cyan-glow/25 bg-cyan-glow/[0.06] px-3 py-3">
          <div className="space-y-2">
            <p className="text-[12px] font-medium text-foreground/90">
              Multiple {pair} plans today — pick one to link
            </p>
            <div className="space-y-1.5">
              {matchedPlans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => onSelectPlan(plan)}
                  className="flex w-full items-center justify-between rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-left transition-colors hover:border-cyan-glow/30 hover:bg-cyan-glow/[0.05]"
                >
                  <span className="text-[11px] text-foreground/90">
                    {plan.direction} · entry {plan.entryPrice}
                  </span>
                  <span className="text-[10px] tabular-nums text-muted-foreground/70">
                    {new Date(plan.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </button>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-muted-foreground"
              onClick={onSkip}
            >
              Skip linking
            </Button>
          </div>
        </DashboardInsetPanel>
      ) : null}

      {selectedPlan ? (
        <DashboardInsetPanel className="border-profit/20 bg-profit/[0.06] px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-medium text-foreground/90">
                Linked to {selectedPlan.pair} plan
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                {selectedPlan.direction} · planned entry {selectedPlan.entryPrice}
              </p>
            </div>
            <button
              type="button"
              onClick={onClearSelection}
              className="rounded-md p-1 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
              aria-label="Remove plan link"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </DashboardInsetPanel>
      ) : null}

      {!showAutoPrompt && !selectedPlan ? (
        <div>
          <button
            type="button"
            onClick={() => onManualOpenChange(!manualOpen)}
            className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left text-[11px] text-muted-foreground/80 hover:border-white/[0.1] hover:bg-white/[0.04]"
          >
            <span className="flex items-center gap-2">
              <Link2 className="size-3.5 text-cyan-glow/80" />
              Link a plan (optional)
            </span>
            <ChevronDown
              className={cn("size-4 transition-transform", manualOpen ? "rotate-180" : "")}
            />
          </button>
          {manualOpen ? (
            <div className="mt-2 space-y-1.5">
              {matchedPlans.length === 0 ? (
                <p className="px-1 text-[11px] text-muted-foreground/70">
                  No active {pair} plans for this date.
                </p>
              ) : (
                matchedPlans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => onSelectPlan(plan)}
                    className="flex w-full items-center justify-between rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-left transition-colors hover:border-cyan-glow/30 hover:bg-cyan-glow/[0.05]"
                  >
                    <span className="text-[11px] text-foreground/90">
                      {plan.direction} · entry {plan.entryPrice}
                    </span>
                    <span className="text-[10px] tabular-nums text-muted-foreground/70">
                      {new Date(plan.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
