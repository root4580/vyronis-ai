"use client"

import { useEffect, useRef, useState } from "react"

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function useCountUp(target: number, duration = 900, enabled = true): number {
  const [value, setValue] = useState(enabled ? 0 : target)
  const previousTarget = useRef(target)

  useEffect(() => {
    if (!enabled) {
      setValue(target)
      previousTarget.current = target
      return
    }

    const from = previousTarget.current
    previousTarget.current = target
    const start = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      setValue(from + (target - from) * easeOutCubic(progress))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration, enabled])

  return value
}
