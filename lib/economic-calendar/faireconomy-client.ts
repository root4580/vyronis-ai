import { FOREX_FACTORY_CALENDAR_URL } from "@/lib/economic-calendar/constants"

export type RawForexFactoryEvent = {
  title: string
  country: string
  date: string
  impact: string
  forecast?: string
  previous?: string
}

export async function fetchForexFactoryCalendarWeek(): Promise<RawForexFactoryEvent[]> {
  const response = await fetch(FOREX_FACTORY_CALENDAR_URL, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    next: { revalidate: 300 },
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(
      `ForexFactory calendar failed (${response.status})${detail ? `: ${detail.slice(0, 120)}` : ""}`,
    )
  }

  const payload = await response.json()
  if (!Array.isArray(payload)) return []
  return payload as RawForexFactoryEvent[]
}
