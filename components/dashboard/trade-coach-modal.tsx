"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef, useState } from "react"
import { Brain, ChevronDown, ClipboardList, Eye, Loader2, Send, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CoachWatchlistPairSelect } from "@/components/dashboard/coach-watchlist-pair-select"
import { CoachVerdictBadge } from "@/components/dashboard/coach-verdict-badge"
import { VyronisCoachAnalysisPanel } from "@/components/dashboard/vyronis-coach-analysis-panel"
import { CoachMtfUploadGrid } from "@/components/dashboard/coach-mtf-upload-grid"
import { SetupGradeBadge } from "@/components/command-center/setup-grade-badge"
import { CoachChartOverlayStrip } from "@/components/chart-annotations/coach-chart-overlay-strip"
import { ScreenshotViewerModal } from "@/components/dashboard/screenshot-viewer-modal"
import { resolveChartAnnotationsForTimeframe } from "@/lib/chart-annotations/session-overlays"
import { getProviderDisplayLabel } from "@/lib/ai/providers"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import type { ChartAnnotation } from "@/lib/chart-annotations/types"
import { TradeQualityPanel } from "@/components/dashboard/trade-quality-panel"
import {
  createCoachSession,
  fetchCoachSession,
  recordQualityOverride,
  runCoachMtfAnalysis,
  submitCoachAnswer,
} from "@/lib/trade-coach/api-client"
import {
  fetchStrategyPlaybooks,
  updateCoachSessionContext,
} from "@/lib/strategy/api-client"
import type { StrategyPlaybookRecord } from "@/lib/strategy/types"
import { MTF_TIMEFRAME_IDS } from "@/lib/coach/mtf-constants"
import { countMtfScreenshots, getMtfScreenshotsFromSession, resolveSessionMtfAnalysis } from "@/lib/trade-coach/mtf-session"
import {
  fetchWarRoomVisionAutofill,
  fetchWeeklyPlan,
  saveMarketBias,
  saveWeeklyPlan,
} from "@/lib/strategy-brain/api-client"
import {
  marketBiasInputFromVision,
  mergeAutofillIntoWeeklyPlan,
  plannedContextPatchFromVision,
} from "@/lib/trade-coach/coach-plan-autofill"
import { useToast } from "@/hooks/use-toast"
import type { MtfAnalysisResult } from "@/lib/coach/mtf-types"
import type { ChartVisionProviderId } from "@/lib/coach/types"
import {
  estimateQuestionCount,
  extractResponsesFromMessages,
  getActiveQuestionFromSession,
  getCoachWorkflowPhase,
  getQuestionByKey,
  isMtfAnalysisComplete,
  isTradePlannerCoachHandoff,
  validateAnswer,
  type CoachWorkflowPhase,
} from "@/lib/trade-coach/pre-trade-flow"
import type {
  PreTradePlannedContext,
  TradeCoachMessageRecord,
  TradeCoachSessionWithMessages,
} from "@/lib/trade-coach/types"
import { partitionCoachThreadMessages } from "@/lib/trade-coach/coach-message-display"
import { resolveTradeQualityFromSession } from "@/lib/trade-coach/trade-quality-utils"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"
import { TRADE_QUALITY_BLOCK_THRESHOLD } from "@/lib/trade-coach/trade-quality-engine"
import { MessageHistoryToggle } from "@/components/ui/message-history-toggle"
import { TradingViewAlertCoachSummary } from "@/components/tradingview/tradingview-alert-coach-summary"
import { cn } from "@/lib/utils"

const StrategyPlaybookMatchPanel = dynamic(
  () =>
    import("@/components/dashboard/strategy-playbook-match-panel").then(
      (module) => module.StrategyPlaybookMatchPanel,
    ),
  {
    ssr: false,
    loading: () => (
      <DashboardInsetPanel className="flex min-h-[80px] items-center justify-center px-3 py-4">
        <Loader2 className="size-4 animate-spin text-cyan-glow" />
      </DashboardInsetPanel>
    ),
  },
)

const MtfAnalysisPanel = dynamic(
  () =>
    import("@/components/dashboard/mtf-analysis-panel").then((module) => module.MtfAnalysisPanel),
  {
    ssr: false,
    loading: () => (
      <DashboardInsetPanel className="flex min-h-[120px] items-center justify-center px-3 py-6">
        <Loader2 className="size-5 animate-spin text-cyan-glow" />
      </DashboardInsetPanel>
    ),
  },
)

