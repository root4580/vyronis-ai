"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Brain,
  Camera,
  GitCompare,
  Loader2,
  RefreshCw,
  Shield,
  Sparkles,
  Tag,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { MistakeTagList } from "@/components/dashboard/mistake-tag-badge"
import { SetupScorePanel } from "@/components/dashboard/setup-score-panel"
import {
  analyzeTradeIntelligence,
  fetchTradeIntelligence,
} from "@/lib/intelligence/api-client"
import type { TradeIntelligenceBundle } from "@/lib/intelligence/trade-intelligence-types"
import { getTradeDisplayMistakeTags, normalizeMistakeLabel } from "@/lib/mistake-tags"
import { cn } from "@/lib/utils"

type TradeIntelligencePanelProps = {
  tradeId: string
  refreshKey?: number
  onScreenshotClick?: () => void
}

function verdictClass(verdict: string) {
  if (verdict === "strong") return "text-profit border-profit/20 bg-profit/[0.06]"
  if (verdict === "weak") return "text-loss border-loss/20 bg-loss/[0.06]"
  return "text-cyan-glow border-cyan-glow/20 bg-cyan-glow/[0.05]"
}

function patternSeverityClass(severity: string) {
  if (severity === "positive") return "border-profit/20 bg-profit/[0.06] text-profit/90"
  if (severity === "warning") return "border-loss/20 bg-loss/[0.06] text-loss/90"
  return "border-cyan-glow/15 bg-cyan-glow/[0.05] text-cyan-glow/90"
}

