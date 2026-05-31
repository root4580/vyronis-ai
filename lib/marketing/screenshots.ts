import fs from "fs"
import path from "path"

const MARKETING_DIR = path.join(process.cwd(), "public", "marketing")

export const MARKETING_SCREENSHOT_BASES = {
  journal: "journal-plan",
  warRoom: "war-room",
  analytics: "analytics",
  hero: "ai-coach",
  aiCoach: "ai-coach",
  weeklyDebrief: "weekly-debrief",
  behavioralLeak: "behavioral-leak",
} as const

const EXTENSIONS = ["png", "webp", "jpg", "jpeg", "svg"] as const

export function resolveMarketingAsset(baseName: string): string | null {
  for (const ext of EXTENSIONS) {
    const filename = `${baseName}.${ext}`
    if (fs.existsSync(path.join(MARKETING_DIR, filename))) {
      return filename
    }
  }
  return null
}

export function marketingScreenshotSrc(filename: string): string {
  return `/marketing/${filename}`
}

export function getJournalScreenshotFile(): string | null {
  return resolveMarketingAsset(MARKETING_SCREENSHOT_BASES.journal)
}

export function getWarRoomScreenshotFile(): string | null {
  return resolveMarketingAsset(MARKETING_SCREENSHOT_BASES.warRoom)
}

export function getAnalyticsScreenshotFile(): string | null {
  return resolveMarketingAsset(MARKETING_SCREENSHOT_BASES.analytics)
}

/** Hero uses AI coach screenshot, or falls back to journal. */
export function getHeroScreenshotFile(): string | null {
  return (
    resolveMarketingAsset(MARKETING_SCREENSHOT_BASES.hero) ?? getJournalScreenshotFile()
  )
}

export function getAiCoachScreenshotFile(): string | null {
  return resolveMarketingAsset(MARKETING_SCREENSHOT_BASES.aiCoach)
}

export function getWeeklyDebriefScreenshotFile(): string | null {
  return resolveMarketingAsset(MARKETING_SCREENSHOT_BASES.weeklyDebrief)
}

export function getBehavioralLeakScreenshotFile(): string | null {
  return resolveMarketingAsset(MARKETING_SCREENSHOT_BASES.behavioralLeak)
}
