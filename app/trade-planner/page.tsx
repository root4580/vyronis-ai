import type { Metadata } from "next"
import { Suspense } from "react"
import { TradePlannerRoute } from "@/components/trade-planner/trade-planner-route"

export const metadata: Metadata = {
  title: "Trade Planner",
  description: "Pre-trade planning cockpit for forex risk, R:R, and lot size.",
}

export default function TradePlannerPage() {
  return (
    <Suspense fallback={null}>
      <TradePlannerRoute />
    </Suspense>
  )
}
