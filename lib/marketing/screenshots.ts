import fs from "fs"
import path from "path"

export const MARKETING_SCREENSHOTS = {
  journal: "journal-plan.png",
  warRoom: "war-room.png",
  analytics: "analytics.png",
  hero: "hero-dashboard.png",
} as const

export function marketingScreenshotExists(filename: string): boolean {
  return fs.existsSync(path.join(process.cwd(), "public", "marketing", filename))
}

export function marketingScreenshotSrc(filename: string): string {
  return `/marketing/${filename}`
}

/** Hero uses dedicated shot, or falls back to journal. */
export function getHeroScreenshotFile(): string | null {
  if (marketingScreenshotExists(MARKETING_SCREENSHOTS.hero)) {
    return MARKETING_SCREENSHOTS.hero
  }
  if (marketingScreenshotExists(MARKETING_SCREENSHOTS.journal)) {
    return MARKETING_SCREENSHOTS.journal
  }
  return null
}
