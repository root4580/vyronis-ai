import type { CommandCenterMode } from "@/lib/command-center/types"
import type { DashboardTab } from "@/components/dashboard/trading-components"

export type DockHighlightId =
  | "dashboard"
  | "planner"
  | "coach"
  | "log"
  | "more"
  | null

export function resolveDockHighlight(input: {
  activeTab: DashboardTab
  commandCenterOpen: boolean
  commandCenterMode: CommandCenterMode
  tradeModalOpen: boolean
  pathname: string
}): DockHighlightId {
  if (input.tradeModalOpen) return "log"
  if (input.commandCenterOpen && input.commandCenterMode === "companion") return "coach"
  if (input.pathname.startsWith("/trade-planner")) return "planner"
  if (input.activeTab === "dashboard") return "dashboard"
  return null
}
