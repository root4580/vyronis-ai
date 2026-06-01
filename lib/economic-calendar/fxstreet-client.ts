import { FXSTREET_CALENDAR_BASE } from "@/lib/economic-calendar/constants"
import { getFxStreetAccessToken } from "@/lib/economic-calendar/fxstreet-auth"

export type RawFxStreetEventDate = Record<string, unknown>

export async function fetchFxStreetEventDates(input: {
  startDate: string
  endDate: string
}): Promise<RawFxStreetEventDate[]> {
  const token = await getFxStreetAccessToken()
  if (!token) return []

  const url = `${FXSTREET_CALENDAR_BASE}/eventDates/${input.startDate}/${input.endDate}?cultures=en-US`
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`FXStreet calendar failed (${response.status})${detail ? `: ${detail.slice(0, 120)}` : ""}`)
  }

  const payload = await response.json()
  if (Array.isArray(payload)) return payload as RawFxStreetEventDate[]
  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: RawFxStreetEventDate[] }).data
  }
  return []
}
