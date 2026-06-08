import type {
  CouncilBriefingResponse,
  CouncilHistoryResponse,
  CouncilOpenResponse,
  CouncilRespondResponse,
  CouncilSessionResponse,
  CouncilSettingsRecord,
  CouncilSettingsUpdateInput,
} from "@/lib/council/types"

async function parseJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string; migrationPending?: boolean }
  if (!response.ok) {
    throw new Error(payload.error || "Council request failed")
  }
  return payload
}

function withAccountQuery(accountId: string | null, path: string): string {
  if (!accountId) return path
  const separator = path.includes("?") ? "&" : "?"
  return `${path}${separator}accountId=${encodeURIComponent(accountId)}`
}

export async function fetchCouncilSession(
  accountId: string | null,
): Promise<CouncilSessionResponse> {
  const response = await fetch(withAccountQuery(accountId, "/api/council/session"), {
    credentials: "include",
    cache: "no-store",
  })
  return parseJson<CouncilSessionResponse>(response)
}

export async function fetchCouncilVisualContext(
  accountId: string | null,
  options?: { refresh?: boolean },
): Promise<{ visual: CouncilSessionResponse["visual"] }> {
  let path = withAccountQuery(accountId, "/api/council/context")
  if (options?.refresh) {
    path += path.includes("?") ? "&refresh=1" : "?refresh=1"
  }
  const response = await fetch(path, {
    credentials: "include",
  })
  return parseJson<{ visual: CouncilSessionResponse["visual"] }>(response)
}

export async function clearCouncilSession(
  accountId: string | null,
): Promise<CouncilSessionResponse> {
  const response = await fetch("/api/council/session", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accountId,
      action: "clear",
    }),
  })
  return parseJson<CouncilSessionResponse>(response)
}

export async function runCouncilOpen(input: {
  accountId: string | null
}): Promise<CouncilOpenResponse> {
  const response = await fetch("/api/council/open", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accountId: input.accountId,
    }),
  })
  return parseJson<CouncilOpenResponse>(response)
}

export async function runCouncilBriefing(input: {
  accountId: string | null
  force?: boolean
}): Promise<CouncilBriefingResponse> {
  const response = await fetch("/api/council/briefing", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accountId: input.accountId,
      force: input.force ?? false,
    }),
  })
  return parseJson<CouncilBriefingResponse>(response)
}

export async function askCouncil(input: {
  accountId: string | null
  message: string
  agent?: string
  conversationAgent?: string
  fullCouncilParticipation?: boolean
  inputSource?: "voice" | "text"
}): Promise<CouncilRespondResponse> {
  const response = await fetch("/api/council/respond", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accountId: input.accountId,
      message: input.message,
      agent: input.agent,
      conversationAgent: input.conversationAgent,
      fullCouncilParticipation: input.fullCouncilParticipation,
      inputSource: input.inputSource ?? "text",
    }),
  })
  return parseJson<CouncilRespondResponse>(response)
}

export async function fetchCouncilVoiceCheck(): Promise<{
  voiceConfigured: boolean
  ok: boolean
  error?: string
  sampleBytes?: number
}> {
  const response = await fetch("/api/council/voice-check", {
    credentials: "include",
    cache: "no-store",
  })

  if (response.status === 404) {
    return {
      voiceConfigured: false,
      ok: false,
      error: "Voice update not deployed yet — redeploy vyronis-ai from latest main on Vercel.",
    }
  }

  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.includes("json")) {
    return {
      voiceConfigured: false,
      ok: false,
      error: `Voice check failed (${response.status}). Redeploy vyronis-ai on Vercel.`,
    }
  }

  const payload = (await response.json()) as {
    voiceConfigured?: boolean
    ok?: boolean
    error?: string
    sampleBytes?: number
  }
  return {
    voiceConfigured: Boolean(payload.voiceConfigured),
    ok: Boolean(payload.ok),
    error: payload.error,
    sampleBytes: payload.sampleBytes,
  }
}

export async function fetchCouncilSpeech(input: {
  agent: string
  text: string
}): Promise<Blob> {
  const response = await fetch("/api/council/speak", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agent: input.agent,
      text: input.text,
    }),
  })

  const contentType = response.headers.get("content-type") ?? ""

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(payload.error || `Could not load agent voice (${response.status})`)
  }

  if (!contentType.includes("audio")) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(payload.error || "Voice server returned non-audio response")
  }

  const blob = await response.blob()
  if (blob.size < 128) {
    throw new Error("Voice server returned empty audio")
  }

  return blob
}

export async function transcribeCouncilAudio(blob: Blob): Promise<string> {
  const formData = new FormData()
  const extension = blob.type.includes("mp4") ? "recording.m4a" : "recording.webm"
  formData.append("audio", blob, extension)

  const response = await fetch("/api/council/listen", {
    method: "POST",
    credentials: "include",
    body: formData,
  })

  const payload = (await response.json()) as { text?: string; error?: string }
  if (!response.ok) {
    throw new Error(payload.error || "Could not transcribe audio")
  }

  return payload.text?.trim() ?? ""
}

export async function fetchCouncilHistory(
  accountId: string | null,
): Promise<CouncilHistoryResponse> {
  const response = await fetch(withAccountQuery(accountId, "/api/council/history"), {
    credentials: "include",
  })
  return parseJson<CouncilHistoryResponse>(response)
}

export async function updateCouncilSettings(
  patch: CouncilSettingsUpdateInput,
): Promise<{ settings: CouncilSettingsRecord }> {
  const response = await fetch("/api/council/settings", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })
  return parseJson<{ settings: CouncilSettingsRecord }>(response)
}