type TradeCoachPanelProps = {
  active: boolean
  embedded?: boolean
  showHeader?: boolean
  onClose?: () => void
  plannedContext: PreTradePlannedContext
  maxRiskPerTrade?: number
  sessionId?: string | null
  preloadedSession?: TradeCoachSessionWithMessages | null
  onSessionChange?: (sessionId: string | null) => void
  onSessionLoaded?: (session: TradeCoachSessionWithMessages) => void
  onCompleted?: (sessionId: string) => void
  onLogPlannedTrade?: (sessionId: string) => void
  onWorkflowPhaseChange?: (phase: CoachWorkflowPhase) => void
}

type TradeCoachModalProps = Omit<TradeCoachPanelProps, "active" | "embedded" | "showHeader"> & {
  open: boolean
  onClose: () => void
}

function CoachBubble({ message }: { message: TradeCoachMessageRecord }) {
  const isCoach = message.role === "coach"
  const isRedFlag = isCoach && message.content.startsWith("Red flag —")
  const isMtfEvent =
    !isCoach &&
    (message.content.includes("Multi-timeframe analysis") ||
      message.content.includes("Chart screenshot"))

  return (
    <div className={cn("flex", isCoach ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[88%] rounded-2xl px-3 py-2 text-[12px] leading-snug sm:px-3.5 sm:py-2.5 sm:text-[13px] sm:leading-relaxed",
          isCoach
            ? isRedFlag
              ? "border border-amber-500/25 bg-amber-500/[0.08] text-foreground/90"
              : "border border-cyan-glow/15 bg-cyan-glow/[0.06] text-foreground/90"
            : isMtfEvent
              ? "border border-profit/20 bg-profit/[0.06] text-foreground/90"
              : "border border-white/[0.08] bg-white/[0.05] text-foreground",
        )}
      >
        {message.content}
      </div>
    </div>
  )
}

