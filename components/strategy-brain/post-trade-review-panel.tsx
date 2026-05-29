"use client"

import { useState } from "react"
import { ClipboardCheck } from "lucide-react"
import { submitPostTradeReview } from "@/lib/strategy-brain/api-client"
import type { PostTradeReviewAnswers } from "@/lib/strategy-brain/types"
import { SectionLabel, StrategyBrainGlass } from "@/components/strategy-brain/strategy-brain-primitives"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

type TradeOption = { id: string; pair: string; result: string }

type Props = {
  trades: TradeOption[]
}

export function PostTradeReviewPanel({ trades }: Props) {
  const { toast } = useToast()
  const [tradeId, setTradeId] = useState(trades[0]?.id ?? "")
  const [answers, setAnswers] = useState<PostTradeReviewAnswers>({
    followed_strategy: null,
    valid_loss: null,
    confirmation_clear: null,
    entry_timing: null,
    issue_type: null,
    should_repeat: "",
    should_change: "",
  })
  const [saving, setSaving] = useState(false)

  if (trades.length === 0) {
    return (
      <StrategyBrainGlass>
        <SectionLabel>Post-trade review</SectionLabel>
        <p className="mt-2 text-[11px] text-muted-foreground/70">
          Log a trade in your journal first — then return here for a structured debrief.
        </p>
      </StrategyBrainGlass>
    )
  }

  async function handleSubmit() {
    if (!tradeId) return
    setSaving(true)
    try {
      await submitPostTradeReview({ trade_id: tradeId, answers })
      toast({ title: "Post-trade review saved" })
    } catch (e) {
      toast({
        title: "Review failed",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <StrategyBrainGlass>
      <div className="mb-3 flex items-center gap-2">
        <ClipboardCheck className="size-4 text-cyan-glow" />
        <SectionLabel>Post-trade review</SectionLabel>
      </div>

      <Select value={tradeId} onValueChange={setTradeId}>
        <SelectTrigger className="mb-3 h-9 text-xs">
          <SelectValue placeholder="Select trade" />
        </SelectTrigger>
        <SelectContent>
          {trades.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.pair} · {t.result}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="space-y-2 text-[11px]">
        {[
          { key: "followed_strategy" as const, label: "Did I follow strategy?" },
          { key: "valid_loss" as const, label: "Was it a valid loss?" },
          { key: "confirmation_clear" as const, label: "Was confirmation clear?" },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <span className="text-foreground/85">{label}</span>
            <div className="flex gap-1">
              {([true, false] as const).map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setAnswers((a) => ({ ...a, [key]: v }))}
                  className={
                    answers[key] === v
                      ? "rounded bg-cyan-glow/15 px-2 py-0.5 text-cyan-glow"
                      : "rounded bg-white/5 px-2 py-0.5 text-muted-foreground"
                  }
                >
                  {v ? "Yes" : "No"}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between gap-2">
          <span className="text-foreground/85">Entry timing</span>
          <Select
            value={answers.entry_timing ?? ""}
            onValueChange={(v) =>
              setAnswers((a) => ({
                ...a,
                entry_timing: v as PostTradeReviewAnswers["entry_timing"],
              }))
            }
          >
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="early">Early</SelectItem>
              <SelectItem value="on_time">On time</SelectItem>
              <SelectItem value="late">Late</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-foreground/85">Primary issue</span>
          <Select
            value={answers.issue_type ?? ""}
            onValueChange={(v) =>
              setAnswers((a) => ({
                ...a,
                issue_type: v as PostTradeReviewAnswers["issue_type"],
              }))
            }
          >
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="strategy">Strategy</SelectItem>
              <SelectItem value="execution">Execution</SelectItem>
              <SelectItem value="both">Both</SelectItem>
              <SelectItem value="neither">Neither</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Textarea
        className="mt-2 min-h-[56px] border-white/[0.08] bg-black/30 text-[12px]"
        placeholder="What should repeat?"
        value={answers.should_repeat}
        onChange={(e) => setAnswers((a) => ({ ...a, should_repeat: e.target.value }))}
      />
      <Textarea
        className="mt-2 min-h-[56px] border-white/[0.08] bg-black/30 text-[12px]"
        placeholder="What should change?"
        value={answers.should_change}
        onChange={(e) => setAnswers((a) => ({ ...a, should_change: e.target.value }))}
      />

      <Button className="mt-3 w-full" onClick={() => void handleSubmit()} disabled={saving}>
        {saving ? "Saving…" : "Save review"}
      </Button>
    </StrategyBrainGlass>
  )
}
