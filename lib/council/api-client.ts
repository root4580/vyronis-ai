import type {
  CouncilBriefingResponse,
  CouncilRespondResponse,
  CouncilSessionResponse,
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
  })
  return parseJson<CouncilSessionResponse>(response)
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
}): Promise<CouncilRespondResponse> {
  const response = await fetch("/api/council/respond", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accountId: input.accountId,
      message: input.message,
      agent: input.agent,
    }),
  })
  return parseJson<CouncilRespondResponse>(response)
}
