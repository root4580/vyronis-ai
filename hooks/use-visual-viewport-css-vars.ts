"use client"

import { useEffect } from "react"

/**
 * Syncs Visual Viewport dimensions to CSS vars so fixed panels shrink when the
 * mobile keyboard opens (iOS Safari / Chrome).
 */
export function useVisualViewportCssVars(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return

    const vv = window.visualViewport
    if (!vv) return

    const root = document.documentElement

    const update = () => {
      const height = Math.round(vv.height)
      const top = Math.round(vv.offsetTop)
      root.style.setProperty("--vyronis-vv-height", `${height}px`)
      root.style.setProperty("--vyronis-vv-top", `${top}px`)
      const keyboardOpen = height < window.innerHeight * 0.82
      root.classList.toggle("keyboard-open", keyboardOpen)
    }

    update()
    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)

    return () => {
      vv.removeEventListener("resize", update)
      vv.removeEventListener("scroll", update)
      root.classList.remove("keyboard-open")
      root.style.removeProperty("--vyronis-vv-height")
      root.style.removeProperty("--vyronis-vv-top")
    }
  }, [enabled])
}
