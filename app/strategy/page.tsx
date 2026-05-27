import type { Metadata } from "next"
import { StrategyPlaybookMain } from "@/components/strategy/strategy-playbook-main"

export const metadata: Metadata = {
  title: "Strategy Playbook",
  description:
    "Train your Vyronis AI coach on your exact setup rules, bias filters, and invalidation conditions.",
}

export default function StrategyBuilderPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 chart-grid opacity-30 pointer-events-none" />
      <div className="relative">
        <StrategyPlaybookMain />
        <footer className="border-t border-border/50 px-6 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            Vyronis AI — Strategy Playbook • Train your coach on your exact setup rules
          </p>
        </footer>
      </div>
    </div>
  )
}
