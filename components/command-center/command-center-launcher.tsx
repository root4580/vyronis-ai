"use client"

import { Brain } from "lucide-react"
import { useAIContext } from "@/providers/ai-context-provider"
import { cn } from "@/lib/utils"

type CommandCenterLauncherProps = {
  className?: string
}

export function CommandCenterLauncher({ className }: CommandCenterLauncherProps) {
  const { isOpen, open, context, enabled } = useAIContext()

  function warmCommandCenter() {
    void import("@/components/command-center/vyronis-command-center")
  }

  if (!enabled) return null

  const criticalCount =
    context?.freshWarnings.filter((w) => w.severity === "critical").length ?? 0

  return (
    <button
      type="button"
      aria-label="Open Vyronis HQ Command Center"
      aria-expanded={isOpen}
      onMouseEnter={warmCommandCenter}
      onFocus={warmCommandCenter}
      onClick={() => open()}
      className={cn(
        "command-center-launcher group relative hidden md:flex",
        className,
      )}
    >
      <Brain className="size-5 transition-transform duration-300 group-hover:scale-110" />
      <span className="hidden text-[13px] font-medium md:inline">Vyronis HQ</span>
      {criticalCount > 0 ? (
        <span className="command-center-launcher-badge">{criticalCount}</span>
      ) : null}
    </button>
  )
}
