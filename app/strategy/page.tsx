import {
  StrategyHeader,
  StrategyBuilderMain,
} from "@/components/strategy/strategy-components"

export default function StrategyBuilderPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Subtle background grid */}
      <div className="fixed inset-0 chart-grid opacity-30 pointer-events-none" />
      
      {/* Main content */}
      <div className="relative">
        <StrategyHeader />
        <StrategyBuilderMain />

        {/* Footer */}
        <footer className="border-t border-border/50 py-4 px-6 text-center">
          <p className="text-xs text-muted-foreground">
            Vyronis AI — Strategy Builder • Build institutional-grade trading strategies
          </p>
        </footer>
      </div>
    </div>
  )
}
