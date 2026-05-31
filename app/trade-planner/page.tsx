import type { Metadata } from "next"
import { TradePlannerRoute } from "@/components/trade-planner/trade-planner-route"

export const metadata: Metadata = {
  title: "Trade Planner",
  description: "Pre-trade planning cockpit for forex risk, R:R, and lot size.",
}

export default function TradePlannerPage() {
  return <TradePlannerRoute />
}
