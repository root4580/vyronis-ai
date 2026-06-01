import type { CalendarImpact } from "@/lib/economic-calendar/types"

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

export function formatImpactLabel(_impact: CalendarImpact = "high"): string {
  return "🔴 High impact"
}
