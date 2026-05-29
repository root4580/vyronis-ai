"use client"

import { useMemo } from "react"
import {
  AlertTriangle,
  Calculator,
  Pencil,
  Plus,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { ChartUploadThumbnailStrip } from "@/components/ui/chart-upload-thumbnail-strip"
import { MistakeTagBadge } from "@/components/dashboard/mistake-tag-badge"
import { isDangerousMistakeLabel, normalizeMistakeLabel } from "@/lib/mistake-tags"
import {
  EMOTION_OPTIONS,
  MISTAKE_TAGS,
  NOTES_MAX_LENGTH,
  PRIMARY_SESSIONS,
  TRADE_DIRECTIONS,
  TRADE_PAIRS,
  TRADE_RESULTS,
  TRADE_SETUPS,
  TRADE_STRATEGIES,
  TRADING_SESSIONS,
  type TradeFormState,
} from "@/lib/trade-form-config"
import {
  calculatePositionSize,
  calculateRiskReward,
  formatRiskReward,
  suggestPnLFromResult,
} from "@/lib/trade-form-utils"
import { cn } from "@/lib/utils"

type AddTradeModalProps = {
  open: boolean
  onClose: () => void
  form: TradeFormState
  onFormChange: (updates: Partial<TradeFormState>) => void
  onSubmit: (e: React.FormEvent) => void
  isSubmitting: boolean
  isEditing: boolean
  startingBalance: number
  maxRiskPerTrade?: number
  isUploading: boolean
  uploadProgress: number
  isDragging: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onScreenshotUpload: (file: File) => void
  onScreenshotRemove: () => void
  onScreenshotPreview: () => void
  onOpenCoach?: () => void
  hasCoachSession?: boolean
  canRepeatLast?: boolean
  repeatSourceLabel?: string
  onRepeatLast?: () => void
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-glow/80">{children}</p>
  )
}

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <Label className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground/80">
      {children}
      {required && <span className="ml-1 text-loss">*</span>}
    </Label>
  )
}

function EmotionPicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <FieldLabel>{label}</FieldLabel>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-4">
        {EMOTION_OPTIONS.map((option) => {
          const active = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-lg border px-1.5 py-2 text-center transition-all duration-200",
                active
                  ? "border-cyan-glow/40 bg-cyan-glow/[0.12] shadow-[0_0_16px_rgba(34,211,238,0.12)]"
                  : "border-white/[0.06] bg-white/[0.02] hover:border-cyan-glow/20 hover:bg-cyan-glow/[0.04]",
              )}
            >
              <span className="block text-base leading-none">{option.emoji}</span>
              <span className="mt-1 block truncate text-[9px] text-muted-foreground/80">{option.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function AddTradeModal({
  open,
  onClose,
  form,
  onFormChange,
  onSubmit,
  isSubmitting,
  isEditing,
  startingBalance,
  maxRiskPerTrade = 1,
  isUploading,
  uploadProgress,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onScreenshotUpload,
  onScreenshotRemove,
  onScreenshotPreview,
  onOpenCoach,
  hasCoachSession = false,
  canRepeatLast = false,
  repeatSourceLabel,
  onRepeatLast,
}: AddTradeModalProps) {
  const riskReward = useMemo(() => calculateRiskReward(form), [form])
  const positionSize = useMemo(
    () => calculatePositionSize(form, startingBalance),
    [form, startingBalance],
  )

  const resultTone =
    form.result === "WIN" ? "profit" : form.result === "LOSS" ? "loss" : "neutral"

  const riskPercent = parseFloat(form.risk_percent)
  const isRiskTooHigh = Number.isFinite(riskPercent) && riskPercent > maxRiskPerTrade

  const toggleMistakeTag = (tag: string) => {
    const exists = form.mistake_tags.includes(tag)
    onFormChange({
      mistake_tags: exists
        ? form.mistake_tags.filter((t) => t !== tag)
        : [...form.mistake_tags, tag],
    })
  }

  const applySuggestedPnL = () => {
    const suggested = suggestPnLFromResult(form, startingBalance, riskReward)
    if (suggested) onFormChange({ pnl: suggested })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="add-trade-backdrop absolute inset-0" onClick={onClose} aria-hidden />

      <div
        className={cn(
          "add-trade-modal glass-card relative flex max-h-[94vh] w-full flex-col overflow-hidden sm:max-h-[90vh] sm:max-w-2xl",
          resultTone === "profit" && "add-trade-modal-win",
          resultTone === "loss" && "add-trade-modal-loss",
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-trade-title"
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-glow/[0.07] via-transparent to-profit/[0.05]" />
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-cyan-glow/[0.08] blur-3xl" />

        <div className="relative shrink-0 border-b border-white/[0.06] px-4 py-4 md:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl border border-cyan-glow/25 bg-cyan-glow/[0.1] shadow-[0_0_20px_rgba(34,211,238,0.12)]">
                {isEditing ? <Pencil className="size-4 text-cyan-glow" /> : <Plus className="size-4 text-cyan-glow" />}
              </div>
              <div>
                <h2 id="add-trade-title" className="text-[16px] font-semibold tracking-tight text-foreground">
                  {isEditing ? "Edit Trade" : "Add Trade"}
                </h2>
                <p className="text-[11px] text-muted-foreground/70">
                  Log execution, psychology, and performance in one place
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[10px] border border-transparent p-2 transition-colors hover:border-white/[0.06] hover:bg-white/[0.04]"
            >
              <X className="size-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="relative flex min-h-0 flex-1 flex-col">
          <div className="mobile-safe-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3 sm:space-y-5 sm:px-4 sm:py-4 md:px-6 md:py-5">
            <section className="space-y-3">
              <SectionLabel>Market Setup</SectionLabel>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel required>Pair</FieldLabel>
                  <Select value={form.pair} onValueChange={(v) => onFormChange({ pair: v })}>
                    <SelectTrigger className="add-trade-input h-10">
                      <SelectValue placeholder="Select pair" />
                    </SelectTrigger>
                    <SelectContent className="glass-card max-h-60 border-white/[0.08]">
                      {TRADE_PAIRS.map((pair) => (
                        <SelectItem key={pair} value={pair} className="focus:bg-cyan-glow/10">
                          {pair}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <FieldLabel required>Direction</FieldLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {TRADE_DIRECTIONS.map((direction) => {
                      const active = form.direction === direction
                      const isBuy = direction === "BUY"
                      return (
                        <button
                          key={direction}
                          type="button"
                          onClick={() => onFormChange({ direction })}
                          className={cn(
                            "flex h-10 items-center justify-center gap-2 rounded-lg border text-[13px] font-semibold transition-all duration-200",
                            active && isBuy
                              ? "border-profit/40 bg-profit/[0.12] text-profit shadow-[0_0_16px_rgba(34,197,94,0.12)]"
                              : active && !isBuy
                                ? "border-loss/40 bg-loss/[0.12] text-loss shadow-[0_0_16px_rgba(239,68,68,0.12)]"
                                : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:border-white/[0.12]",
                          )}
                        >
                          {isBuy ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                          {direction}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel>Session</FieldLabel>
                <div className="grid grid-cols-3 gap-2">
                  {PRIMARY_SESSIONS.map((session) => (
                    <button
                      key={session}
                      type="button"
                      onClick={() => onFormChange({ session })}
                      className={cn(
                        "rounded-lg border px-2 py-2 text-[11px] font-medium transition-all duration-200",
                        form.session === session
                          ? "border-cyan-glow/35 bg-cyan-glow/[0.1] text-cyan-glow"
                          : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:border-cyan-glow/20",
                      )}
                    >
                      {session}
                    </button>
                  ))}
                </div>
                <Select value={form.session} onValueChange={(v) => onFormChange({ session: v })}>
                  <SelectTrigger className="add-trade-input h-9">
                    <SelectValue placeholder="All sessions" />
                  </SelectTrigger>
                  <SelectContent className="glass-card border-white/[0.08]">
                    {TRADING_SESSIONS.map((session) => (
                      <SelectItem key={session} value={session}>
                        {session}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Strategy</FieldLabel>
                  <Select value={form.strategy_name} onValueChange={(v) => onFormChange({ strategy_name: v })}>
                    <SelectTrigger className="add-trade-input h-10">
                      <SelectValue placeholder="Select strategy" />
                    </SelectTrigger>
                    <SelectContent className="glass-card border-white/[0.08]">
                      {TRADE_STRATEGIES.map((strategy) => (
                        <SelectItem key={strategy} value={strategy}>
                          {strategy}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Setup</FieldLabel>
                  <Select value={form.setup} onValueChange={(v) => onFormChange({ setup: v })}>
                    <SelectTrigger className="add-trade-input h-10">
                      <SelectValue placeholder="Setup quality" />
                    </SelectTrigger>
                    <SelectContent className="glass-card border-white/[0.08]">
                      {TRADE_SETUPS.map((setup) => (
                        <SelectItem key={setup} value={setup}>
                          {setup}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <SectionLabel>Execution & Risk</SectionLabel>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { key: "entry_price" as const, label: "Entry Price" },
                  { key: "stop_loss" as const, label: "Stop Loss" },
                  { key: "take_profit" as const, label: "Take Profit" },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-2">
                    <FieldLabel>{label}</FieldLabel>
                    <Input
                      type="number"
                      step="0.00001"
                      value={form[key]}
                      onChange={(e) => onFormChange({ [key]: e.target.value })}
                      className="add-trade-input h-10 tabular-nums"
                      placeholder="0.00000"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DashboardInsetPanel className="glass border-cyan-glow/15 bg-cyan-glow/[0.04]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Target className="size-3.5 text-cyan-glow" />
                      <span className="text-[11px] font-medium text-muted-foreground/80">Auto R:R</span>
                    </div>
                    <span className="text-lg font-semibold tabular-nums text-cyan-glow">
                      {formatRiskReward(riskReward)}
                    </span>
                  </div>
                </DashboardInsetPanel>

                <DashboardInsetPanel className="glass border-white/[0.06]">
                  <div className="flex items-start gap-2">
                    <Calculator className="mt-0.5 size-3.5 shrink-0 text-cyan-glow" />
                    <div className="min-w-0 space-y-1">
                      <p className="text-[11px] font-medium text-muted-foreground/80">Position Size Helper</p>
                      {positionSize ? (
                        <>
                          <p className="text-[12px] font-semibold tabular-nums text-foreground">
                            {positionSize.units.toFixed(2)} units
                          </p>
                          <p className="text-[10px] text-muted-foreground/65">
                            Risk ${positionSize.riskAmount.toFixed(2)} · Stop distance {positionSize.pipRisk.toFixed(5)}
                          </p>
                        </>
                      ) : (
                        <p className="text-[10px] text-muted-foreground/60">Enter entry, stop, and risk %</p>
                      )}
                    </div>
                  </div>
                </DashboardInsetPanel>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel required>Risk %</FieldLabel>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={form.risk_percent}
                    onChange={(e) => onFormChange({ risk_percent: e.target.value })}
                    className={cn(
                      "add-trade-input h-10 tabular-nums",
                      isRiskTooHigh && "border-loss/40 text-loss",
                    )}
                  />
                  {isRiskTooHigh && (
                    <p className="flex items-center gap-1 text-[10px] text-loss">
                      <AlertTriangle className="size-3" />
                      Risk above {maxRiskPerTrade}%
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <FieldLabel>Trade Date</FieldLabel>
                  <Input
                    type="date"
                    value={form.trade_date}
                    onChange={(e) => onFormChange({ trade_date: e.target.value })}
                    className="dashboard-date-input add-trade-input h-10 border-white/[0.08] text-white"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <SectionLabel>Outcome</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {TRADE_RESULTS.map((result) => {
                  const active = form.result === result.value
                  return (
                    <button
                      key={result.value}
                      type="button"
                      onClick={() => {
                        const updates: Partial<TradeFormState> = { result: result.value }
                        const suggested = suggestPnLFromResult(
                          { ...form, result: result.value },
                          startingBalance,
                          riskReward,
                        )
                        if (suggested && !form.pnl) updates.pnl = suggested
                        onFormChange(updates)
                      }}
                      className={cn(
                        "rounded-lg border py-2.5 text-[12px] font-bold tracking-wide transition-all duration-200",
                        active && result.tone === "profit"
                          ? "border-profit/40 bg-profit/[0.12] text-profit shadow-[0_0_18px_rgba(34,197,94,0.14)]"
                          : active && result.tone === "loss"
                            ? "border-loss/40 bg-loss/[0.12] text-loss shadow-[0_0_18px_rgba(239,68,68,0.14)]"
                            : active
                              ? "border-white/20 bg-white/[0.06] text-foreground"
                              : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:border-white/[0.12]",
                      )}
                    >
                      {result.label}
                    </button>
                  )
                })}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel required>P&L ($)</FieldLabel>
                  <button
                    type="button"
                    onClick={applySuggestedPnL}
                    className="text-[10px] font-medium text-cyan-glow transition-colors hover:text-cyan-glow/80"
                  >
                    Auto-fill from risk
                  </button>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  value={form.pnl}
                  onChange={(e) => onFormChange({ pnl: e.target.value })}
                  className={cn(
                    "add-trade-input h-10 tabular-nums",
                    form.result === "LOSS" && "text-loss",
                    form.result === "WIN" && "text-profit",
                  )}
                  placeholder="150.00"
                />
              </div>

              <div
                className={cn(
                  "flex items-center justify-between rounded-lg border p-3 transition-colors",
                  form.rule_followed
                    ? "border-profit/25 bg-profit/[0.06]"
                    : "border-loss/25 bg-loss/[0.06]",
                )}
              >
                <span className="text-[12px] font-medium text-foreground/90">Rules followed</span>
                <Switch
                  checked={form.rule_followed}
                  onCheckedChange={(checked) => onFormChange({ rule_followed: checked })}
                  className="data-[state=checked]:bg-profit data-[state=unchecked]:bg-loss"
                />
              </div>
            </section>

            <section className="space-y-3">
              <SectionLabel>Psychology</SectionLabel>
              <EmotionPicker
                label="Emotion Before Trade"
                value={form.emotion}
                onChange={(emotion) => onFormChange({ emotion })}
              />
              <EmotionPicker
                label="Emotion After Trade"
                value={form.emotion_after}
                onChange={(emotion_after) => onFormChange({ emotion_after })}
              />

              <div className="space-y-2">
                <FieldLabel>Mistake Tags</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {MISTAKE_TAGS.map((tag) => {
                    const active = form.mistake_tags.includes(tag)
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleMistakeTag(tag)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all duration-200",
                          active
                            ? isDangerousMistakeLabel(normalizeMistakeLabel(tag))
                              ? "border-loss/35 bg-loss/[0.12] text-loss shadow-[0_0_12px_rgba(239,68,68,0.18)]"
                              : "border-amber-500/35 bg-amber-500/[0.12] text-amber-300"
                            : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:border-amber-500/20",
                        )}
                      >
                        {normalizeMistakeLabel(tag)}
                      </button>
                    )
                  })}
                </div>
                {form.mistake_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {form.mistake_tags.map((tag) => (
                      <MistakeTagBadge
                        key={tag}
                        tag={{
                          id: tag,
                          label: normalizeMistakeLabel(tag),
                          dangerous: isDangerousMistakeLabel(tag),
                          source: "tag",
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FieldLabel>Trade Notes</FieldLabel>
                  <span className="text-[10px] tabular-nums text-muted-foreground/60">
                    {form.trade_notes.length}/{NOTES_MAX_LENGTH}
                  </span>
                </div>
                <Textarea
                  value={form.trade_notes}
                  onChange={(e) =>
                    onFormChange({ trade_notes: e.target.value.slice(0, NOTES_MAX_LENGTH) })
                  }
                  placeholder="What happened? What would you repeat or avoid?"
                  className="add-trade-input min-h-[96px] resize-none"
                />
              </div>
            </section>

            <section className="space-y-2">
              <FieldLabel>Chart Screenshot</FieldLabel>
              {form.screenshot_url ? (
                <>
                  <div className="sm:hidden">
                    <ChartUploadThumbnailStrip
                      items={[
                        {
                          id: "screenshot",
                          url: form.screenshot_url,
                          label: "Chart",
                          alt: "Trade chart",
                        },
                      ]}
                      countLabel="1 chart uploaded"
                      onRemove={() => onScreenshotRemove()}
                      onPreview={() => onScreenshotPreview()}
                      disabled={isUploading}
                      canAdd={false}
                    />
                  </div>
                  <div className="relative hidden overflow-hidden rounded-xl border border-white/[0.08] bg-black/20 sm:block">
                    <img
                      src={form.screenshot_url}
                      alt="Trade chart"
                      className="dashboard-image-zoom h-36 w-full cursor-pointer object-cover"
                      onClick={onScreenshotPreview}
                    />
                    <button
                      type="button"
                      onClick={onScreenshotRemove}
                      className="absolute right-2 top-2 rounded-lg border border-white/[0.08] bg-background/80 p-1.5 hover:border-loss/40 hover:bg-loss/10"
                    >
                      <X className="size-4 text-muted-foreground" />
                    </button>
                    <Badge className="absolute bottom-2 left-2 border-profit/30 bg-background/80 text-profit">
                      Screenshot attached
                    </Badge>
                  </div>
                </>
              ) : (
                <label
                  className={cn(
                    "add-trade-dropzone flex h-20 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-300 sm:h-32",
                    isDragging
                      ? "scale-[1.01] border-cyan-glow bg-cyan-glow/[0.1] shadow-[0_0_24px_rgba(34,211,238,0.15)]"
                      : "border-white/[0.08] bg-white/[0.02] hover:border-cyan-glow/30 hover:bg-cyan-glow/[0.04]",
                  )}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                >
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) onScreenshotUpload(file)
                    }}
                    disabled={isUploading}
                  />
                  {isUploading ? (
                    <div className="flex w-full max-w-xs flex-col items-center gap-2 px-6">
                      <div className="size-8 animate-spin rounded-full border-2 border-cyan-glow/30 border-t-cyan-glow" />
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-glow to-profit transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-cyan-glow">{uploadProgress}% uploading</span>
                    </div>
                  ) : (
                    <>
                      <Upload className={cn("size-6", isDragging ? "text-cyan-glow" : "text-muted-foreground/60")} />
                      <p className="mt-2 text-[12px] text-muted-foreground/80">
                        {isDragging ? "Drop screenshot here" : "Drag & drop or click to upload"}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground/50">PNG, JPG, WebP up to 10MB</p>
                    </>
                  )}
                </label>
              )}
            </section>
          </div>

          <div className="mobile-form-footer relative shrink-0 border-t border-white/[0.06] bg-black/20 px-3 py-3 backdrop-blur-md sm:px-4 sm:py-4 md:px-6">
            {canRepeatLast && onRepeatLast && !isEditing && (
              <Button
                type="button"
                variant="outline"
                onClick={onRepeatLast}
                className="mb-3 h-10 w-full border-white/[0.1] bg-white/[0.03] text-[12px] text-foreground/85 hover:bg-white/[0.06]"
              >
                Repeat last setup
                {repeatSourceLabel ? (
                  <span className="ml-1.5 text-muted-foreground/60">· {repeatSourceLabel}</span>
                ) : null}
              </Button>
            )}
            {onOpenCoach && !isEditing && (
              <Button
                type="button"
                variant="outline"
                onClick={onOpenCoach}
                className="mb-3 h-11 w-full border-cyan-glow/20 bg-cyan-glow/[0.04] text-cyan-glow hover:bg-cyan-glow/[0.08]"
              >
                <Sparkles className="mr-2 size-4" />
                {hasCoachSession ? "Continue Pre-Trade Coach" : "Start Pre-Trade Coach"}
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting || isUploading}
              className="mobile-sticky-submit h-11 w-full bg-gradient-to-r from-cyan-glow to-profit text-sm font-bold text-background shadow-[0_0_24px_rgba(34,211,238,0.2)] transition-all hover:from-cyan-glow/90 hover:to-profit/90 sm:h-12 sm:text-base"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-background/30 border-t-background" />
                  {isEditing ? "Updating Trade..." : "Saving Trade..."}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {isEditing ? <Pencil className="size-5" /> : <Sparkles className="size-5" />}
                  {isEditing ? "Update Trade" : "Save Trade"}
                </span>
              )}
            </Button>
            <p className="mt-2 text-center text-[10px] text-muted-foreground/60">
              Dashboard, journal, analytics, and AI coach update instantly
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
