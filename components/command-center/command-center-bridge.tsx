"use client"

import { useEffect } from "react"
import { useAIContext } from "@/providers/ai-context-provider"

type CommandCenterBridgeProps = {
  onBindOpen: (open: () => void) => void
}

export function CommandCenterBridge({ onBindOpen }: CommandCenterBridgeProps) {
  const { open } = useAIContext()

  useEffect(() => {
    onBindOpen(() => open())
  }, [open, onBindOpen])

  return null
}
