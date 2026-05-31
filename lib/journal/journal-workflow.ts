import { getDashboardTabHref } from "@/lib/dashboard-nav"

/** Pre-trade → post-trade learning workflow (decision intelligence, not just logging). */

export type JournalWorkflowStepId =
  | "weekly_planning"
  | "aoi_monitoring"
  | "setup_confirmation"
  | "emotion_check"
  | "trade_decision"
  | "journal_entry"
  | "review"
  | "pattern_memory"

export type JournalWorkflowStep = {
  id: JournalWorkflowStepId
  label: string
  shortLabel: string
  href: string
  description: string
}

export const JOURNAL_WORKFLOW_STEPS: JournalWorkflowStep[] = [
  {
    id: "weekly_planning",
    label: "Weekly War Room",
    shortLabel: "Plan",
    href: "/war-room",
    description: "Sunday thesis, pairs, bias, AOI, and scenarios",
  },
  {
    id: "aoi_monitoring",
    label: "AOI board",
    shortLabel: "AOI",
    href: "/strategy-brain",
    description: "Track zones and invalidation per pair",
  },
  {
    id: "setup_confirmation",
    label: "Setup check",
    shortLabel: "Setup",
    href: "/strategy-brain",
    description: "Confirmation checklist and A+ scoring",
  },
  {
    id: "emotion_check",
    label: "Emotion gate",
    shortLabel: "Emotion",
    href: "/strategy-brain",
    description: "Pre-trade psychology screen",
  },
  {
    id: "trade_decision",
    label: "Session guard",
    shortLabel: "Decide",
    href: getDashboardTabHref("dashboard"),
    description: "Command Center chart review verdict",
  },
  {
    id: "journal_entry",
    label: "Log trade",
    shortLabel: "Log",
    href: getDashboardTabHref("journal"),
    description: "Journal entry with screenshots and tags",
  },
  {
    id: "review",
    label: "Post-trade review",
    shortLabel: "Review",
    href: "/strategy-brain",
    description: "Strategy vs execution debrief",
  },
  {
    id: "pattern_memory",
    label: "Pattern memory",
    shortLabel: "Memory",
    href: getDashboardTabHref("journal"),
    description: "Compare setups to historical mistakes",
  },
]

export type JournalViewMode = "trades" | "calendar" | "analytics" | "intelligence"

export const JOURNAL_VIEW_MODES: Array<{
  id: JournalViewMode
  label: string
}> = [
  { id: "trades", label: "Trades" },
  { id: "calendar", label: "Calendar" },
  { id: "analytics", label: "Stats" },
  { id: "intelligence", label: "Memory" },
]