export function TradeCoachPanel({
  active,
  embedded = false,
  showHeader = !embedded,
  onClose,
  plannedContext,
  maxRiskPerTrade = DEFAULT_USER_SETTINGS.max_risk_per_trade,
  sessionId,
  preloadedSession,
  onSessionChange,
  onSessionLoaded,
  onCompleted,
  onLogPlannedTrade,
  onWorkflowPhaseChange,
}: TradeCoachPanelProps) {
  const [session, setSession] = useState<TradeCoachSessionWithMessages | null>(null)
  const [draft, setDraft] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isAutofilling, setIsAutofilling] = useState(false)
  const { toast } = useToast()
  const [error, setError] = useState<string | null>(null)
  const [riskAcknowledged, setRiskAcknowledged] = useState(false)
  const [isRecordingOverride, setIsRecordingOverride] = useState(false)
  const [playbooks, setPlaybooks] = useState<StrategyPlaybookRecord[]>([])
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string | null>(null)
  const [isUpdatingPlaybook, setIsUpdatingPlaybook] = useState(false)
  const [chartViewer, setChartViewer] = useState<{
    url: string
    title: string
    annotations: ChartAnnotation[]
  } | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const previousSessionStatusRef = useRef<string | null>(null)
  const tradePlannerAutoMtfRef = useRef(false)
  const [mtfDetailsOpen, setMtfDetailsOpen] = useState(false)

  const mtfAnalysis = useMemo(() => {
    if (!session) return null
    const resolved = resolveSessionMtfAnalysis(session)
    if (!resolved) return null

    const provider =
      resolved.provider ||
      session.vision_provider ||
      session.planned_context?.visual_analysis?.provider ||
      undefined

    const visualAnalysis =
      resolved.visualAnalysis ||
      session.visual_analysis ||
      session.planned_context?.visual_analysis ||
      undefined

    if (provider === resolved.provider && visualAnalysis === resolved.visualAnalysis) {
      return resolved
    }

    return {
      ...resolved,
      provider: provider as ChartVisionProviderId | undefined,
      visualAnalysis,
    } as MtfAnalysisResult
  }, [session])

  const analysisHasRun = useMemo(() => {
    if (!session) return false
    if (mtfAnalysis) return true
    return session.messages.some((message) =>
      message.content.includes("Multi-timeframe analysis run"),
    )
  }, [session, mtfAnalysis])

  const visionProvider = useMemo(() => {
    if (mtfAnalysis?.provider || mtfAnalysis?.visualAnalysis?.provider) {
      return mtfAnalysis.provider || mtfAnalysis.visualAnalysis?.provider || null
    }
    if (session?.vision_provider || session?.planned_context?.visual_analysis?.provider) {
      return session.vision_provider || session.planned_context?.visual_analysis?.provider || null
    }
    const visionMessage = session?.messages.find(
      (message) =>
        message.role === "coach" &&
        (message.content.includes("GPT-4 Vision") || message.content.includes("GPT Vision")),
    )
    if (visionMessage) return "openai" as const
    return null
  }, [mtfAnalysis, session])

  const visionEngineLabel = useMemo(() => {
    if (!visionProvider) return null
    const model = session?.planned_context?.visual_analysis?.model
    return getProviderDisplayLabel(visionProvider, model)
  }, [visionProvider, session])

  const playbookMatch = useMemo(() => {
    if (!session) return null
    return (
      session.planned_context?.playbook_match ??
      mtfAnalysis?.playbookMatch ??
      null
    )
  }, [session, mtfAnalysis])

  const activeQuestion = useMemo(
    () =>
      session
        ? getActiveQuestionFromSession(
            session.messages,
            session.planned_context,
            session.chart_url,
            session,
          )
        : null,
    [session],
  )
  const questionDef = useMemo(
    () => (activeQuestion ? getQuestionByKey(activeQuestion.key) : null),
    [activeQuestion],
  )

  const responses = useMemo(
    () => (session ? extractResponsesFromMessages(session.messages) : {}),
    [session],
  )

  const totalQuestions = useMemo(() => estimateQuestionCount(), [])

  const workflowPhase = useMemo((): CoachWorkflowPhase => {
    if (!session) return "upload"
    return getCoachWorkflowPhase({
      status: session.status,
      chartUrl: session.chart_url,
      plannedContext: session.planned_context,
      responses,
      session,
    })
  }, [session, responses])

  useEffect(() => {
    onWorkflowPhaseChange?.(workflowPhase)
  }, [workflowPhase, onWorkflowPhaseChange])

  useEffect(() => {
    if (workflowPhase !== "questions") setMtfDetailsOpen(false)
  }, [workflowPhase])

  const uploadFocusMode =
    embedded &&
    workflowPhase === "upload" &&
    session?.planned_context?.signal_source !== "tradingview"
  const collapseMtfForCheckIn = embedded && workflowPhase === "questions" && !mtfDetailsOpen

  const coachAnalysis = session?.planned_context?.coach_analysis
  const vyronisCoach = coachAnalysis?.vyronisCoach
  const tradeQuality = resolveTradeQualityFromSession(session)

  useEffect(() => {
    if (!active) return

    let cancelled = false

    async function bootstrap() {
      setError(null)
      setDraft("")
      setRiskAcknowledged(false)

      if (sessionId && preloadedSession?.id === sessionId) {
        setSession(preloadedSession)
        setIsLoading(false)
        return
      }

      setIsLoading(true)

      try {
        if (sessionId) {
          const existing = await fetchCoachSession(sessionId)
          if (!cancelled) {
            setSession(existing)
            onSessionLoaded?.(existing)
          }
          return
        }

        const contextWithRisk = {
          ...plannedContext,
          max_risk_per_trade: maxRiskPerTrade,
        }
        const created = await createCoachSession(contextWithRisk, maxRiskPerTrade)
        if (cancelled) return
        setSession(created)
        onSessionChange?.(created.id)
      } catch (bootstrapError) {
        if (!cancelled) {
          setError(
            bootstrapError instanceof Error
              ? bootstrapError.message
              : "Could not start coach session",
          )
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [
    active,
    sessionId,
    preloadedSession,
    maxRiskPerTrade,
    plannedContext,
    onSessionChange,
    onSessionLoaded,
  ])

  useEffect(() => {
    if (!active || !sessionId || !preloadedSession || preloadedSession.id !== sessionId) return
    setSession(preloadedSession)
    setIsLoading(false)
  }, [active, sessionId, preloadedSession])

  useEffect(() => {
    if (!active) return

    void fetchStrategyPlaybooks()
      .then((rows) => {
        setPlaybooks(rows)
      })
      .catch(() => {
        setPlaybooks([])
      })
  }, [active])

  useEffect(() => {
    if (!session) return
    setSelectedPlaybookId(session.planned_context?.strategy_playbook_id ?? null)
  }, [session?.id, session?.planned_context?.strategy_playbook_id])

  async function handleWatchlistPair(context: PreTradePlannedContext) {
    if (!session) return
    setIsUpdatingPlaybook(true)
    setError(null)
    try {
      const updated = await updateCoachSessionContext(session.id, {
        pair: context.pair,
        direction: context.direction,
        strategy_name: context.strategy_name ?? undefined,
        higher_timeframe: context.higher_timeframe,
        entry_timeframe: context.entry_timeframe,
        confirmation_timeframe: context.confirmation_timeframe,
      })
      setSession(updated)
      onSessionChange?.(updated.id)
    } catch (pairError) {
      setError(pairError instanceof Error ? pairError.message : "Could not set pair")
    } finally {
      setIsUpdatingPlaybook(false)
    }
  }

  async function handlePlaybookChange(playbookId: string) {
    if (!session) return
    const playbook = playbooks.find((row) => row.id === playbookId)
    if (!playbook) return

    setIsUpdatingPlaybook(true)
    setError(null)
    try {
      const updated = await updateCoachSessionContext(session.id, {
        strategy_playbook_id: playbook.id,
        strategy_name: playbook.strategy_name,
      })
      setSession(updated)
      setSelectedPlaybookId(playbook.id)
      onSessionChange?.(updated.id)
    } catch (playbookError) {
      setError(
        playbookError instanceof Error ? playbookError.message : "Could not update strategy playbook",
      )
    } finally {
      setIsUpdatingPlaybook(false)
    }
  }

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [session?.messages.length, mtfAnalysis, active])

  useEffect(() => {
    if (!active) {
      previousSessionStatusRef.current = null
      return
    }
  }, [active])

  useEffect(() => {
    if (!session) return

    const previousStatus = previousSessionStatusRef.current
    previousSessionStatusRef.current = session.status

    const justCompleted =
      (session.status === "completed" || session.status === "linked") &&
      previousStatus === "in_progress"

    if (justCompleted) {
      onCompleted?.(session.id)
    }
  }, [session?.id, session?.status, onCompleted])

  async function handleAutofillFromCharts() {
    if (!session) return
    const screenshots = getMtfScreenshotsFromSession(session)
    const imageUrls = MTF_TIMEFRAME_IDS.map((tf) => screenshots[tf]).filter(
      (url): url is string => Boolean(url),
    )
    if (imageUrls.length === 0) {
      setError("Upload at least one chart screenshot first.")
      return
    }

    setIsAutofilling(true)
    setError(null)
    try {
      const autofill = await fetchWarRoomVisionAutofill({
        imageUrls,
        pairHint: session.planned_context?.pair,
      })

      const contextPatch = plannedContextPatchFromVision(autofill)
      const updated = await updateCoachSessionContext(session.id, {
        pair: contextPatch.pair,
        direction: contextPatch.direction,
        strategy_name: contextPatch.strategy_name ?? undefined,
        higher_timeframe: contextPatch.higher_timeframe,
        entry_timeframe: contextPatch.entry_timeframe,
        confirmation_timeframe: contextPatch.confirmation_timeframe,
      })
      setSession(updated)
      onSessionChange?.(updated.id)

      try {
        const weekPlan = await fetchWeeklyPlan().catch(() => null)
        await saveWeeklyPlan({
          week_start: weekPlan?.week_start,
          session_notes: weekPlan?.session_notes ?? "",
          pairs: mergeAutofillIntoWeeklyPlan(weekPlan, autofill, imageUrls),
        })
        await saveMarketBias(marketBiasInputFromVision(autofill))
      } catch {
        // War Room tables optional — coach autofill still applied
      }

      toast({
        title: "Plan autofilled",
        description: autofill.available
          ? `${autofill.pair} · ${autofill.inferredStack} — review AOI prices, then run MTF analysis.`
          : autofill.comparisonSummary,
      })
    } catch (autofillError) {
      const message =
        autofillError instanceof Error ? autofillError.message : "Autofill failed"
      setError(message)
      toast({ title: "Autofill failed", description: message, variant: "destructive" })
    } finally {
      setIsAutofilling(false)
    }
  }

  async function handleRunMtfAnalysis() {
    if (!session) return
    setIsAnalyzing(true)
    setError(null)
    try {
      const updated = await runCoachMtfAnalysis(session.id)
      setSession(updated)
      onSessionChange?.(updated.id)
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Could not analyze charts")
    } finally {
      setIsAnalyzing(false)
    }
  }

  useEffect(() => {
    tradePlannerAutoMtfRef.current = false
  }, [session?.id])

  useEffect(() => {
    if (!active || !session || tradePlannerAutoMtfRef.current || isAnalyzing) return
    if (!isTradePlannerCoachHandoff(session.planned_context)) return
    if (resolveSessionMtfAnalysis(session)) return
    if (countMtfScreenshots(getMtfScreenshotsFromSession(session)) === 0) return

    tradePlannerAutoMtfRef.current = true
    void handleRunMtfAnalysis()
  }, [active, session, isAnalyzing])

  async function handleSubmitAnswer() {
    if (!session || !activeQuestion || !questionDef) return

    const validationError = validateAnswer(questionDef, draft)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const updated = await submitCoachAnswer(session.id, activeQuestion.key, draft.trim())
      setSession(updated)
      setDraft("")
      onSessionChange?.(updated.id)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save answer")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRiskOverride() {
    if (!session || !riskAcknowledged) return
    setIsRecordingOverride(true)
    setError(null)
    try {
      const updated = await recordQualityOverride(session.id)
      setSession((current) =>
        current ? { ...current, quality_override: updated.quality_override } : current,
      )
    } catch (overrideError) {
      setError(overrideError instanceof Error ? overrideError.message : "Could not save override")
    } finally {
      setIsRecordingOverride(false)
    }
  }

  const hideCoachNarrativeWhenMtf = Boolean(mtfAnalysis && workflowPhase !== "upload")
  const { visible: visibleCoachMessages, history: historyCoachMessages } = useMemo(() => {
    const partitioned = partitionCoachThreadMessages(session?.messages ?? [], {
      hideNarrativeWhenMtfVisible: hideCoachNarrativeWhenMtf,
    })
    if (workflowPhase !== "questions" || !activeQuestion?.key) {
      return partitioned
    }
    const pendingPrompt = partitioned.visible.filter(
      (message) =>
        message.role === "coach" && message.question_key === activeQuestion.key,
    )
    return {
      visible: partitioned.visible.filter(
        (message) =>
          !(message.role === "coach" && message.question_key === activeQuestion.key),
      ),
      history: [...pendingPrompt, ...partitioned.history],
    }
  }, [
    session?.messages,
    hideCoachNarrativeWhenMtf,
    workflowPhase,
    activeQuestion?.key,
  ])

  if (!active) return null

  const isComplete = workflowPhase === "complete"
  const requiresOverride =
    !!tradeQuality?.blockExecution && !session?.quality_override && isComplete
  const answeredCount = session?.messages.filter((message) => message.role === "user").length ?? 0
  const questionProgress = Math.min(
    answeredCount > 0
      ? answeredCount - (isMtfAnalysisComplete(session) ? 1 : 0)
      : 0,
    totalQuestions,
  )

  const shouldTakeLabel =
    coachAnalysis?.shouldTakeTrade === "yes"
      ? "Yes — proceed with discipline"
      : coachAnalysis?.shouldTakeTrade === "caution"
        ? "Proceed with caution"
        : coachAnalysis?.shouldTakeTrade === "no"
          ? "Consider skipping this trade"
          : null

  const statusLabel =
    workflowPhase === "upload"
      ? "Upload MTF charts"
      : workflowPhase === "questions"
        ? `Quick check · ${questionProgress}/${totalQuestions}`
        : "Complete"

  const panelBody = (
    <>
      {showHeader ? (
        <header className="trade-coach-modal-header relative sticky top-0 z-20 shrink-0 border-b border-white/[0.06] px-4 py-3.5 md:px-6 md:py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl border border-cyan-glow/25 bg-cyan-glow/[0.1]">
                <Brain className="size-4 text-cyan-glow" />
              </div>
              <div>
                <h2 id="trade-coach-title" className="text-[16px] font-semibold tracking-tight text-foreground">
                  AI Trade Coach
                </h2>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <p className="text-[11px] text-muted-foreground/70">
                    Multi-timeframe pre-trade · {statusLabel}
                  </p>
                  {visionEngineLabel && analysisHasRun && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]",
                        visionProvider === "openai"
                          ? "border-cyan-glow/30 bg-cyan-glow/[0.1] text-cyan-glow"
                          : "border-white/[0.1] bg-white/[0.04] text-muted-foreground/75",
                      )}
                    >
                      <Eye className="size-3" />
                      {visionEngineLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-[10px] border border-white/[0.08] bg-white/[0.04] p-2 transition-all hover:bg-white/[0.06]"
                aria-label="Close coach"
              >
                <X className="size-5 text-muted-foreground" />
              </button>
            ) : null}
          </div>
        </header>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          ref={scrollRef}
          className={cn(
            "trade-coach-modal-scroll mobile-safe-scroll min-h-0 flex-1 touch-pan-y space-y-2 overflow-y-auto px-3 py-2 sm:space-y-3 sm:px-4 sm:py-3 md:px-6 md:py-4",
            uploadFocusMode && "max-h-0 flex-none overflow-hidden p-0 opacity-0",
          )}
        >
          {isLoading ? (
            <div className="flex min-h-[240px] items-center justify-center">
              <Loader2 className="size-6 animate-spin text-cyan-glow" />
            </div>
          ) : (
            <>
              {session?.planned_context?.signal_source === "tradingview" ? (
                <TradingViewAlertCoachSummary plannedContext={session.planned_context} />
              ) : null}
              {mtfAnalysis && workflowPhase !== "upload" && collapseMtfForCheckIn ? (
                <DashboardInsetPanel className="border-cyan-glow/15 bg-cyan-glow/[0.03] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
                        Analysis complete
                      </p>
                      <p className="mt-0.5 truncate text-[12px] font-medium text-foreground/90">
                        {mtfAnalysis.overallScore}/100 · {mtfAnalysis.recommendation} · scroll down for check-in
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 border-white/[0.1] text-[11px]"
                      onClick={() => setMtfDetailsOpen(true)}
                    >
                      Details
                      <ChevronDown className="ml-1 size-3.5" />
                    </Button>
                  </div>
                </DashboardInsetPanel>
              ) : null}
              {mtfAnalysis && workflowPhase !== "upload" && !collapseMtfForCheckIn ? (
                <MtfAnalysisPanel
                  analysis={mtfAnalysis}
                  session={session}
                  compact={workflowPhase === "questions"}
                  onOpenChart={({ url, title, timeframe }) => {
                    setChartViewer({
                      url,
                      title,
                      annotations: resolveChartAnnotationsForTimeframe({
                        session,
                        analysis: mtfAnalysis,
                        timeframe,
                      }),
                    })
                  }}
                />
              ) : null}

              {playbookMatch && workflowPhase !== "upload" && !collapseMtfForCheckIn && (
                <StrategyPlaybookMatchPanel
                  match={playbookMatch}
                  compact={workflowPhase === "questions"}
                />
              )}

              {visibleCoachMessages.map((message) => (
                <CoachBubble key={message.id} message={message} />
              ))}
              <MessageHistoryToggle count={historyCoachMessages.length} label="coach messages">
                {historyCoachMessages.map((message) => (
                  <CoachBubble key={message.id} message={message} />
                ))}
              </MessageHistoryToggle>

              {embedded && isComplete && tradeQuality ? (
                <TradeQualityPanel
                  quality={tradeQuality}
                  compact
                  warRoomAlertGrade={
                    session?.planned_context?.tradingview_setup_grade ?? null
                  }
                />
              ) : null}
            </>
          )}

          {error && (
            <DashboardInsetPanel className="border-loss/20 bg-loss/[0.06] px-3 py-2.5">
              <p className="text-[12px] text-loss/90">{error}</p>
            </DashboardInsetPanel>
          )}
        </div>

        <footer
          className={cn(
            "trade-coach-modal-footer shrink-0 border-t border-white/[0.06] bg-[rgba(6,10,14,0.96)] px-3 py-2.5 backdrop-blur-md sm:px-4 sm:py-3.5 md:px-6 md:py-4",
            embedded ? "trade-coach-footer-embedded" : "mobile-form-footer relative",
            workflowPhase === "upload"
              ? "mobile-form-footer--upload overflow-visible"
              : embedded && workflowPhase === "questions"
                ? "shrink-0"
                : embedded
                  ? "max-h-[min(46dvh,420px)] overflow-y-auto overscroll-contain"
                  : "overflow-y-auto sm:max-h-[min(38vh,340px)]",
            uploadFocusMode && "min-h-0 flex-1 overflow-y-auto",
          )}
        >
          {isComplete ? (
            <div className="space-y-3">
              {mtfAnalysis && session && (
                <CoachChartOverlayStrip
                  session={session}
                  analysis={mtfAnalysis}
                  compact
                  onOpenChart={(chart) => setChartViewer(chart)}
                />
              )}

              {tradeQuality && !embedded ? (
                <TradeQualityPanel
                  quality={tradeQuality}
                  warRoomAlertGrade={
                    session?.planned_context?.tradingview_setup_grade ?? null
                  }
                />
              ) : null}

              {requiresOverride && (
                <DashboardInsetPanel className="border-loss/25 bg-loss/[0.06] px-3 py-3">
                  <p className="text-[12px] font-medium text-loss/95">
                    High probability low-quality execution detected.
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/75">
                    Quality score is below {TRADE_QUALITY_BLOCK_THRESHOLD}. Acknowledge the risk before continuing.
                  </p>
                  <label className="mt-3 flex items-start gap-2 text-[11px] text-foreground/85">
                    <input
                      type="checkbox"
                      checked={riskAcknowledged}
                      onChange={(event) => setRiskAcknowledged(event.target.checked)}
                      className="mt-0.5"
                    />
                    I understand the risks
                  </label>
                  <Button
                    type="button"
                    disabled={!riskAcknowledged || isRecordingOverride}
                    onClick={() => void handleRiskOverride()}
                    className="mt-3 h-9 w-full border-loss/25 bg-loss/[0.12] text-loss hover:bg-loss/[0.18]"
                    variant="outline"
                  >
                    {isRecordingOverride ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Acknowledge and Continue"
                    )}
                  </Button>
                </DashboardInsetPanel>
              )}

              {!requiresOverride && (
                <div className="space-y-3">
                  <DashboardInsetPanel className="border-profit/20 bg-profit/[0.06] px-3 py-3">
                    <div className="flex items-start gap-2">
                      <Sparkles className="mt-0.5 size-4 shrink-0 text-profit" />
                      <div className="space-y-2">
                        <p className="text-[12px] font-medium text-foreground/90">Pre-trade plan saved</p>
                        {mtfAnalysis && (
                          <p className="text-[11px] font-medium text-foreground/85">
                            MTF recommendation: {mtfAnalysis.recommendation}
                          </p>
                        )}
                        {coachAnalysis && !tradeQuality && shouldTakeLabel && (
                          <p className="text-[11px] text-muted-foreground/75">{shouldTakeLabel}</p>
                        )}
                        <p className="text-[11px] leading-relaxed text-muted-foreground/75">
                          Log the trade to link plan vs outcome and unlock coach review.
                        </p>
                      </div>
                    </div>
                  </DashboardInsetPanel>
                  {onLogPlannedTrade && session ? (
                    <Button
                      type="button"
                      onClick={() => onLogPlannedTrade(session.id)}
                      className="h-11 w-full bg-gradient-to-r from-cyan-glow to-profit text-background"
                    >
                      <ClipboardList className="mr-2 size-4" />
                      Log this trade
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          ) : workflowPhase === "upload" && session ? (
            <div className="space-y-3">
              {error ? (
                <DashboardInsetPanel className="border-loss/20 bg-loss/[0.06] px-3 py-2.5">
                  <p className="text-[12px] text-loss/90">{error}</p>
                </DashboardInsetPanel>
              ) : null}
              <DashboardInsetPanel className="border-cyan-glow/20 bg-cyan-glow/[0.06] px-3 py-2.5">
                <p className="text-[12px] font-semibold text-foreground/90">
                  Upload charts — {session.planned_context.pair || "select pair below"}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/75">
                  Weekly, Daily, H4, H1, M15 in order. Use{" "}
                  <span className="text-foreground/85">Add 5 at once</span> or multi-select, then{" "}
                  <span className="text-foreground/85">Autofill</span> or{" "}
                  <span className="text-foreground/85">Run analysis</span>.
                </p>
              </DashboardInsetPanel>

              <CoachMtfUploadGrid
                session={session}
                disabled={isLoading || isSubmitting}
                onSessionUpdate={setSession}
                onAutofillFromCharts={handleAutofillFromCharts}
                isAutofilling={isAutofilling}
                onRunAnalysis={handleRunMtfAnalysis}
                isAnalyzing={isAnalyzing}
              />

              <CoachWatchlistPairSelect
                plannedContext={session.planned_context}
                disabled={isLoading || isUpdatingPlaybook}
                onPairSelected={(context) => void handleWatchlistPair(context)}
              />
              {playbooks.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                    Strategy Playbook
                  </p>
                  <Select
                    value={selectedPlaybookId || undefined}
                    onValueChange={(value) => void handlePlaybookChange(value)}
                    disabled={isUpdatingPlaybook || isLoading}
                  >
                    <SelectTrigger className="add-trade-input h-10 w-full">
                      <SelectValue placeholder="Select playbook for chart rule matching" />
                    </SelectTrigger>
                    <SelectContent className="z-[70] glass-card border-white/[0.08]">
                      {playbooks.map((playbook) => (
                        <SelectItem key={playbook.id} value={playbook.id}>
                          {playbook.strategy_name}
                          {playbook.is_default ? " (Default)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground/60">
                    Coach compares your MTF screenshots against this playbook after analysis.
                  </p>
                </div>
              )}
              {analysisHasRun && vyronisCoach ? (
                <VyronisCoachAnalysisPanel coach={vyronisCoach} />
              ) : analysisHasRun && (mtfAnalysis || coachAnalysis) ? (
                <CoachVerdictBadge
                  recommendation={mtfAnalysis?.recommendation}
                  shouldTakeTrade={coachAnalysis?.shouldTakeTrade}
                  className="w-full"
                />
              ) : null}
              {analysisHasRun && visionEngineLabel && (
                <DashboardInsetPanel className="border-cyan-glow/20 bg-cyan-glow/[0.06] px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-cyan-glow">
                      <Eye className="size-3.5" />
                      {visionEngineLabel}
                    </span>
                    {mtfAnalysis && (
                      <>
                        <span className="text-muted-foreground/50">·</span>
                        <span className="text-foreground/85">
                          Score {mtfAnalysis.overallScore}/100 · {mtfAnalysis.recommendation}
                        </span>
                        {(playbookMatch?.setupGrade ||
                          mtfAnalysis.playbookMatch?.setupGrade) && (
                          <SetupGradeBadge
                            grade={
                              playbookMatch?.setupGrade ??
                              mtfAnalysis.playbookMatch!.setupGrade
                            }
                            className="ml-1"
                          />
                        )}
                      </>
                    )}
                  </div>
                </DashboardInsetPanel>
              )}
            </div>
          ) : questionDef && activeQuestion ? (
            <div className="trade-coach-checkin space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-medium leading-snug text-foreground/92">
                  {activeQuestion.prompt}
                </p>
                <span className="shrink-0 rounded-md border border-cyan-glow/20 bg-cyan-glow/[0.06] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-cyan-glow">
                  {questionProgress + 1}/{totalQuestions}
                </span>
              </div>
              {questionDef.type === "select" ? (
                <>
                  <Select
                    value={draft || undefined}
                    onValueChange={(value) => {
                      setDraft(value)
                      setError(null)
                    }}
                  >
                    <SelectTrigger className="add-trade-input h-10 w-full">
                      <SelectValue placeholder="Select your emotional state" />
                    </SelectTrigger>
                    <SelectContent className="z-[70] glass-card border-white/[0.08]">
                      {(questionDef.options || []).map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    disabled={isSubmitting || isLoading || !draft}
                    onClick={() => void handleSubmitAnswer()}
                    className="trade-coach-checkin-submit h-10 w-full bg-cyan-glow text-background hover:bg-cyan-glow/90"
                  >
                    {isSubmitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Continue"
                    )}
                  </Button>
                </>
              ) : questionDef.type === "boolean" ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {["Yes", "No"].map((option) => (
                      <Button
                        key={option}
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-10 border-white/[0.08]",
                          draft === option && "border-cyan-glow/40 bg-cyan-glow/[0.08] text-cyan-glow",
                        )}
                        onClick={() => setDraft(option)}
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    disabled={isSubmitting || isLoading || !draft}
                    onClick={() => void handleSubmitAnswer()}
                    className="trade-coach-checkin-submit h-10 w-full bg-cyan-glow text-background hover:bg-cyan-glow/90"
                  >
                    {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Continue"}
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={questionDef.placeholder}
                    inputMode={activeQuestion.key === "planned_risk" ? "decimal" : undefined}
                    className="add-trade-input h-10 min-w-0 flex-1 text-[15px]"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void handleSubmitAnswer()
                    }}
                  />
                  <Button
                    type="button"
                    disabled={isSubmitting || isLoading || !draft.trim()}
                    onClick={() => void handleSubmitAnswer()}
                    className="trade-coach-checkin-submit h-10 shrink-0 px-4 bg-cyan-glow text-background hover:bg-cyan-glow/90"
                    aria-label="Submit answer"
                  >
                    {isSubmitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="size-4 sm:mr-1" />
                        <span className="hidden sm:inline">Submit</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </footer>
      </div>

      <ScreenshotViewerModal
        open={Boolean(chartViewer)}
        imageUrl={chartViewer?.url ?? null}
        title={chartViewer?.title}
        annotations={chartViewer?.annotations}
        defaultOverlayMode="overlay"
        onClose={() => setChartViewer(null)}
      />
    </>
  )

  if (embedded) {
    return (
      <div className="trade-coach-embedded-shell flex min-h-0 flex-1 flex-col overflow-hidden">
        {panelBody}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4 md:p-6">
      <div className="add-trade-backdrop absolute inset-0" onClick={onClose} aria-hidden />

      <div
        className="add-trade-modal glass-card relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden sm:max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-coach-title"
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-glow/[0.07] via-transparent to-profit/[0.04]" />
        {panelBody}
      </div>
    </div>
  )
}

/**
 * Standalone modal removed — pre-trade coach runs inside Command Center only.
 * Kept for API compatibility; renders nothing. Use `openPreTradeCoach` from AI context.
 */
export function TradeCoachModal(_props: TradeCoachModalProps) {
  return null
}
