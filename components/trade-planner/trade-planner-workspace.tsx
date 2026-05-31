"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, Brain, Calculator, CheckCircle2, ChevronDown, Save, Target } from "lucide-react"
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
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
  DashboardEmptyState,
  DashboardInsetPanel,
} from "@/components/dashboard/dashboard-primitives"
import { TradePlanVisual } from "@/components/trade-planner/trade-plan-visual"
import { TRADE_PLANNER_PAIRS } from "@/lib/trade-planner/forex-pairs"
import {
  buildTradePlanCalculation,
  formatLotSize,
  formatRiskReward,
  parseTradePlanNumber,
} from "@/lib/trade-planner/trade-plan-engine"
import {
  buildTradePlannerCoachPrefill,
  getTradePlannerCoachHref,
  writeTradePlannerCoachPrefill,
} from "@/lib/trade-planner/coach-prefill"
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
  accountSizeReady?: boolean
  skippedBalanceTrades?: number
}

export function TradePlannerWorkspace({
  defaultAccountSize = DEFAULT_USER_SETTINGS.starting_balance,
  defaultRiskPercent = DEFAULT_USER_SETTINGS.max_risk_per_trade,
  accountSizeReady = false,
  skippedBalanceTrades = 0,
}: TradePlannerWorkspaceProps) {
  const router = useRouter()
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

  function sendPlanToCoach(tradePlanId?: string) {
    if (!canCoach) return
    writeTradePlannerCoachPrefill(buildTradePlannerCoachPrefill(plan, tradePlanId))
    router.push(getTradePlannerCoachHref())
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
          <ToastAction altText="Run Coach check-in" onClick={() => sendPlanToCoach(String(data.plan.id))}>
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

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-cyan-glow/15 bg-cyan-glow/[0.04] px-4 py-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground/85">
          Pre-trade sizing only — use{" "}
          <Link href={`${APP_HOME_PATH}?action=new-trade`} className="text-cyan-glow hover:underline">
            Log Trade
          </Link>{" "}
          to log outcome after close.
        </p>
      </div>

      {saveUnavailable ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3">
          <p className="text-[11px] font-medium text-amber-100/95">
            Planner saving unavailable — migration pending
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/75">
            Run <code className="text-[10px] text-amber-100/80">supabase/030-trade-plans.sql</code> in
            Supabase to enable saves. Planning and calculations still work.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <DashboardCard interactive glow className="glass-card">
          <DashboardCardHeader title="Plan inputs" icon={Calculator} />
          <DashboardCardBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Pair">
                <Select value={pair} onValueChange={setPair}>
                  <SelectTrigger className="h-10 border-white/[0.08] bg-black/20">
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
                <Select
                  value={direction}
                  onValueChange={(value) => setDirection(value as TradePlanDirection)}
                >
                  <SelectTrigger className="h-10 border-white/[0.08] bg-black/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUY">Buy</SelectItem>
                    <SelectItem value="SELL">Sell</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Account size ($)"
                hint={
                  accountSizeReady
                    ? skippedBalanceTrades > 0
                      ? `Prefilled from starting balance + ${skippedBalanceTrades} skipped trade(s) missing result/P&L. Edit if your live account differs.`
                      : "Prefilled from current balance (starting + journal P&L). Edit if your live account differs."
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
                  className="h-10 border-white/[0.08] bg-black/20"
                />
              </Field>

              <Field label="Risk %">
                <Input
                  inputMode="decimal"
                  value={riskPercent}
                  onChange={(event) => setRiskPercent(event.target.value)}
                  className="h-10 border-white/[0.08] bg-black/20"
                />
              </Field>

              <Field label="Entry price">
                <Input
                  inputMode="decimal"
                  value={entryPrice}
                  onChange={(event) => setEntryPrice(event.target.value)}
                  className="h-10 border-white/[0.08] bg-black/20"
                />
              </Field>

              <Field label="Stop loss">
                <Input
                  inputMode="decimal"
                  value={stopLoss}
                  onChange={(event) => setStopLoss(event.target.value)}
                  className="h-10 border-white/[0.08] bg-black/20"
                />
              </Field>

              <Field label="Take profit" className="sm:col-span-2">
                <Input
                  inputMode="decimal"
                  value={takeProfit}
                  onChange={(event) => setTakeProfit(event.target.value)}
                  className="h-10 border-white/[0.08] bg-black/20"
                />
              </Field>
            </div>

            <TradePlanVisual plan={plan} />
          </DashboardCardBody>
        </DashboardCard>

        <div className="space-y-4">
          <DashboardCard interactive glow className="glass-card">
            <DashboardCardHeader title="Plan result" icon={Target} />
            <DashboardCardBody className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <MetricTile label="Risk amount" value={`$${plan.riskAmount.toFixed(2)}`} />
                <MetricTile label="R:R" value={formatRiskReward(plan.rr)} />
                <MetricTile label="SL pips" value={plan.slPips.toFixed(1)} />
                <MetricTile label="TP pips" value={plan.tpPips.toFixed(1)} />
                <MetricTile
                  label={
                    <>
                      <span className="text-amber-400">Est.</span> std lots
                    </>
                  }
                  value={formatLotSize(plan.recommendedLots)}
                  hint="USD account · 100k units"
                />
                <MetricTile label="Pip value / lot" value={`$${plan.pipValuePerStandardLot.toFixed(2)}`} />
              </div>

              <DashboardInsetPanel
                className={cn(
                  "px-3 py-2.5",
                  plan.suggestedAction === "plan_valid"
                    ? "border-profit/20 bg-profit/[0.06]"
                    : plan.suggestedAction === "adjust_plan"
                      ? "border-amber-500/20 bg-amber-500/[0.06]"
                      : "border-loss/20 bg-loss/[0.06]",
                )}
              >
                <div className="flex items-start gap-2">
                  {plan.suggestedAction === "plan_valid" ? (
                    <CheckCircle2 className="mt-0.5 size-4 text-profit" />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-4 text-amber-300" />
                  )}
                  <p className="text-[12px] leading-relaxed text-foreground/90">{plan.suggestedActionLabel}</p>
                </div>
              </DashboardInsetPanel>

              {plan.warnings.length > 0 ? (
                <div className="space-y-1.5">
                  {plan.warnings.map((warning) => (
                    <DashboardInsetPanel
                      key={warning.id}
                      className="border-amber-500/20 bg-amber-500/[0.05] px-3 py-2"
                    >
                      <p className="text-[11px] leading-relaxed text-amber-100/90">{warning.message}</p>
                    </DashboardInsetPanel>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  className="w-full bg-cyan-glow text-black hover:bg-cyan-glow/90"
                  disabled={!canSave || isSaving}
                  onClick={() => void handleSavePlan()}
                >
                  <Save className="mr-2 size-4" />
                  {isSaving ? "Saving plan..." : "Save pre-trade plan"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-cyan-glow/25 bg-cyan-glow/[0.06] text-cyan-glow hover:bg-cyan-glow/10"
                  disabled={!canCoach}
                  onClick={() => sendPlanToCoach()}
                >
                  <Brain className="mr-2 size-4" />
                  Run Coach check-in
                </Button>
              </div>
            </DashboardCardBody>
          </DashboardCard>

          <DashboardCard interactive className="glass-card">
            <DashboardCardHeader title="Recent plans" icon={Save} />
            <DashboardCardBody>
              {activePlans.length === 0 ? (
                <DashboardEmptyState
                  icon={Save}
                  title="No active plans"
                  description="Saved plans stay separate from post-trade journal entries."
                  className="min-h-[120px]"
                />
              ) : (
                <div className="space-y-2">
                  {activePlans.slice(0, 6).map((saved) => (
                    <DashboardInsetPanel key={saved.id} className="flex items-center justify-between px-3 py-2">
                      <div>
                        <p className="text-[12px] font-medium text-foreground/90">
                          {saved.pair} · {saved.direction}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70">
                          {new Date(saved.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right text-[11px] tabular-nums">
                        <p className="text-cyan-glow">{formatRiskReward(saved.rr)}</p>
                        <p className="text-muted-foreground/70">
                          <span className="text-amber-400/90">Est.</span> {formatLotSize(saved.recommendedLots)} lots
                        </p>
                      </div>
                    </DashboardInsetPanel>
                  ))}
                </div>
              )}

              {pastPlans.length > 0 ? (
                <div className="mt-4 border-t border-white/[0.06] pt-3">
                  <button
                    type="button"
                    onClick={() => setPastPlansOpen((open) => !open)}
                    className="flex w-full items-center justify-between text-left text-[11px] text-muted-foreground/80 hover:text-foreground/90"
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
                          className="flex items-center justify-between px-3 py-2 opacity-80"
                        >
                          <div>
                            <p className="text-[12px] font-medium text-foreground/85">
                              {saved.pair} · {saved.direction}
                            </p>
                            <p className="text-[10px] capitalize text-muted-foreground/65">
                              {saved.status} · {new Date(saved.created_at).toLocaleString()}
                            </p>
                          </div>
                          <p className="text-[11px] tabular-nums text-muted-foreground/70">
                            {formatRiskReward(saved.rr)}
                          </p>
                        </DashboardInsetPanel>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </DashboardCardBody>
          </DashboardCard>
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
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
        {label}
      </span>
      {children}
      {hint ? <span className="block text-[10px] leading-relaxed text-muted-foreground/60">{hint}</span> : null}
    </label>
  )
}

function MetricTile({
  label,
  value,
  hint,
}: {
  label: ReactNode
  value: string
  hint?: string
}) {
  return (
    <DashboardInsetPanel className="px-2.5 py-2 text-center">
      <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-foreground/90">{value}</p>
      {hint ? <p className="mt-0.5 text-[8px] text-muted-foreground/55">{hint}</p> : null}
    </DashboardInsetPanel>
  )
}
