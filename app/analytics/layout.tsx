import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Analytics",
  description: "Vyronis AI trading performance analytics — win rate, equity curve, setup quality, and weekly trends.",
}

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return children
}
