import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Analytics",
  description: "Vyronis HQ trading performance analytics — win rate, equity curve, setup quality, and weekly trends.",
}

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return children
}