export function TradeIntelligencePanel({
  tradeId,
  refreshKey = 0,
  onScreenshotClick,
}: TradeIntelligencePanelProps) {
  const [bundle, setBundle] = useState<TradeIntelligenceBundle | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoSyncAttempted = useRef(false)

  useEffect(() => {
    autoSyncAttempted.current = false
  }, [tradeId])

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await fetchTradeIntelligence(tradeId)
      setBundle(result)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Intelligence unavailable")
      setBundle(null)
    } finally {
      setIsLoading(false)
    }
  }, [tradeId])

  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true)
    setError(null)
    try {
      const result = await analyzeTradeIntelligence(tradeId)
      setBundle(result.bundle)
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : "Analysis failed")
    } finally {
      setIsAnalyzing(false)
    }
  }, [tradeId])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  useEffect(() => {
    if (!bundle || autoSyncAttempted.current || isAnalyzing) return
    if (bundle.importSource === "mt5_webhook" && !bundle.syncedAt) {
      autoSyncAttempted.current = true
      void handleAnalyze()
    }
  }, [bundle, isAnalyzing, handleAnalyze])

  if (isLoading) {
    return (
      <DashboardInsetPanel className="flex min-h-[120px] items-center justify-center border-cyan-glow/15 bg-cyan-glow/[0.03]">
        <Loader2 className="size-5 animate-spin text-cyan-glow" />
      </DashboardInsetPanel>
    )
  }

  if (error && !bundle) {
    return (
      <DashboardInsetPanel className="space-y-2 border-loss/20 bg-loss/[0.04] px-3 py-3">
        <p className="text-[11px] text-loss/90">{error}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </DashboardInsetPanel>
    )
  }

  if (!bundle) return null

  const displayMistakeTags =
    bundle.tags.mistakeTags.length > 0
      ? bundle.tags.mistakeTags.map((raw, index) => ({
          id: `intel-tag-${index}`,
          label: normalizeMistakeLabel(raw),
          dangerous: false,
          source: "tag" as const,
        }))
      : getTradeDisplayMistakeTags({
          direction: "BUY",
          result: "WIN",
          pnl: 0,
          emotion: bundle.tags.emotion,
          emotion_after: bundle.tags.emotionAfter,
          risk_percent: null,
          rule_followed: null,
          confirmation_signal: null,
          mistake_tags: null,
        })

  return (
    <div className="space-y-4">
      <DashboardInsetPanel className="space-y-3 border-cyan-glow/20 bg-cyan-glow/[0.04] px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Brain className="size-4 text-cyan-glow" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-glow/90">
              Trade Intelligence
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 border-white/[0.1] text-[10px]"
            onClick={() => void handleAnalyze()}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <Loader2 className="mr-1 size-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 size-3" />
            )}
            Sync &amp; analyze
          </Button>
        </div>
        {bundle.importSource === "mt5_webhook" && (
          <p className="text-[9px] uppercase tracking-[0.08em] text-muted-foreground/60">Auto-synced trade</p>
        )}
        {bundle.syncedAt ? (
          <p className="text-[9px] text-muted-foreground/65">
            Memory synced {new Date(bundle.syncedAt).toLocaleString()}
          </p>
        ) : (
          <p className="text-[9px] text-warning-foreground/80">
            Intelligence not synced yet — use Sync &amp; analyze or wait for webhook post-ingest.
          </p>
        )}
      </DashboardInsetPanel>

      <DashboardInsetPanel className="glass space-y-3">
        <div className="flex items-center gap-2">
          <Tag className="size-4 text-cyan-glow" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">Trade Tags</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-[10px]">
            {bundle.tags.setup}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {bundle.tags.emotion}
          </Badge>
          {bundle.tags.emotionAfter && (
            <Badge variant="outline" className="text-[10px]">
              After: {bundle.tags.emotionAfter}
            </Badge>
          )}
          {bundle.tags.strategyName && (
            <Badge variant="outline" className="text-[10px]">
              {bundle.tags.strategyName}
            </Badge>
          )}
          {bundle.tags.session && (
            <Badge variant="outline" className="text-[10px]">
              {bundle.tags.session}
            </Badge>
          )}
        </div>
        {bundle.tags.mistakeTags.length > 0 ? (
          <MistakeTagList tags={displayMistakeTags} size="sm" />
        ) : (
          <p className="text-[11px] text-muted-foreground/70">No mistake tags on this trade.</p>
        )}
        {bundle.tags.suggestedTags.length > 0 && (
          <p className="text-[10px] text-muted-foreground/65">
            Suggested from journal data: {bundle.tags.suggestedTags.join(", ")}
          </p>
        )}
      </DashboardInsetPanel>

      <SetupScorePanel result={bundle.setupScore} />

      <DashboardInsetPanel className="glass space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-cyan-glow" />
            <p className="text-[11px] font-semibold">Discipline score</p>
          </div>
          <span
            className={cn(
              "text-2xl font-bold tabular-nums",
              bundle.disciplineScore >= 75
                ? "text-profit"
                : bundle.disciplineScore >= 50
                  ? "text-warning-foreground"
                  : "text-loss",
            )}
          >
            {bundle.disciplineScore}
          </span>
        </div>
        <Progress value={bundle.disciplineScore} className="h-2 bg-white/[0.06]" />
        <p className="text-[10px] text-muted-foreground/70">
          Source: {bundle.disciplineSource.replace("_", " ")} — rules, risk, emotion, and coach feedback combined.
        </p>
      </DashboardInsetPanel>

      <DashboardInsetPanel className="glass space-y-3">
        <p className="text-[11px] font-semibold">Emotion tracking</p>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div>
            <span className="text-muted-foreground/60">Before</span>
            <p className="font-medium">
              {bundle.emotion.before.emoji} {bundle.emotion.before.label}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground/60">After</span>
            <p className="font-medium">
              {bundle.emotion.after
                ? `${bundle.emotion.after.emoji} ${bundle.emotion.after.label}`
                : "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground/70">Stability (recent journal)</span>
          <span className="font-semibold tabular-nums text-cyan-glow">
            {bundle.emotion.emotionalStabilityScore}
          </span>
        </div>
        {bundle.emotion.insight && (
          <p className="text-[11px] leading-relaxed text-foreground/85">{bundle.emotion.insight}</p>
        )}
      </DashboardInsetPanel>

      <DashboardInsetPanel className="glass space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Camera className="size-4 text-cyan-glow" />
            <p className="text-[11px] font-semibold">{bundle.screenshot.label}</p>
          </div>
          {bundle.screenshot.attached && onScreenshotClick && (
            <Button type="button" size="sm" variant="ghost" className="h-7 text-[10px]" onClick={onScreenshotClick}>
              Open
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground/75">{bundle.screenshot.message}</p>
      </DashboardInsetPanel>

      <DashboardInsetPanel className="space-y-3 border-cyan-glow/15 bg-cyan-glow/[0.03]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-cyan-glow" />
            <p className="text-[11px] font-semibold">AI trade analysis</p>
          </div>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase",
              verdictClass(bundle.analysis.verdict),
            )}
          >
            {bundle.analysis.verdict}
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-foreground/85">{bundle.analysis.summary}</p>
        {bundle.analysis.coachingFeedback.length > 0 && (
          <ul className="space-y-1 text-[11px] text-foreground/80">
            {bundle.analysis.coachingFeedback.map((point) => (
              <li key={point} className="list-inside list-disc">
                {point}
              </li>
            ))}
          </ul>
        )}
        {bundle.coachFeedback?.coaching_summary && (
          <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-[11px] text-muted-foreground/80">
            Coach: {bundle.coachFeedback.coaching_summary}
          </p>
        )}
      </DashboardInsetPanel>

      <DashboardInsetPanel className="glass space-y-3">
        <div className="flex items-center gap-2">
          <GitCompare className="size-4 text-cyan-glow" />
          <p className="text-[11px] font-semibold">Historical comparison</p>
        </div>
        <p className="text-[11px] text-muted-foreground/75">{bundle.historicalComparison.narrative}</p>
        {bundle.comparisonNarratives.map((line) => (
          <p key={line} className="text-[11px] leading-relaxed text-foreground/85">
            {line}
          </p>
        ))}
        {bundle.historicalComparison.topMatches.length > 0 && (
          <div className="space-y-1.5">
            {bundle.historicalComparison.topMatches.slice(0, 3).map((match) => (
              <div
                key={match.tradeId}
                className="flex items-center justify-between rounded-lg border border-white/[0.06] px-2 py-1.5 text-[10px]"
              >
                <span>
                  {match.pair} · {match.result}
                </span>
                <span className="tabular-nums text-cyan-glow">{match.similarityScore}% match</span>
              </div>
            ))}
          </div>
        )}
      </DashboardInsetPanel>

      <DashboardInsetPanel className="glass space-y-3">
        <p className="text-[11px] font-semibold">Win / loss patterns</p>
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-profit/90">
            <TrendingUp className="size-3.5" />
            Winning patterns
          </div>
          {bundle.winLossPatterns.winning.length === 0 ? (
            <p className="text-[10px] text-muted-foreground/65">No winning patterns flagged yet.</p>
          ) : (
            bundle.winLossPatterns.winning.slice(0, 3).map((pattern) => (
              <p
                key={pattern.id}
                className={cn("rounded-lg border px-2.5 py-2 text-[11px]", patternSeverityClass(pattern.severity))}
              >
                {pattern.message}
              </p>
            ))
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-loss/90">
            <TrendingDown className="size-3.5" />
            Losing patterns
          </div>
          {bundle.winLossPatterns.losing.length === 0 ? (
            <p className="text-[10px] text-muted-foreground/65">No losing patterns flagged yet.</p>
          ) : (
            bundle.winLossPatterns.losing.slice(0, 3).map((pattern) => (
              <p
                key={pattern.id}
                className={cn("rounded-lg border px-2.5 py-2 text-[11px]", patternSeverityClass(pattern.severity))}
              >
                {pattern.message}
              </p>
            ))
          )}
        </div>
      </DashboardInsetPanel>
    </div>
  )
}
