"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { AlertTriangle, Brain, CheckCircle2, ChevronDown, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToastAction } from "@/components/ui/toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DashboardEmptyState,
  DashboardInsetPanel,
} from "@/components/dashboard/dashboard-primitives"
import { TradePlanVisual } from "@/components/trade-planner/trade-plan-visual"
import type { TradePlanCalculation } from "@/lib/trade-planner/types"
import { PlanChartUploadPanel } from "@/components/trade-planner/plan-chart-upload-panel"
import { TRADE_PLANNER_PAIRS } from "@/lib/trade-planner/forex-pairs"
import {
  buildTradePlanCalculation,
  formatLotSize,
  formatRiskReward,
  parseTradePlanNumber,
} from "@/lib/trade-planner/trade-plan-engine"
import {
  buildPlannedContextFromTradePlannerPrefill,
  buildTradePlannerCoachPrefill,
} from "@/lib/trade-planner/coach-prefill"
import { useAIContext } from "@/providers/ai-context-provider"
import { buildPlanSlCoaching, mergePlanPointers } from "@/lib/trade-planner/plan-sl-coaching"
import type { TradePlanDirection } from "@/lib/trade-planner/types"
import { APP_HOME_PATH } from "@/lib/branding"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

type SavedPlanRow = {
  id: string
  pair: string
  direction: TradePlanDirection
  rr: number | null
  recommendedLots: number | null
  status: string
  created_at: string
}

type TradePlannerWorkspaceProps = {
  defaultAccountSize?: number
  defaultRiskPercent?: number
  maxRiskPerTrade?: number
  accountSizeReady?: boolean
  skippedBalanceTrades?: number
  onCoachEngaged?: () => void
}

