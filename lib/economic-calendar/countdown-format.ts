import type { CalendarImpact } from "@/lib/economic-calendar/types"

const IMPACT_EMOJI: Record<CalendarImpact, string> = {
  high: "🔴",
  medium: "🟠",
  low: "🟢",
}

const IMPACT_LABEL: Record<CalendarImpact, string> = {
  high: "High Impact",
  medium: "Medium Impact",
  low: "Low Impact",
}

export function getImpactEmoji(impact: CalendarImpact): string {
  return IMPACT_EMOJI[impact]
}

export function getImpactLabel(impact: CalendarImpact): string {
  return IMPACT_LABEL[impact]
}

export function getSecondsUntil(dateUtc: string, now = new Date()): number {
  const eventMs = new Date(dateUtc).getTime()
  if (Number.isNaN(eventMs)) return 0
  return Math.max(0, Math.floor((eventMs - now.getTime()) / 1000))
}

export function formatCountdownTimer(totalSeconds: number): string {
  if (totalSeconds <= 0) return "Now"
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

export function formatImpactLabel(impact: CalendarImpact = "high"): string {
  return `${getImpactEmoji(impact)} ${getImpactLabel(impact)}`
}

export function formatCompactCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "now"
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return "<1m"
}
