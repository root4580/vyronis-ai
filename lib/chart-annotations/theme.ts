import type { ChartAnnotationKind, ChartAnnotationTone } from "@/lib/chart-annotations/types"

export type AnnotationThemeStyle = {
  stroke: string
  fill: string
  glow: string
  chipBg: string
  chipText: string
  dashed?: boolean
}

const TONE_STYLES: Record<ChartAnnotationTone, AnnotationThemeStyle> = {
  bullish: {
    stroke: "rgba(34, 211, 238, 0.95)",
    fill: "rgba(34, 211, 238, 0.12)",
    glow: "rgba(34, 211, 238, 0.45)",
    chipBg: "rgba(34, 211, 238, 0.16)",
    chipText: "#a5f3fc",
  },
  bearish: {
    stroke: "rgba(248, 113, 113, 0.95)",
    fill: "rgba(248, 113, 113, 0.12)",
    glow: "rgba(248, 113, 113, 0.4)",
    chipBg: "rgba(248, 113, 113, 0.16)",
    chipText: "#fecaca",
  },
  caution: {
    stroke: "rgba(251, 191, 36, 0.95)",
    fill: "rgba(251, 191, 36, 0.12)",
    glow: "rgba(251, 191, 36, 0.35)",
    chipBg: "rgba(251, 191, 36, 0.16)",
    chipText: "#fde68a",
  },
  liquidity: {
    stroke: "rgba(192, 132, 252, 0.95)",
    fill: "rgba(192, 132, 252, 0.12)",
    glow: "rgba(192, 132, 252, 0.4)",
    chipBg: "rgba(192, 132, 252, 0.16)",
    chipText: "#e9d5ff",
  },
  neutral: {
    stroke: "rgba(148, 163, 184, 0.9)",
    fill: "rgba(148, 163, 184, 0.1)",
    glow: "rgba(148, 163, 184, 0.25)",
    chipBg: "rgba(148, 163, 184, 0.14)",
    chipText: "#cbd5e1",
  },
}

const KIND_DEFAULT_TONE: Partial<Record<ChartAnnotationKind, ChartAnnotationTone>> = {
  aoi_valid: "bullish",
  aoi_invalid: "bearish",
  aoi_zone: "bullish",
  bos: "bullish",
  choch: "caution",
  liquidity_sweep: "liquidity",
  mitigation: "liquidity",
  retest: "bullish",
  displacement: "caution",
  confirmation_candle: "bullish",
  entry_area: "bullish",
  invalidation_zone: "bearish",
  htf_bias: "neutral",
  chase_risk: "caution",
  countertrend: "bearish",
}

export function resolveAnnotationStyle(
  kind: ChartAnnotationKind,
  tone: ChartAnnotationTone,
  dashed?: boolean,
): AnnotationThemeStyle {
  const base = TONE_STYLES[tone] || TONE_STYLES[KIND_DEFAULT_TONE[kind] || "neutral"]
  if (kind === "aoi_invalid" || dashed) {
    return { ...base, dashed: true }
  }
  return base
}

export function defaultToneForKind(kind: ChartAnnotationKind): ChartAnnotationTone {
  return KIND_DEFAULT_TONE[kind] || "neutral"
}
