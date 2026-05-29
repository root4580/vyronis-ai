export type SignalChartImageSource = "alert_image" | "war_room" | "alert_chart_url" | "none"

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp)(\?|#|$)/i

export function isDirectImageUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false
  const u = url.trim()
  if (u.startsWith("data:image/")) return true
  if (IMAGE_EXT.test(u)) return true
  if (/\/storage\/v1\/object\//i.test(u)) return true
  return false
}

export function isTradingViewChartPage(url: string | null | undefined): boolean {
  if (!url?.trim()) return false
  const u = url.trim()
  if (isDirectImageUrl(u)) return false
  return /tradingview\.com/i.test(u)
}

/** Prefer H4 → H1 → M15 → Daily → Weekly, else last uploaded URL. */
export function pickBestWarRoomScreenshot(urls: string[]): string | null {
  if (!urls.length) return null
  const candidates = urls.filter((u) => typeof u === "string" && u.trim())
  if (!candidates.length) return null

  const tfOrder = ["h4", "h1", "m15", "15m", "daily", "d1", "weekly", "w1"]
  for (const tf of tfOrder) {
    const found = candidates.find((u) => u.toLowerCase().includes(tf))
    if (found && isDirectImageUrl(found)) return found
  }

  const direct = candidates.filter(isDirectImageUrl)
  return direct[direct.length - 1] ?? candidates[candidates.length - 1] ?? null
}

export function resolveSignalChartImageUrl(input: {
  image_url?: string | null
  screenshot_url?: string | null
  chart_url?: string | null
  warRoomScreenshotUrls?: string[]
}): {
  url: string | null
  source: SignalChartImageSource
  skipped_reason?: string
} {
  for (const url of [input.image_url, input.screenshot_url]) {
    if (url && isDirectImageUrl(url)) {
      return { url: url.trim(), source: "alert_image" }
    }
  }

  const warRoom = pickBestWarRoomScreenshot(input.warRoomScreenshotUrls ?? [])
  if (warRoom && isDirectImageUrl(warRoom)) {
    return { url: warRoom.trim(), source: "war_room" }
  }

  if (input.chart_url && isDirectImageUrl(input.chart_url) && !isTradingViewChartPage(input.chart_url)) {
    return { url: input.chart_url.trim(), source: "alert_chart_url" }
  }

  if (input.chart_url && isTradingViewChartPage(input.chart_url)) {
    return {
      url: null,
      source: "none",
      skipped_reason:
        "TradingView chart_url is a page link, not an image. Upload charts in War Room or add image_url with a direct image link.",
    }
  }

  if ((input.warRoomScreenshotUrls?.length ?? 0) > 0) {
    return {
      url: null,
      source: "none",
      skipped_reason: "War Room uploads must be image files (PNG/JPG) — vision could not use them.",
    }
  }

  return {
    url: null,
    source: "none",
    skipped_reason:
      "Upload timeframe screenshots for this pair in War Room (vision runs automatically on alerts).",
  }
}
