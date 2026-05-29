import type { Metadata } from "next"
import { StrategyBrainRoute } from "@/components/strategy-brain/strategy-brain-route"

export const metadata: Metadata = {
  title: "Strategy Brain",
  description:
    "Discretionary forex decision engine — HTF bias, Sunday planning, AOI, A+ scoring, and trade memory.",
}

export default function StrategyBrainPage() {
  return <StrategyBrainRoute />
}
