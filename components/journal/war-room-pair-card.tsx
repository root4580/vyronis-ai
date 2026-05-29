"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { Camera, Loader2, Target } from "lucide-react"
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
}

export function WarRoomPairCard({
  plan,
  weekPlan,
  weekStart,
  sessionFocus,
  expectedScenarios,
  onUpdated,
}: Props) {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [thesis, setThesis] = useState(plan.weekly_thesis)
  const [notes, setNotes] = useState(plan.notes)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

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

  async function uploadHtf(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "same-origin" })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Upload failed")
      }
      const { url } = await res.json()
      const urls = [...(plan.screenshot_urls ?? []), url].slice(0, 4)
      await persistPair({ screenshot_urls: urls })
      toast({ title: "HTF screenshot added" })
    } catch (e) {
      toast({
        title: "Upload failed",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
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

      <div className="mt-3">
        <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground/60">
          HTF screenshots
        </p>
        {(plan.screenshot_urls ?? []).length > 0 ? (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {(plan.screenshot_urls ?? []).map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block shrink-0"
              >
                <img
                  src={url}
                  alt={`${plan.pair} HTF`}
                  className="h-16 w-24 rounded-md border border-white/[0.08] object-cover"
                />
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-[10px] text-muted-foreground/55">No charts yet — upload W/D structure</p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void uploadHtf(f)
            e.target.value = ""
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 h-8 text-[10px]"
          disabled={uploading || saving}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="mr-1 size-3 animate-spin" />
          ) : (
            <Camera className="mr-1 size-3" />
          )}
          Add HTF chart
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
        <Link
          href={`/strategy-brain?pair=${encodeURIComponent(plan.pair)}`}
          className="inline-flex items-center gap-1 text-[10px] font-medium text-cyan-glow hover:underline"
        >
          <Target className="size-3" />
          Evaluate setup
        </Link>
        <span className="text-[10px] text-muted-foreground/50">Human confirms entry</span>
      </div>
    </article>
  )
}
