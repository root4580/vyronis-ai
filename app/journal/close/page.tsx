import type { Metadata } from "next"
import { DailyCloseRoute } from "@/components/journal/daily-close-route"

export const metadata: Metadata = {
  title: "Close the Day",
  description: "End-of-day journal — improve tomorrow, session rules, and focus area.",
}

export default function DailyClosePage() {
  return <DailyCloseRoute />
}
