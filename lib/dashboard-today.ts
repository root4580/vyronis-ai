import type { DailyRitualView, RitualStepId } from "@/lib/daily-ritual"

export type TodayPrimaryAction = {
  stepId: RitualStepId
  title: string
  subtitle: string
  ctaLabel: string
}

export function getTodayPrimaryAction(view: DailyRitualView): TodayPrimaryAction {
  const current = view.steps.find((step) => step.status === "current")
  const step = current ?? view.steps.find((s) => s.status !== "complete") ?? view.steps[0]

  if (view.allComplete) {
    return {
      stepId: "debrief",
      title: "Session complete",
      subtitle: "You closed today with discipline. Review performance when ready.",
      ctaLabel: "View performance",
    }
  }

  switch (step.id) {
    case "check-in":
      return {
        stepId: "check-in",
        title: "Start with check-in",
        subtitle: step.hint,
        ctaLabel: "Complete check-in",
      }
    case "coach":
      return {
        stepId: "coach",
        title: "Run pre-trade coach",
        subtitle: step.hint,
        ctaLabel: "Open Vyronis Coach",
      }
    case "log":
      return {
        stepId: "log",
        title: "Log today's trades",
        subtitle: step.hint,
        ctaLabel: "Log a trade",
      }
    case "debrief":
      return {
        stepId: "debrief",
        title: "Close with debrief",
        subtitle: step.hint,
        ctaLabel: "Run debrief",
      }
    default:
      return {
        stepId: "check-in",
        title: "Begin today's ritual",
        subtitle: "Check-in → Coach → Log → Debrief",
        ctaLabel: "Get started",
      }
  }
}
