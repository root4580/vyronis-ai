import { FOREX_FACTORY_CALENDAR_URL } from "@/lib/economic-calendar/constants"

export type RawForexFactoryEvent = {
  title: string
  country: string
  date: string
  impact: string
  forecast?: string
  previous?: string
  actual?: string
}

const FETCH_HEADERS = {
  Accept: "application/json",
  "User-Agent": "VyronisHQ-Calendar/1.0",
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchForexFactoryCalendarWeek(): Promise<RawForexFactoryEvent[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(FOREX_FACTORY_CALENDAR_URL, {
      headers: FETCH_HEADERS,
      next: { revalidate: 900 },
    })

    if (response.status === 429 && attempt === 0) {
      await sleep(2000)
      continue
    }

    if (!response.ok) {
      throw new Error(`ForexFactory calendar failed (${response.status})`)
    }

    const payload = await response.json()
    if (!Array.isArray(payload)) return []
    return payload as RawForexFactoryEvent[]
  }

  throw new Error("ForexFactory calendar failed (429)")
}
