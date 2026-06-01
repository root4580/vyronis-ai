"use client"

import { useState } from "react"
import { WarRoomHtfUpload } from "@/components/strategy-brain/war-room-htf-upload"
import { WarRoomPairCoachActions } from "@/components/journal/war-room-pair-coach-actions"
import { updatePairAoiStatus, saveWeeklyPlan } from "@/lib/strategy-brain/api-client"
import type { AoiStatus, BiasDirection, PairPlanRecord, WeeklyPlanWithPairs } from "@/lib/strategy-brain/types"
import { AoiStatusPill } from "@/components/strategy-brain/strategy-brain-primitives"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const STATUSES: AoiStatus[] = ["WAITING", "INSIDE_AOI", "CONFIRMING", "INVALIDATED"]

type Props = {
  plan: PairPlanRecord
  weekPlan: WeeklyPlanWithPairs
  weekStart: string
  sessionFocus: string
  expectedScenarios: string
  onUpdated: (plan: WeeklyPlanWithPairs) => void
  onBiasSuggest?: (bias: import("@/lib/strategy-brain/types").MarketBiasInput) => void
  onCoachEngaged?: () => void
}

function PairBiasReadonly({ bias }: { bias: BiasDirection }) {
  return (
    <span
      className={cn(
        "rounded-[var(--radius-sm)] border px-2 py-0.5 text-[11px] font-medium",
        bias === "Bullish"
          ? "border-profit/30 bg-profit/[0.12] text-profit"
          : bias === "Bearish"
            ? "border-loss/25 bg-loss/10 text-loss"
            : "border-[var(--border-default)] bg-white/[0.06] text-text-secondary",
      )}
    >
      {bias}
    </span>
  )
}

export function WarRoomPairCard({
  plan,
  weekPlan,
  weekStart,
  sessionFocus,
  expectedScenarios,
  onUpdated,
  onBiasSuggest,
  onCoachEngaged,
}: Props) {
  const { toast } = useToast()
  const [thesis, setThesis] = useState(plan.weekly_thesis)
  const [notes, setNotes] = useState(plan.notes)
  const [saving, setSaving] = useState(false)

  async function persistPair(patch: Partial<PairPlanRecord>) {
    setSaving(true)
    try {
      const updated = await saveWeeklyPlan({
        week_start: weekStart,
        session_notes: weekPlan.session_notes,
        session_focus: sessionFocus,
        expected_scenarios: expectedScenarios,
        pairs: weekPlan.pairs.map((p) =>
          p.id === plan.id
            ? {
                pair: p.pair,
                directional_bias: p.directional_bias,
                aoi_high: p.aoi_high,
                aoi_low: p.aoi_low,
                invalidation: p.invalidation,
                weekly_thesis: patch.weekly_thesis ?? p.weekly_thesis,
                notes: patch.notes ?? p.notes,
                aoi_status: patch.aoi_status ?? p.aoi_status,
                screenshot_urls: patch.screenshot_urls ?? p.screenshot_urls ?? [],
                sort_order: p.sort_order,
              }
            : {
                pair: p.pair,
                directional_bias: p.directional_bias,
                aoi_high: p.aoi_high,
                aoi_low: p.aoi_low,
                invalidation: p.invalidation,
                weekly_thesis: p.weekly_thesis,
                notes: p.notes,
                aoi_status: p.aoi_status,
                screenshot_urls: p.screenshot_urls ?? [],
                sort_order: p.sort_order,
              },
        ),
      })
      onUpdated(updated)
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  async function setStatus(status: AoiStatus) {
    await updatePairAoiStatus(plan.id, status)
    onUpdated({
      ...weekPlan,
      pairs: weekPlan.pairs.map((p) => (p.id === plan.id ? { ...p, aoi_status: status } : p)),
    })
  }

  return (
    <article className="px-3 py-3 sm:px-4 sm:py-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[14px] font-medium text-text-primary sm:text-[13px]">{plan.pair}</h3>
          <PairBiasReadonly bias={plan.directional_bias as BiasDirection} />
          <AoiStatusPill status={plan.aoi_status} />
        </div>
        <WarRoomPairCoachActions plan={plan} onCoachEngaged={onCoachEngaged} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
        <div>
          <p className="mb-1 text-[10px] text-text-muted">AOI low</p>
          <p className="war-room-input flex h-9 items-center font-mono text-[12px]">
            {plan.aoi_low ?? "—"}
          </p>
        </div>
        <div>
          <p className="mb-1 text-[10px] text-text-muted">AOI high</p>
          <p className="war-room-input flex h-9 items-center font-mono text-[12px]">
            {plan.aoi_high ?? "—"}
          </p>
        </div>
        <div>
          <p className="mb-1 text-[10px] text-text-muted">Invalidation</p>
          <p className="war-room-input flex h-9 items-center font-mono text-[12px]">
            {plan.invalidation ?? "—"}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-1 text-[10px] text-text-muted">Thesis</p>
        <Textarea
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          onBlur={() => {
            if (thesis !== plan.weekly_thesis) void persistPair({ weekly_thesis: thesis })
          }}
          placeholder="Why this pair matters this week…"
          className="war-room-textarea min-h-[64px] resize-none placeholder:text-text-muted"
        />
      </div>

      <div className="mt-2">
        <p className="mb-1 text-[10px] text-text-muted">Execution notes</p>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notes !== plan.notes) void persistPair({ notes })
          }}
          placeholder="LTF triggers, news, invalidation cues…"
          className="war-room-textarea min-h-[48px] resize-none placeholder:text-text-muted"
        />
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-[10px] text-text-muted">AOI status</p>
        <div className="flex flex-wrap gap-1.5 sm:gap-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void setStatus(s)}
              className={cn(
                "min-h-9 rounded-[var(--radius-sm)] border px-2.5 py-2 text-[11px] transition-colors sm:min-h-0 sm:py-1 sm:text-[10px]",
                plan.aoi_status === s
                  ? "border-[var(--color-accent-border)] bg-[var(--color-accent-bg)] text-text-accent"
                  : "border-[var(--border-subtle)] bg-transparent text-text-muted hover:border-[var(--border-default)]",
              )}
            >
              {s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      <WarRoomHtfUpload
        className="mt-3"
        pairHint={plan.pair}
        pairLabel={plan.pair}
        urls={plan.screenshot_urls ?? []}
        disabled={saving}
        onUrlsChange={(screenshot_urls) => void persistPair({ screenshot_urls })}
        onBiasSuggest={onBiasSuggest}
        onAutofill={(autofill) =>
          void persistPair({
            pair: autofill.pair || plan.pair,
            directional_bias: autofill.directional_bias,
            aoi_low: autofill.aoi_low,
            aoi_high: autofill.aoi_high,
            invalidation: autofill.invalidation,
            weekly_thesis: autofill.weekly_thesis || plan.weekly_thesis,
            notes: autofill.notes || plan.notes,
          })
        }
      />
    </article>
  )
}
