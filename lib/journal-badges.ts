import type { SetupClassification } from "@/lib/trade-coach/setup-score-engine"
import { cn } from "@/lib/utils"

/** Shared pill architecture — setup tier is visually primary vs mistake tags */
export const JOURNAL_BADGE_BASE =
  "inline-flex shrink-0 items-center justify-center rounded-full border leading-none whitespace-nowrap transition-all duration-200 ease-out"

export const JOURNAL_SETUP_METRICS = "h-7 min-h-[28px] px-2.5 text-[11px] font-semibold tracking-wide"
export const JOURNAL_MISTAKE_METRICS = "h-6 min-h-[24px] px-2 text-[10px] font-medium tracking-wide"
export const JOURNAL_MISTAKE_METRICS_MD = "h-7 min-h-[28px] px-2.5 text-[11px] font-medium tracking-wide"

const SETUP_GLOW: Record<SetupClassification, string> = {
  "A+": "shadow-[0_0_14px_rgba(34,211,238,0.28)] hover:shadow-[0_0_20px_rgba(34,211,238,0.38)]",
  B: "shadow-[0_0_12px_rgba(34,197,94,0.2)] hover:shadow-[0_0_18px_rgba(34,197,94,0.3)]",
  C: "shadow-[0_0_10px_rgba(245,158,11,0.15)] hover:shadow-[0_0_16px_rgba(245,158,11,0.22)]",
  Impulsive:
    "shadow-[0_0_14px_rgba(249,115,22,0.22)] hover:shadow-[0_0_20px_rgba(249,115,22,0.32)]",
  Revenge: "shadow-[0_0_14px_rgba(239,68,68,0.26)] hover:shadow-[0_0_20px_rgba(239,68,68,0.36)]",
  "Counter-Trend":
    "shadow-[0_0_14px_rgba(167,139,250,0.24)] hover:shadow-[0_0_20px_rgba(167,139,250,0.34)]",
}

const SETUP_STYLES: Record<SetupClassification, string> = {
  "A+": "border-cyan-glow/45 bg-cyan-glow/[0.14] text-cyan-glow hover:border-cyan-glow/60 hover:bg-cyan-glow/[0.18]",
  B: "border-profit/35 bg-profit/[0.12] text-profit hover:border-profit/45 hover:bg-profit/[0.16]",
  C: "border-amber-500/35 bg-amber-500/[0.12] text-amber-300 hover:border-amber-500/45 hover:bg-amber-500/[0.16]",
  Impulsive:
    "border-orange-500/40 bg-orange-500/[0.14] text-orange-300 hover:border-orange-500/50 hover:bg-orange-500/[0.18]",
  Revenge:
    "border-loss/45 bg-loss/[0.15] text-loss hover:border-loss/55 hover:bg-loss/[0.2]",
  "Counter-Trend":
    "border-violet-400/40 bg-violet-500/[0.14] text-violet-300 hover:border-violet-400/50 hover:bg-violet-500/[0.18]",
}

/** Label-specific mistake tones — same metrics, distinct semantics */
const MISTAKE_LABEL_GLOW =
  "shadow-[0_0_8px_rgba(255,255,255,0.04)] hover:shadow-[0_0_12px_rgba(255,255,255,0.06)]"

const MISTAKE_LABEL_STYLES: Record<string, string> = {
  "Counter Trend":
    "border-violet-400/30 bg-violet-500/[0.1] text-violet-300 shadow-[0_0_10px_rgba(167,139,250,0.14)] hover:border-violet-400/40 hover:bg-violet-500/[0.14] hover:shadow-[0_0_14px_rgba(167,139,250,0.2)]",
  "No Confirmation":
    "border-amber-500/30 bg-amber-500/[0.1] text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.12)] hover:border-amber-500/40 hover:bg-amber-500/[0.14] hover:shadow-[0_0_14px_rgba(245,158,11,0.18)]",
  "Ignored Rules":
    "border-orange-500/32 bg-orange-500/[0.1] text-orange-300 shadow-[0_0_10px_rgba(249,115,22,0.14)] hover:border-orange-500/42 hover:bg-orange-500/[0.14] hover:shadow-[0_0_14px_rgba(249,115,22,0.2)]",
  FOMO: "border-loss/35 bg-loss/[0.12] text-loss hover:border-loss/45 hover:bg-loss/[0.16]",
  "Revenge Trade":
    "border-loss/35 bg-loss/[0.12] text-loss hover:border-loss/45 hover:bg-loss/[0.16]",
  Overrisk:
    "border-loss/35 bg-loss/[0.12] text-loss hover:border-loss/45 hover:bg-loss/[0.16]",
  "Moved Stop":
    "border-loss/30 bg-loss/[0.1] text-loss/90 hover:border-loss/40 hover:bg-loss/[0.14]",
  "Early Entry":
    "border-amber-500/28 bg-amber-500/[0.08] text-amber-200/90 hover:border-amber-500/38 hover:bg-amber-500/[0.12]",
  Overtrading:
    "border-amber-500/28 bg-amber-500/[0.08] text-amber-200/90 hover:border-amber-500/38 hover:bg-amber-500/[0.12]",
}

const MISTAKE_DANGEROUS_FALLBACK =
  "border-loss/35 bg-loss/[0.12] text-loss shadow-[0_0_10px_rgba(239,68,68,0.16)] hover:border-loss/45 hover:bg-loss/[0.16] hover:shadow-[0_0_14px_rgba(239,68,68,0.22)]"

const MISTAKE_NEUTRAL_FALLBACK =
  "border-white/[0.1] bg-white/[0.04] text-muted-foreground/85 hover:border-white/[0.14] hover:bg-white/[0.06]"

export function getJournalSetupBadgeClassName(
  classification: SetupClassification,
  size: "sm" | "md" | "journal" = "journal",
): string {
  const metrics =
    size === "md" ? "h-7 min-h-[28px] px-2.5 text-[11px] font-semibold tracking-wide" : JOURNAL_SETUP_METRICS

  return cn(
    JOURNAL_BADGE_BASE,
    "journal-setup-badge",
    metrics,
    SETUP_STYLES[classification],
    SETUP_GLOW[classification],
    "hover:-translate-y-px",
  )
}

export function getJournalMistakeBadgeClassName(
  label: string,
  dangerous: boolean,
  size: "sm" | "md" = "sm",
): string {
  const metrics = size === "md" ? JOURNAL_MISTAKE_METRICS_MD : JOURNAL_MISTAKE_METRICS
  const labelStyle = MISTAKE_LABEL_STYLES[label]
  const tone = labelStyle ?? (dangerous ? MISTAKE_DANGEROUS_FALLBACK : MISTAKE_NEUTRAL_FALLBACK)

  return cn(
    JOURNAL_BADGE_BASE,
    "journal-mistake-badge",
    metrics,
    tone,
    !labelStyle && MISTAKE_LABEL_GLOW,
    dangerous && !labelStyle && "shadow-[0_0_10px_rgba(239,68,68,0.16)]",
    "hover:-translate-y-px",
  )
}

export const JOURNAL_MISTAKE_CLUSTER_CLASS =
  "journal-mistake-cluster flex min-w-0 max-w-full items-center gap-x-1.5 gap-y-1"

export const JOURNAL_MOBILE_BADGE_STACK_CLASS =
  "mt-2 flex min-w-0 max-w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-2"
