export type CouncilInputSource = "voice" | "text"

/** Council always accepts voice only — never keyboard chat. */
export function isCouncilVoiceOnlyMode(): boolean {
  return true
}

export function councilAcceptsInputSource(
  _listenConfigured: boolean,
  source: CouncilInputSource,
): boolean {
  return source === "voice"
}

const GOODBYE_PATTERNS = [
  /^good\s*bye\.?!?$/i,
  /^goodbe\.?!?$/i,
  /^bye\.?!?$/i,
  /^bye\s+bye\.?!?$/i,
  /^see\s+you/i,
  /^talk\s+(to\s+you\s+)?later/i,
  /^that'?s\s+all/i,
  /^i'?m\s+done/i,
  /^we'?re\s+done/i,
  /^end\s+(the\s+)?(session|call|council)/i,
  /^close\s+(the\s+)?(chat|council)/i,
  /^thanks?,?\s*(bye|good\s*bye)/i,
  /^later\.?!?$/i,
  /^signing\s+off/i,
]

const PHANTOM_EXACT = new Set([
  "thanks",
  "thank you",
  "thank you.",
  "you",
  "yeah",
  "yes",
  "no",
  "ok",
  "okay",
  "hmm",
  "um",
  "uh",
  ".",
  "...",
  "♪",
  "♪♪",
])

const PHANTOM_PATTERNS = [
  /^thanks?\s+for\s+watching/i,
  /^thank\s+you\s+for\s+watching/i,
  /^subscribe/i,
  /^subtitles?\b/i,
  /^please\s+subscribe/i,
  /^www\./i,
  /^http/i,
  /^\[.*\]$/,
  /^♪+$/,
  /^\.+$/,
]

/** Spoken farewell — ends mic and closes council (not sent to agents). */
export function isCouncilGoodbyeRequest(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false

  const normalized = trimmed
    .replace(/[^\w\s'.?!-]/g, "")
    .trim()

  for (const pattern of GOODBYE_PATTERNS) {
    if (pattern.test(normalized) || pattern.test(trimmed)) return true
  }

  return false
}

/**
 * Drop silence/noise hallucinations from Whisper so the council is not triggered.
 */
export function shouldDiscardCouncilTranscription(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true
  if (trimmed.length < 2) return true

  const normalized = trimmed
    .replace(/[^\w\s'.?!-]/g, "")
    .trim()
    .toLowerCase()

  if (!normalized) return true
  if (PHANTOM_EXACT.has(normalized)) return true

  for (const pattern of PHANTOM_PATTERNS) {
    if (pattern.test(trimmed)) return true
  }

  return false
}

export function filterCouncilTranscription(text: string): string | null {
  const trimmed = text.trim()
  if (shouldDiscardCouncilTranscription(trimmed)) return null
  return trimmed
}