export function TradePlannerWorkspace({
  defaultAccountSize = DEFAULT_USER_SETTINGS.starting_balance,
  defaultRiskPercent = DEFAULT_USER_SETTINGS.max_risk_per_trade,
  maxRiskPerTrade = DEFAULT_USER_SETTINGS.max_risk_per_trade,
  accountSizeReady = false,
  skippedBalanceTrades = 0,
  onCoachEngaged,
}: TradePlannerWorkspaceProps) {
  const { openPreTradeCoach } = useAIContext()
  const { toast } = useToast()
  const [pair, setPair] = useState<string>("EURUSD")
  const [direction, setDirection] = useState<TradePlanDirection>("BUY")
  const [accountSize, setAccountSize] = useState("")
  const [accountSizeTouched, setAccountSizeTouched] = useState(false)
  const [riskPercent, setRiskPercent] = useState(String(defaultRiskPercent))
  const [entryPrice, setEntryPrice] = useState("")
  const [stopLoss, setStopLoss] = useState("")
  const [takeProfit, setTakeProfit] = useState("")
  const [savedPlans, setSavedPlans] = useState<SavedPlanRow[]>([])
  const [pastPlansOpen, setPastPlansOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveUnavailable, setSaveUnavailable] = useState(false)
  const [chartScreenshotUrl, setChartScreenshotUrl] = useState<string | null>(null)
  const [chartPointers, setChartPointers] = useState<string[]>([])
  const [isChartUploading, setIsChartUploading] = useState(false)
  const [isChartAnalyzing, setIsChartAnalyzing] = useState(false)

  useEffect(() => {
    if (accountSizeTouched || defaultAccountSize <= 0) return
    setAccountSize(String(defaultAccountSize))
  }, [defaultAccountSize, accountSizeTouched])

  useEffect(() => {
    setRiskPercent(String(defaultRiskPercent))
  }, [defaultRiskPercent])

  const plan = useMemo(() => {
    return buildTradePlanCalculation({
      pair,
      direction,
      accountSize: parseTradePlanNumber(accountSize),
      riskPercent: parseTradePlanNumber(riskPercent),
      entryPrice: parseTradePlanNumber(entryPrice),
      stopLoss: parseTradePlanNumber(stopLoss),
      takeProfit: parseTradePlanNumber(takeProfit),
    })
  }, [pair, direction, accountSize, riskPercent, entryPrice, stopLoss, takeProfit])

  const displayPointers = useMemo(() => {
    const entry = parseTradePlanNumber(entryPrice)
    const stop = parseTradePlanNumber(stopLoss)
    const target = parseTradePlanNumber(takeProfit)
    if (entry <= 0 || stop <= 0) return chartPointers

    const tips = buildPlanSlCoaching({
      pair,
      direction,
      accountSize: parseTradePlanNumber(accountSize),
      riskPercent: parseTradePlanNumber(riskPercent),
      entryPrice: entry,
      stopLoss: stop,
      takeProfit: target,
    })

    return mergePlanPointers(chartPointers, tips, pair)
  }, [chartPointers, pair, direction, accountSize, riskPercent, entryPrice, stopLoss, takeProfit])

  useEffect(() => {
    void fetch("/api/trade-plans")
      .then(async (res) => {
        if (res.status === 503) {
          setSaveUnavailable(true)
          return { plans: [] }
        }
        return res.ok ? res.json() : { plans: [] }
      })
      .then((data) => setSavedPlans(Array.isArray(data.plans) ? data.plans : []))
      .catch(() => setSavedPlans([]))
  }, [])

  async function sendPlanToCoach(tradePlanId?: string) {
    if (!canCoach) return

    const prefill = buildTradePlannerCoachPrefill(plan, {
      tradePlanId,
      chartScreenshotUrl: chartScreenshotUrl,
      chartPointers: displayPointers,
    })
    const plannedContext = buildPlannedContextFromTradePlannerPrefill(prefill, maxRiskPerTrade)

    try {
      await openPreTradeCoach({ plannedContext, plannerCheckIn: true })
      onCoachEngaged?.()
    } catch (error) {
      toast({
        title: "Could not open Coach",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      })
    }
  }

  async function handleChartUpload(file: File) {
    setIsChartUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      })

      if (!uploadResponse.ok) {
        const payload = await uploadResponse.json().catch(() => ({}))
        throw new Error(payload.error || "Upload failed")
      }

      const { url } = (await uploadResponse.json()) as { url: string }
      setChartScreenshotUrl(url)
      setIsChartUploading(false)
      setIsChartAnalyzing(true)

      const autofillResponse = await fetch("/api/trade-planner/chart-autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: url,
          pairHint: pair,
          directionHint: direction,
          accountSize: parseTradePlanNumber(accountSize),
          riskPercent: parseTradePlanNumber(riskPercent),
        }),
      })

      const autofillPayload = await autofillResponse.json().catch(() => ({}))
      if (!autofillResponse.ok) {
        throw new Error(autofillPayload.error || "Chart analysis failed")
      }

      const applied = autofillPayload.applied as
        | {
            pair: string
            direction: TradePlanDirection
            entryPrice: string
            stopLoss: string
            takeProfit: string
          }
        | null

      if (applied) {
        setPair(applied.pair)
        setDirection(applied.direction)
        if (applied.entryPrice) setEntryPrice(applied.entryPrice)
        if (applied.stopLoss) setStopLoss(applied.stopLoss)
        if (applied.takeProfit) setTakeProfit(applied.takeProfit)
      }

      setChartPointers(Array.isArray(autofillPayload.pointers) ? autofillPayload.pointers : [])

      toast({
        title: applied ? "Chart levels loaded" : "Chart uploaded",
        description: applied
          ? `${applied.pair} ${applied.direction} — review SL pointers before saving.`
          : autofillPayload.vision?.summary ||
            "Could not read prices — enter entry, SL, and TP manually.",
        variant: applied ? "default" : "destructive",
      })
    } catch (error) {
      toast({
        title: "Chart upload failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      })
    } finally {
      setIsChartUploading(false)
      setIsChartAnalyzing(false)
    }
  }

  async function handleSavePlan() {
    setIsSaving(true)
    try {
      const response = await fetch("/api/trade-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pair,
          direction,
          accountSize: parseTradePlanNumber(accountSize),
          riskPercent: parseTradePlanNumber(riskPercent),
          entryPrice: parseTradePlanNumber(entryPrice),
          stopLoss: parseTradePlanNumber(stopLoss),
          takeProfit: parseTradePlanNumber(takeProfit),
        }),
      })

      const data = await response.json()
      if (response.status === 503 || data.code === "MIGRATION_PENDING") {
        setSaveUnavailable(true)
        return
      }
      if (!response.ok) {
        throw new Error(data.error || "Failed to save plan")
      }

      setSavedPlans((current) => [data.plan, ...current].slice(0, 20))
      toast({
        title: "Pre-trade plan saved",
        description: "Stored separately from your post-trade journal.",
        action: (
          <ToastAction
            altText="Run Coach check-in"
            onClick={() => void sendPlanToCoach(String(data.plan.id))}
          >
            Run Coach
          </ToastAction>
        ),
      })
    } catch (error) {
      toast({
        title: "Could not save plan",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const canCoach =
    plan.entryPrice > 0 && plan.stopLoss > 0 && plan.takeProfit > 0 && plan.pair.length > 0

  const canSave = canCoach && !saveUnavailable

  const activePlans = useMemo(
    () => savedPlans.filter((row) => row.status === "active"),
    [savedPlans],
  )
  const pastPlans = useMemo(
    () => savedPlans.filter((row) => row.status !== "active"),
    [savedPlans],
  )

  const plannerInputClass = "planner-input w-full"
  const selectTriggerClass =
    "h-9 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-input)] text-[13px] font-medium text-text-primary"

  return (
    <div className="space-y-5">
      <div
        className={cn(
          "flex items-start gap-2.5 rounded-[var(--radius-md)] border px-3.5 py-3",
          saveUnavailable
            ? "border-[var(--warning-border)] bg-[var(--warning-bg)]"
            : "border-[var(--warning-border)] bg-[var(--warning-bg)]",
        )}
      >
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning-foreground" />
        <div className="min-w-0 text-[12px] leading-relaxed text-warning-muted">
          {saveUnavailable ? (
            <>
              <span className="font-medium text-warning-foreground">Planner saving unavailable — migration pending.</span>{" "}
              Run <code className="text-[11px] text-warning-muted">supabase/030-trade-plans.sql</code> in Supabase.
              Planning and calculations still work.
            </>
          ) : (
            <>
              Pre-trade sizing only — log outcome after close.{" "}
              <Link
                href={`${APP_HOME_PATH}?action=new-trade`}
                className="font-medium text-warning-foreground underline underline-offset-2 hover:no-underline"
              >
                Log Trade →
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="planner-surface-card p-4 sm:p-5">
          <p className="mb-3.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">Trade setup</p>
          <div className="space-y-4">
            <Field label="Pair">
              <Select value={pair} onValueChange={setPair}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder="Select pair" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {TRADE_PLANNER_PAIRS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Direction">
              <div className="flex rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-white/[0.03] p-0.5">
                {(["BUY", "SELL"] as const).map((value) => {
                  const active = direction === value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDirection(value)}
                      className={cn(
                        "flex-1 rounded-[calc(var(--radius-sm)-2px)] py-2 text-xs font-medium transition-colors",
                        active
                          ? value === "BUY"
                            ? "border border-profit/30 bg-profit/[0.12] text-profit"
                            : "border border-loss/25 bg-loss/10 text-loss"
                          : "text-text-muted",
                      )}
                    >
                      {value === "BUY" ? "Buy" : "Sell"}
                    </button>
                  )
                })}
              </div>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Account size ($)"
                hint={
                  accountSizeReady
                    ? skippedBalanceTrades > 0
                      ? `Prefilled from starting balance + ${skippedBalanceTrades} skipped trade(s) missing result/P&L.`
                      : "Prefilled from current balance (starting + journal P&L)."
                    : "Loading current balance…"
                }
              >
                <Input
                  inputMode="decimal"
                  value={accountSize}
                  onChange={(event) => {
                    setAccountSizeTouched(true)
                    setAccountSize(event.target.value)
                  }}
                  className={plannerInputClass}
                />
              </Field>

              <Field label="Risk %">
                <Input
                  inputMode="decimal"
                  value={riskPercent}
                  onChange={(event) => setRiskPercent(event.target.value)}
                  className={plannerInputClass}
                />
              </Field>

              <Field label="Entry price">
                <Input
                  inputMode="decimal"
                  value={entryPrice}
                  onChange={(event) => setEntryPrice(event.target.value)}
                  className={plannerInputClass}
                />
              </Field>

              <Field label="Stop loss">
                <Input
                  inputMode="decimal"
                  value={stopLoss}
                  onChange={(event) => setStopLoss(event.target.value)}
                  className={plannerInputClass}
                />
              </Field>

              <Field label="Take profit" className="sm:col-span-2">
                <Input
                  inputMode="decimal"
                  value={takeProfit}
                  onChange={(event) => setTakeProfit(event.target.value)}
                  className={plannerInputClass}
                />
              </Field>
            </div>

            <PlanChartUploadPanel
              screenshotUrl={chartScreenshotUrl}
              pointers={displayPointers}
              isUploading={isChartUploading}
              isAnalyzing={isChartAnalyzing}
              onUpload={(file) => void handleChartUpload(file)}
              onRemove={() => {
                setChartScreenshotUrl(null)
                setChartPointers([])
              }}
              disabled={isSaving}
            />

            {plan.warnings.length > 0 ? (
              <div className="space-y-2">
                {plan.warnings.map((warning) => (
                  <div
                    key={warning.id}
                    className="flex items-start gap-2 rounded-r-[var(--radius-sm)] border border-[var(--warning-border)] border-l-2 border-l-[var(--warning)] bg-[var(--warning-bg)] py-2 pl-2.5 pr-3"
                  >
                    <AlertTriangle className="mt-0.5 size-3 shrink-0 text-warning-foreground" />
                    <p className="text-[11px] leading-relaxed text-warning-muted">{warning.message}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="sticky bottom-[calc(60px+env(safe-area-inset-bottom,0px))] z-10 -mx-4 border-t border-[var(--border-subtle)] bg-[var(--surface-page)] p-4 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 xl:static">
              <Button
                type="button"
                className="btn-primary h-10 w-full rounded-[var(--radius-md)] text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!canSave || isSaving}
                onClick={() => void handleSavePlan()}
              >
                <Save className="mr-2 size-4" />
                {isSaving ? "Saving plan..." : "Save pre-trade plan"}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="planner-surface-card overflow-hidden p-4 sm:p-5">
            <TradePlanVisual plan={plan} />
          </div>

          <div className="planner-surface-card p-4 sm:p-5">
            <p className="mb-3 text-[10px] font-medium uppercase tracking-wide text-text-muted">Plan result</p>
            <div className="grid grid-cols-2 gap-2.5">
              <MetricTile label="Risk $" value={`$${plan.riskAmount.toFixed(2)}`} />
              <MetricTile label="SL pips" value={plan.slPips.toFixed(1)} />
              <MetricTile label="TP pips" value={plan.tpPips.toFixed(1)} />
              <MetricTile
                label="R:R"
                value={formatRiskReward(plan.rr)}
                valueClassName={
                  plan.rr != null && plan.rr >= 2
                    ? "text-profit"
                    : plan.rr != null && plan.rr >= 1
                      ? "text-warning-foreground"
                      : plan.rr != null
                        ? "text-loss"
                        : undefined
                }
              />
              <MetricTile
                label={
                  <>
                    <span className="text-warning-foreground">Est.</span> lots
                  </>
                }
                value={formatLotSize(plan.recommendedLots)}
                hint="USD acct · 100k units"
              />
              <MetricTile
                label="Pip value/lot"
                value={`$${plan.pipValuePerStandardLot.toFixed(2)}`}
                mutedValue
              />
            </div>

            <SuggestedActionStrip plan={plan} />

            <Button
              type="button"
              variant="outline"
              className="mt-3 h-9 w-full rounded-[var(--radius-md)] border-[var(--color-accent-border)] bg-[var(--color-accent-bg)] text-[13px] text-text-accent hover:bg-[var(--color-accent-bg)]"
              disabled={!canCoach}
              onClick={() => void sendPlanToCoach()}
            >
              <Brain className="mr-2 size-4" />
              Send to Coach
            </Button>
          </div>

          <div className="planner-surface-card p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Save className="size-4 text-text-secondary" />
              <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Recent plans</p>
            </div>
            {activePlans.length === 0 ? (
              <DashboardEmptyState
                icon={Save}
                title="No active plans"
                description="Saved plans stay separate from post-trade journal entries."
                className="min-h-[100px]"
              />
            ) : (
              <div className="space-y-2">
                {activePlans.slice(0, 6).map((saved) => (
                  <DashboardInsetPanel
                    key={saved.id}
                    className="flex items-center justify-between border-[var(--border-subtle)] bg-[var(--surface-input)] px-3 py-2"
                  >
                    <div>
                      <p className="text-[12px] font-medium text-text-primary">
                        {saved.pair} · {saved.direction}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        {new Date(saved.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right text-[11px] tabular-nums">
                      <p className="text-text-accent">{formatRiskReward(saved.rr)}</p>
                      <p className="text-text-muted">
                        <span className="text-warning-foreground">Est.</span> {formatLotSize(saved.recommendedLots)} lots
                      </p>
                    </div>
                  </DashboardInsetPanel>
                ))}
              </div>
            )}

            {pastPlans.length > 0 ? (
              <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
                <button
                  type="button"
                  onClick={() => setPastPlansOpen((open) => !open)}
                  className="flex w-full items-center justify-between text-left text-[11px] text-text-muted hover:text-text-primary"
                >
                  <span>Past plans ({pastPlans.length})</span>
                  <ChevronDown
                    className={cn("size-4 transition-transform", pastPlansOpen ? "rotate-180" : "")}
                  />
                </button>
                {pastPlansOpen ? (
                  <div className="mt-2 space-y-2">
                    {pastPlans.slice(0, 12).map((saved) => (
                      <DashboardInsetPanel
                        key={saved.id}
                        className="flex items-center justify-between border-[var(--border-subtle)] bg-[var(--surface-input)] px-3 py-2 opacity-80"
                      >
                        <div>
                          <p className="text-[12px] font-medium text-text-primary">
                            {saved.pair} · {saved.direction}
                          </p>
                          <p className="text-[10px] capitalize text-text-muted">
                            {saved.status} · {new Date(saved.created_at).toLocaleString()}
                          </p>
                        </div>
                        <p className="text-[11px] tabular-nums text-text-muted">{formatRiskReward(saved.rr)}</p>
                      </DashboardInsetPanel>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
  className,
  hint,
}: {
  label: string
  children: ReactNode
  className?: string
  hint?: string
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="mb-1 block text-[10px] text-text-muted">{label}</span>
      {children}
      {hint ? <span className="block text-[10px] leading-relaxed text-text-muted">{hint}</span> : null}
    </label>
  )
}

function SuggestedActionStrip({ plan }: { plan: TradePlanCalculation }) {
  const message =
    plan.suggestedAction === "plan_valid"
      ? "Plan looks good — run Coach before entry"
      : plan.suggestedActionLabel

  return (
    <div
      className={cn(
        "mt-3 flex items-start gap-2 rounded-[var(--radius-md)] border px-3 py-2.5",
        plan.suggestedAction === "plan_valid"
          ? "border-profit/20 bg-profit/[0.06] text-profit"
          : plan.suggestedAction === "adjust_plan"
            ? "border-[var(--warning-border)] bg-[var(--warning-bg)] text-warning-foreground"
            : "border-loss/20 bg-loss/[0.06] text-loss",
      )}
    >
      {plan.suggestedAction === "plan_valid" ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
      ) : (
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      )}
      <p className="text-[12px] leading-relaxed">{message}</p>
    </div>
  )
}

function MetricTile({
  label,
  value,
  hint,
  valueClassName,
  mutedValue = false,
}: {
  label: ReactNode
  value: string
  hint?: string
  valueClassName?: string
  mutedValue?: boolean
}) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-input)] px-2.5 py-2">
      <p className="text-[10px] text-text-muted">{label}</p>
      <p
        className={cn(
          "mt-1 text-base font-medium tabular-nums",
          mutedValue ? "text-text-muted" : "text-text-primary",
          valueClassName,
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[10px] text-text-muted">{hint}</p> : null}
    </div>
  )
}
