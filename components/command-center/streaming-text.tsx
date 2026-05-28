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
    let index = 0
    let cancelled = false
    const chunk = 3

    const tick = () => {
      if (cancelled) return
      index = Math.min(text.length, index + chunk)
      setVisible(text.slice(0, index))
      if (index < text.length) {
        window.setTimeout(tick, 16)
      } else {
        onComplete?.()
      }
    }

    window.setTimeout(tick, 40)
    return () => {
      cancelled = true
    }
  }, [text, active, onComplete])

  return <p className={cn("whitespace-pre-wrap leading-[1.6]", className)}>{visible}</p>
}
