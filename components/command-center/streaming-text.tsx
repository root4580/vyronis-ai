"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

type StreamingTextProps = {
  text: string
  active?: boolean
  className?: string
  onComplete?: () => void
}

export function StreamingText({
  text,
  active = true,
  className,
  onComplete,
}: StreamingTextProps) {
  const [visible, setVisible] = useState(active ? "" : text)

  useEffect(() => {
    if (!active) {
      setVisible(text)
      return
    }

    setVisible("")
    const words = text.split(/(\s+)/)
    let index = 0
    let cancelled = false

    const tick = () => {
      if (cancelled) return
      index += 1
      setVisible(words.slice(0, index).join(""))
      if (index < words.length) {
        window.setTimeout(tick, 28)
      } else {
        onComplete?.()
      }
    }

    window.setTimeout(tick, 80)
    return () => {
      cancelled = true
    }
  }, [text, active, onComplete])

  return <p className={cn("whitespace-pre-wrap", className)}>{visible}</p>
}
