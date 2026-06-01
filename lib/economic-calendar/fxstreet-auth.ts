import { FXSTREET_TOKEN_URL } from "@/lib/economic-calendar/constants"

type TokenCache = {
  accessToken: string
  expiresAtMs: number
}

let tokenCache: TokenCache | null = null

function getCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.FXSTREET_CLIENT_ID?.trim()
  const clientSecret = process.env.FXSTREET_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

export function isFxStreetConfigured(): boolean {
  return getCredentials() != null
}

export async function getFxStreetAccessToken(): Promise<string | null> {
  const credentials = getCredentials()
  if (!credentials) return null

  const now = Date.now()
  if (tokenCache && tokenCache.expiresAtMs > now + 60_000) {
    return tokenCache.accessToken
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    scope: "calendar",
  })

  const response = await fetch(FXSTREET_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`FXStreet auth failed (${response.status})${detail ? `: ${detail.slice(0, 120)}` : ""}`)
  }

  const payload = (await response.json()) as {
    access_token?: string
    expires_in?: number
  }

  if (!payload.access_token) {
    throw new Error("FXStreet auth response missing access_token")
  }

  const expiresInSec = payload.expires_in ?? 3600
  tokenCache = {
    accessToken: payload.access_token,
    expiresAtMs: now + expiresInSec * 1000,
  }

  return payload.access_token
}
