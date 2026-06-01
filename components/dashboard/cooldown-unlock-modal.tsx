"use client"

import { useState } from "react"
import Link from "next/link"
import { Heart, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { COOLDOWN_UNLOCK_QUESTIONS } from "@/lib/trading-rules/cooldown-questions"
import { submitCooldownUnlockRequest } from "@/lib/trading-rules/api-client"
import {
  buildCooldownCoachIntro,
  buildCooldownSoftLockMessage,
  buildCooldownUnlockSuccessMessage,
} from "@/lib/coach-chapters/personality"
import { getPracticeRoomHref } from "@/lib/dashboard-nav"

type CooldownUnlockModalProps = {
  open: boolean
  accountId: string | null
  traderFirstName?: string | null
  minEmotionalScore?: number
  onClose: () => void
  onCompleted: (unlocked: boolean, message: string) => void
}

export function CooldownUnlockModal({
  open,
  accountId,
  traderFirstName,
  minEmotionalScore = 7,
  onClose,
  onCompleted,
}: CooldownUnlockModalProps) {
  const [lossCause, setLossCause] = useState("")
  const [changePlan, setChangePlan] = useState("")
  const [emotionalScore, setEmotionalScore] = useState(7)
  const [error, setError] = useState<string | null>(null)
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!open || !accountId) return null

  const intro = buildCooldownCoachIntro(traderFirstName ?? "Trader")

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setResultMessage(null)
    setIsSubmitting(true)
    try {
      const result = await submitCooldownUnlockRequest({
        accountId: accountId!,
        lossCause,
        changePlan,
        emotionalScore,
      })
      const message = result.unlocked
        ? buildCooldownUnlockSuccessMessage(traderFirstName ?? "Trader")
        : buildCooldownSoftLockMessage(traderFirstName ?? "Trader")
      setResultMessage(message)
      onCompleted(result.unlocked, message)
      if (result.unlocked) {
        setLossCause("")
        setChangePlan("")
        setEmotionalScore(7)
        onClose()
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit check-in")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="add-trade-backdrop absolute inset-0" onClick={onClose} aria-hidden />
      <div className="add-trade-modal glass-card relative mx-0 flex max-h-[94vh] w-full flex-col overflow-hidden sm:mx-4 sm:max-h-[90vh] sm:max-w-lg">
        <div className="relative shrink-0 border-b border-white/[0.06] px-4 py-4 md:px-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-glow/80">
                Cooldown Coach
              </p>
              <h2 className="text-[16px] font-semibold text-foreground">Let's talk first</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[10px] border border-transparent p-2 hover:border-white/[0.06] hover:bg-white/[0.04]"
            >
              <X className="size-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-6">
            <div className="rounded-[var(--radius-md)] border border-cyan-glow/20 bg-cyan-glow/[0.06] px-3 py-3">
              <p className="whitespace-pre-line text-[12px] leading-relaxed text-foreground/90">
                {intro}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground/80">
                {COOLDOWN_UNLOCK_QUESTIONS[0].prompt}
              </Label>
              <Textarea
                value={lossCause}
                onChange={(event) => setLossCause(event.target.value)}
                placeholder={COOLDOWN_UNLOCK_QUESTIONS[0].placeholder}
                className="add-trade-input min-h-[88px]"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground/80">
                {COOLDOWN_UNLOCK_QUESTIONS[1].prompt}
              </Label>
              <Textarea
                value={changePlan}
                onChange={(event) => setChangePlan(event.target.value)}
                placeholder={COOLDOWN_UNLOCK_QUESTIONS[1].placeholder}
                className="add-trade-input min-h-[88px]"
                required
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground/80">
                  {COOLDOWN_UNLOCK_QUESTIONS[2].prompt}
                </Label>
                <span className="text-[13px] font-semibold tabular-nums text-cyan-glow">
                  {emotionalScore}/10
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={emotionalScore}
                onChange={(event) => setEmotionalScore(Number(event.target.value))}
                className="w-full accent-cyan-glow"
              />
              <p className="text-[10px] text-muted-foreground/70">
                Mind clarity {minEmotionalScore}+ suggested before live trading unlocks.
              </p>
            </div>

            {resultMessage && emotionalScore < minEmotionalScore ? (
              <div className="rounded-[var(--radius-md)] border border-violet-400/25 bg-violet-500/[0.08] px-3 py-3 text-[12px] leading-relaxed text-violet-100">
                <Heart className="mb-1.5 size-4 text-violet-200" />
                {resultMessage}
                <p className="mt-2">
                  <Link href={getPracticeRoomHref()} className="text-violet-200 underline">
                    Open Practice Room
                  </Link>{" "}
                  to paper trade while you reset.
                </p>
              </div>
            ) : null}

            {error ? (
              <p className="rounded-[var(--radius-sm)] border border-loss/25 bg-loss/[0.08] px-2.5 py-2 text-[11px] text-loss">
                {error}
              </p>
            ) : null}
          </div>
          <div className="shrink-0 border-t border-white/[0.06] px-4 py-4 md:px-6">
            <Button type="submit" disabled={isSubmitting} className="btn-primary h-11 w-full">
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Reflecting…
                </span>
              ) : (
                "I'm ready to reflect"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
