"use client"

import { useEffect, useState, type RefCallback } from "react"
import { ArrowRight, Shield, Sparkles, Target, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { PREFERRED_SESSION_OPTIONS, PROP_FIRM_SIZES, normalizePreferredSession, type UserSettingsForm } from "@/lib/user-settings"

const PROP_BALANCE_MAP: Record<string, number> = {
  "5K": 5000,
  "10K": 10000,
  "25K": 25000,
  "50K": 50000,
  "100K": 100000,
  "150K": 150000,
  "200K": 200000,
}

const SESSION_OPTIONS = PREFERRED_SESSION_OPTIONS

type FirstRunSetupModalProps = {
  open: boolean
  form: UserSettingsForm
  isSaving?: boolean
  onComplete: (updates: Partial<UserSettingsForm>, options?: { openWarRoom?: boolean }) => Promise<void>
  onOpenWarRoom: () => void
}

export function FirstRunSetupModal({
  open,
  form,
  isSaving = false,
  onComplete,
  onOpenWarRoom,
}: FirstRunSetupModalProps) {
  const [step, setStep] = useState(0)
  const [overlayEl, setOverlayEl] = useState<HTMLElement | null>(null)
  const [draft, setDraft] = useState<UserSettingsForm>(() => ({
    ...form,
    preferred_session: normalizePreferredSession(form.preferred_session),
  }))

  const overlayRef: RefCallback<HTMLDivElement> = (node) => {
    setOverlayEl(node)
  }

  useEffect(() => {
    if (!open) return
    setStep(0)
    setDraft({
      ...form,
      preferred_session: normalizePreferredSession(form.preferred_session),
    })
  }, [open, form])

  if (!open) return null

  const steps = [
    {
      title: "How Vyronis works",
      description: "A 60-second rundown before we set up your account.",
      icon: Zap,
    },
    {
      title: "Account size",
      description: "Set your prop firm or personal account size so risk math stays accurate.",
      icon: Target,
    },
    {
      title: "Max risk per trade",
      description: "Vyronis uses this to flag oversized entries and coach discipline.",
      icon: Shield,
    },
    {
      title: "Preferred session",
      description: "Pick when you trade most — War Room and analytics will align to it.",
      icon: Sparkles,
    },
  ] as const

  const current = steps[step]

  async function handleFinish(openWarRoom: boolean) {
    await onComplete(
      {
        prop_firm_size: draft.prop_firm_size,
        starting_balance: draft.starting_balance,
        max_risk_per_trade: draft.max_risk_per_trade,
        preferred_session: draft.preferred_session,
      },
      { openWarRoom },
    )
  }

  const selectMenuClassName =
    "z-[200] border-white/[0.1] bg-surface-modal shadow-xl shadow-black/40"

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
    >
      <div className="add-trade-backdrop absolute inset-0" aria-hidden />

      <div className="add-trade-modal glass-card relative z-10 mx-0 flex max-h-[94vh] w-full flex-col overflow-hidden sm:mx-4 sm:max-h-[90vh] sm:max-w-lg">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-glow/[0.08] via-transparent to-profit/[0.05]" />

        <div className="relative border-b border-white/[0.06] px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl border border-cyan-glow/25 bg-cyan-glow/[0.1]">
              <current.icon className="size-4 text-cyan-glow" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-glow/80">
                Step {step + 1} of {steps.length}
              </p>
              <h2 className="text-[16px] font-semibold tracking-tight text-foreground">{current.title}</h2>
              <p className="text-[11px] text-muted-foreground/75">{current.description}</p>
            </div>
          </div>
        </div>

        <div className="relative space-y-4 overflow-y-auto px-4 py-4 md:px-6">
          {step === 0 ? (
            <div className="space-y-3">
              <DashboardInsetPanel className="border-cyan-glow/15 bg-cyan-glow/[0.04] px-3 py-3">
                <p className="text-[11px] leading-relaxed text-muted-foreground/80">
                  Vyronis works as a simple loop: plan your setup in <strong>War Room</strong>, execute
                  the trade, then <strong>journal</strong> the result. Your dashboard, analytics, and AI
                  coach all build from that first logged trade — there&apos;s nothing to configure beyond
                  the three quick settings on the next steps.
                </p>
              </DashboardInsetPanel>
              <ol className="space-y-2 text-[11px] text-muted-foreground/80">
                <li className="flex gap-2">
                  <span className="font-semibold text-cyan-glow/85">1.</span>
                  Open War Room and plan a setup (pair, direction, thesis).
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-cyan-glow/85">2.</span>
                  Execute the trade on your broker/prop platform as usual.
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-cyan-glow/85">3.</span>
                  Log the result in your journal — Vyronis scores it and starts coaching from there.
                </li>
              </ol>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground/80">
                Prop firm / account type
              </Label>
              <Select
                value={draft.prop_firm_size}
                onValueChange={(value) =>
                  setDraft((prev) => ({
                    ...prev,
                    prop_firm_size: value,
                    starting_balance: PROP_BALANCE_MAP[value] ?? prev.starting_balance,
                  }))
                }
              >
                <SelectTrigger className="add-trade-input h-10">
                  <SelectValue placeholder="Select account size" />
                </SelectTrigger>
                <SelectContent container={overlayEl} className={selectMenuClassName}>
                  {PROP_FIRM_SIZES.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size} account
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground/70">
                Starting balance set to ${draft.starting_balance.toLocaleString()}.
              </p>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground/80">
                Max risk per trade (%)
              </Label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={draft.max_risk_per_trade}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    max_risk_per_trade: parseFloat(event.target.value) || prev.max_risk_per_trade,
                  }))
                }
                className="add-trade-input h-10 tabular-nums"
              />
              <p className="text-[10px] text-muted-foreground/70">
                Most prop traders start at 0.5–1%. You can change this anytime in settings.
              </p>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground/80">
                  Preferred session
                </Label>
                <Select
                  value={normalizePreferredSession(draft.preferred_session)}
                  onValueChange={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      preferred_session: value,
                    }))
                  }
                >
                  <SelectTrigger className="add-trade-input h-10">
                    <SelectValue placeholder="Select session" />
                  </SelectTrigger>
                  <SelectContent container={overlayEl} className={selectMenuClassName}>
                    {SESSION_OPTIONS.map((session) => (
                      <SelectItem key={session} value={session}>
                        {session}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DashboardInsetPanel className="border-cyan-glow/15 bg-cyan-glow/[0.04] px-3 py-3">
                <p className="text-[11px] leading-relaxed text-muted-foreground/80">
                  Next: open War Room to plan your first setup, then log the trade in your journal.
                  Vyronis analytics unlock after your first entry.
                </p>
              </DashboardInsetPanel>
            </div>
          ) : null}
        </div>

        <div className="relative flex shrink-0 items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-4 md:px-6">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={step === 0 || isSaving}
            onClick={() => setStep((value) => Math.max(0, value - 1))}
          >
            Back
          </Button>

          <div className="flex flex-col items-end gap-2">
            {step === steps.length - 1 ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  className="btn-primary"
                  disabled={isSaving}
                  onClick={() => void handleFinish(true)}
                >
                  Set up War Room
                  <ArrowRight className="ml-1.5 size-3.5" />
                </Button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleFinish(false)}
                  className="text-[11px] text-muted-foreground/70 transition-colors hover:text-foreground/85"
                >
                  Skip for now
                </button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                className="btn-primary"
                disabled={isSaving}
                onClick={() => setStep((value) => value + 1)}
              >
                Continue
                <ArrowRight className="ml-1.5 size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
