import type { Metadata } from "next"
import { StrategyPlaybookPage } from "@/components/strategy/strategy-playbook-page"

export const metadata: Metadata = {
  title: "Strategy Playbook",
  description:
    "Train your Vyronis AI coach on your exact setup rules, bias filters, and invalidation conditions.",
}

export default function StrategyBuilderPage() {
  return <StrategyPlaybookPage />
}
