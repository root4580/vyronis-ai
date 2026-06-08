export type TradeDurationInput = {
  opened_at?: string | null
  closed_at?: string | null
  hold_minutes?: number | null
}

function formatDurationParts(totalMinutes: number): string {
  if (totalMinutes < 1) return "<1m"
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h`
  return `${minutes}m`
}

export function formatTradeDuration(input: TradeDurationInput): string | null {
  if (input.opened_at && input.closed_at) {
    const openedMs = new Date(input.opened_at).getTime()
    const closedMs = new Date(input.closed_at).getTime()
    if (!Number.isNaN(openedMs) && !Number.isNaN(closedMs) && closedMs > openedMs) {
      const totalMinutes = Math.round((closedMs - openedMs) / 60_000)
      return formatDurationParts(totalMinutes)
    }
  }

  if (typeof input.hold_minutes === "number" && input.hold_minutes > 0) {
    return formatDurationParts(input.hold_minutes)
  }

  return null
}
