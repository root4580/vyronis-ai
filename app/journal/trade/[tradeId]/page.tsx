import type { Metadata } from "next"
import { TradeIntelligenceRoute } from "@/components/journal/trade-intelligence-route"

export const metadata: Metadata = {
  title: "Trade Intelligence",
  description: "HTF alignment, emotion, checklist, AI review, and pattern memory for a journal trade.",
}

type Props = { params: Promise<{ tradeId: string }> }

export default async function TradeIntelligencePage({ params }: Props) {
  const { tradeId } = await params
  return <TradeIntelligenceRoute tradeId={tradeId} />
}
