export type ChapterReviewAiCache = {
  narrative: string
  provider: string
  generatedAt: string
}

export type ChapterReviewPatternActionCache = {
  action: string
  provider: string
  generatedAt: string
  patternIds: string
}

export function readChapterReviewAiCache(
  payload: Record<string, unknown> | undefined,
): ChapterReviewAiCache | null {
  const raw = payload?.chapterReviewAi
  if (!raw || typeof raw !== "object") return null

  const row = raw as Record<string, unknown>
  const narrative = typeof row.narrative === "string" ? row.narrative.trim() : ""
  const provider = typeof row.provider === "string" ? row.provider.trim() : ""
  if (!narrative || !provider) return null

  return {
    narrative,
    provider,
    generatedAt:
      typeof row.generatedAt === "string" ? row.generatedAt : new Date(0).toISOString(),
  }
}

export function mergeChapterReviewAiCache(
  payload: Record<string, unknown>,
  cache: ChapterReviewAiCache,
): Record<string, unknown> {
  return {
    ...payload,
    chapterReviewAi: cache,
  }
}

export function readChapterReviewPatternActionCache(
  payload: Record<string, unknown> | undefined,
  patternIds: string,
): ChapterReviewPatternActionCache | null {
  const raw = payload?.chapterReviewPatternAction
  if (!raw || typeof raw !== "object") return null

  const row = raw as Record<string, unknown>
  const action = typeof row.action === "string" ? row.action.trim() : ""
  const provider = typeof row.provider === "string" ? row.provider.trim() : ""
  const cachedPatternIds = typeof row.patternIds === "string" ? row.patternIds : ""
  if (!action || !provider || cachedPatternIds !== patternIds) return null

  return {
    action,
    provider,
    generatedAt:
      typeof row.generatedAt === "string" ? row.generatedAt : new Date(0).toISOString(),
    patternIds: cachedPatternIds,
  }
}

export function mergeChapterReviewPatternActionCache(
  payload: Record<string, unknown>,
  cache: ChapterReviewPatternActionCache,
): Record<string, unknown> {
  return {
    ...payload,
    chapterReviewPatternAction: cache,
  }
}
