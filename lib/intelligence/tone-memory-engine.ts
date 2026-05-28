import type { CommandCenterMessageRecord } from "@/lib/command-center/types"
import type { CompanionIntent } from "@/lib/intelligence/companion-intent-engine"

export type InferredMessageTone =
  | "calm"
  | "anxious"
  | "rushed"
  | "neutral"
  | "hesitant"
  | "overconfident"
  | "frustrated"

export type ToneMemoryEntry = {
  tone: InferredMessageTone
  intent: CompanionIntent
  snippet: string
  createdAt: string
}

export type ToneMemorySnapshot = {
  recent: ToneMemoryEntry[]
  dominantTone: InferredMessageTone | null
  companionStyleHint: string
}

const HESITANT = [
  /not sure|unsure|hesitat|maybe|idk|don't know if|should i really/i,
  /scared to|afraid to|nervous about entering/i,
]
const RUSHED = [/need to take|right now|quick|asap|before it|can't miss/i]
const OVERCONFIDENT = [/easy money|can't lose|sure thing|definitely|100%|guaranteed/i]
const FRUSTRATED = [/pissed|angry|sick of|hate this|why do i|stupid/i]
const ANXIOUS = [/anxious|stressed|scared|worried|nervous|panic/i]
const CALM = [/calm|steady|patient|clear head|focused|good mindset/i]

export function inferMessageTone(text: string): InferredMessageTone {
  const t = text.trim().toLowerCase()
  if (!t) return "neutral"
  if (FRUSTRATED.some((p) => p.test(t))) return "frustrated"
  if (OVERCONFIDENT.some((p) => p.test(t))) return "overconfident"
  if (RUSHED.some((p) => p.test(t))) return "rushed"
  if (HESITANT.some((p) => p.test(t))) return "hesitant"
  if (ANXIOUS.some((p) => p.test(t))) return "anxious"
  if (CALM.some((p) => p.test(t))) return "calm"
  return "neutral"
}

/** Map extended tones to cognitive engine's 4-tone input */
export function mapToneForCognitive(
  tone: InferredMessageTone,
): "calm" | "anxious" | "rushed" | "neutral" {
  if (tone === "calm") return "calm"
  if (tone === "hesitant" || tone === "anxious" || tone === "frustrated") return "anxious"
  if (tone === "rushed" || tone === "overconfident") return "rushed"
  return "neutral"
}

export function buildToneMemorySnapshot(
  entries: ToneMemoryEntry[],
): ToneMemorySnapshot {
  const recent = entries.slice(0, 8)
  const counts = new Map<InferredMessageTone, number>()
  for (const e of recent) {
    counts.set(e.tone, (counts.get(e.tone) ?? 0) + 1)
  }
  const dominantTone =
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const companionStyleHint =
    dominantTone === "anxious" || dominantTone === "hesitant"
      ? "Recent messages sound uncertain — lead with reassurance, one clear question."
      : dominantTone === "frustrated" || dominantTone === "rushed"
        ? "Recent tone is pressured — slow down, validate, no hype."
        : dominantTone === "overconfident"
          ? "Recent tone sounds overconfident — ground in process and risk, not outcome."
          : dominantTone === "calm"
            ? "Recent tone is calm — keep responses light and conversational."
            : "Match the trader's natural pace — concise and human."

  return { recent, dominantTone, companionStyleHint }
}

export function toneMemoryFromMessages(
  messages: CommandCenterMessageRecord[],
  intentByIndex?: Map<number, CompanionIntent>,
): ToneMemorySnapshot {
  const userMsgs = messages.filter((m) => m.role === "user").slice(-6)
  const entries: ToneMemoryEntry[] = userMsgs.map((m, i) => ({
    tone: inferMessageTone(m.content),
    intent: intentByIndex?.get(i) ?? "casual_conversation",
    snippet: m.content.slice(0, 80),
    createdAt: m.created_at,
  }))
  return buildToneMemorySnapshot(entries)
}

export function buildToneMemoryInsightPayload(input: {
  tone: InferredMessageTone
  intent: CompanionIntent
  snippet: string
}): { category: "emotional_trigger"; insight: string; metadata: Record<string, unknown> } {
  return {
    category: "emotional_trigger",
    insight: `Tone: ${input.tone} during ${input.intent.replace(/_/g, " ")}`,
    metadata: {
      tone: input.tone,
      intent: input.intent,
      snippet: input.snippet.slice(0, 120),
      source: "companion_tone_memory",
    },
  }
}
