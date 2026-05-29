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
      root.style.setProperty("--vyronis-vv-height", `${vv.height}px`)
      root.style.setProperty("--vyronis-vv-top", `${vv.offsetTop}px`)
      const keyboardOpen = vv.height < window.innerHeight * 0.82
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
