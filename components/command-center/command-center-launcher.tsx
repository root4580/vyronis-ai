"use client"

import { Brain } from "lucide-react"
import { useAIContext } from "@/providers/ai-context-provider"
import { cn } from "@/lib/utils"

type CommandCenterLauncherProps = {
  className?: string
}

export function CommandCenterLauncher({ className }: CommandCenterLauncherProps) {
  const { isOpen, open, context, enabled } = useAIContext()

  if (!enabled) return null

  const warningCount = context?.warnings.length ?? 0

  return (
    <button
      type="button"
      aria-label="Open Vyronis AI Command Center"
      aria-expanded={isOpen}
      onClick={() => open()}
      className={cn("command-center-launcher group relative", className)}
    >
      <Brain className="size-5 transition-transform duration-300 group-hover:scale-110" />
      <span className="hidden text-[13px] font-medium md:inline">Vyronis AI</span>
      {warningCount > 0 ? (
        <span className="command-center-launcher-badge">{warningCount}</span>
      ) : null}
    </button>
  )
}
