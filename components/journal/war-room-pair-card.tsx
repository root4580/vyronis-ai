"use client"

import { useState } from "react"
import Link from "next/link"
import { Target } from "lucide-react"
import { WarRoomHtfUpload } from "@/components/strategy-brain/war-room-htf-upload"
import { updatePairAoiStatus, saveWeeklyPlan } from "@/lib/strategy-brain/api-client"
import type { AoiStatus, BiasDirection, PairPlanRecord, WeeklyPlanWithPairs } from "@/lib/strategy-brain/types"
import { AoiStatusPill, SectionLabel } from "@/components/strategy-brain/strategy-brain-primitives"
import { Button } from "@/components/ui/button"
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
}

export function WarRoomPairCard({
  plan,
  weekPlan,
  weekStart,
  sessionFocus,
  expectedScenarios,
  onUpdated,
  onBiasSuggest,
}: Props) {
  const { toast } = useToast()
  const [thesis, setThesis] = useState(plan.weekly_thesis)
  const [notes, setNotes] = useState(plan.notes)
  const [saving, setSaving] = useState(false)

  const zone =
    plan.aoi_high != null && plan.aoi_low != null
      ? `${plan.aoi_low} – ${plan.aoi_high}`
      : "Set AOI range in watchlist editor"

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

  const biasTone =
    plan.directional_bias === "Bullish"
      ? "text-profit"
      : plan.directional_bias === "Bearish"
        ? "text-loss"
        : "text-muted-foreground"

  return (
    <article className="rounded-xl border border-white/[0.08] bg-black/30 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold tracking-tight">{plan.pair}</h3>
          <p className={cn("text-[11px] font-medium", biasTone)}>
            Weekly bias: {plan.directional_bias as BiasDirection}
          </p>
        </div>
        <AoiStatusPill status={plan.aoi_status} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground/55">AOI zone</p>
          <p className="mt-0.5 font-mono text-foreground/90">{zone}</p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground/55">Invalidation</p>
          <p className="mt-0.5 font-mono text-foreground/90">
            {plan.invalidation != null ? plan.invalidation : "—"}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <SectionLabel>Thesis</SectionLabel>
        <Textarea
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          onBlur={() => {
            if (thesis !== plan.weekly_thesis) void persistPair({ weekly_thesis: thesis })
          }}
          placeholder="Why this pair matters this week — structure, catalyst, liquidity…"
          className="mt-1 min-h-[64px] border-white/[0.08] bg-black/40 text-[12px] leading-relaxed"
        />
      </div>

      <div className="mt-2">
        <SectionLabel>Execution notes</SectionLabel>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notes !== plan.notes) void persistPair({ notes })
          }}
          placeholder="LTF triggers, news, what would invalidate the idea…"
          className="mt-1 min-h-[48px] border-white/[0.08] bg-black/40 text-[11px]"
        />
      </div>

      <div className="mt-3">
        <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground/60">
          AOI status (you control)
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void setStatus(s)}
              className={cn(
                "rounded-md px-2 py-1 text-[10px] uppercase transition-colors",
                plan.aoi_status === s
                  ? "bg-cyan-glow/20 text-cyan-glow"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10",
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

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-3">
        <Link
          href={`/?coachPair=${encodeURIComponent(plan.pair)}`}
          className="inline-flex items-center gap-1 rounded-md border border-cyan-glow/25 bg-cyan-glow/10 px-2 py-1 text-[10px] font-medium text-cyan-glow hover:bg-cyan-glow/15"
        >
          <Target className="size-3" />
          Open chart coach
        </Link>
        <Link
          href={`/strategy-brain?pair=${encodeURIComponent(plan.pair)}`}
          className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/80 hover:text-cyan-glow hover:underline"
        >
          Evaluate setup
        </Link>
      </div>
    </article>
  )
}
