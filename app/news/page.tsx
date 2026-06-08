import type { Metadata } from "next"
import { NewsRoute } from "@/components/economic-calendar/news-route"

export const metadata: Metadata = {
  title: "Economic Calendar",
  description: "Today's forex news releases, impact levels, and trading risk guidance.",
}

export default function NewsPage() {
  return <NewsRoute />
}
